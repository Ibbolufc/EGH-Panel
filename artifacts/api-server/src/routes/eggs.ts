import { Router } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, eggsTable, eggVariablesTable, nestsTable } from "@workspace/db";
import { CreateEggBody, UpdateEggBody, ImportEggBody } from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: Router = Router();

router.get("/eggs", requireAuth, async (req, res): Promise<void> => {
  const nestIdRaw = req.query.nestId;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const nestId = nestIdRaw ? parseInt(String(nestIdRaw), 10) : undefined;

  const conditions = [];
  if (nestId) conditions.push(eq(eggsTable.nestId, nestId));
  if (search) conditions.push(ilike(eggsTable.name, `%${search}%`));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const eggs = await db
    .select({
      id: eggsTable.id,
      nestId: eggsTable.nestId,
      nestName: nestsTable.name,
      name: eggsTable.name,
      description: eggsTable.description,
      dockerImage: eggsTable.dockerImage,
      startup: eggsTable.startup,
      createdAt: eggsTable.createdAt,
    })
    .from(eggsTable)
    .leftJoin(nestsTable, eq(eggsTable.nestId, nestsTable.id))
    .where(whereClause);

  res.json(eggs.map((e) => ({ ...e, nestName: e.nestName ?? "Unknown" })));
});

router.post("/eggs", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEggBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [egg] = await db.insert(eggsTable).values(parsed.data).returning();
  const nest = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, egg.nestId));

  res.status(201).json({ ...egg, nestName: nest[0]?.name ?? "Unknown" });
});

// Import from Pterodactyl egg JSON
router.post("/eggs/import", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ImportEggBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const eggJson = parsed.data.json as Record<string, unknown>;

  // Parse Pterodactyl egg format
  const name = String(eggJson.name ?? "Imported Egg");
  const description = eggJson.description ? String(eggJson.description) : null;
  const startup = String(eggJson.startup ?? "");
  const dockerImage = typeof eggJson.docker_image === "string"
    ? eggJson.docker_image
    : Object.keys((eggJson.docker_images as Record<string, string>) ?? {})[0] ?? "ghcr.io/pterodactyl/yolks:debian";

  const dockerImages = typeof eggJson.docker_images === "object" && eggJson.docker_images !== null
    ? Object.keys(eggJson.docker_images as Record<string, string>)
    : typeof eggJson.docker_image === "string" ? [eggJson.docker_image] : [];

  const installScript = (eggJson.script as Record<string, unknown>)?.install
    ? String((eggJson.script as Record<string, unknown>).install)
    : null;

  const nestName = eggJson.nest ? String((eggJson.nest as Record<string, unknown>).name ?? "Imported") : "Imported";

  // Find or create nest
  let [nest] = await db.select().from(nestsTable).where(eq(nestsTable.name, nestName));
  if (!nest) {
    const [created] = await db.insert(nestsTable).values({ name: nestName }).returning();
    nest = created;
  }

  // Insert egg
  const [egg] = await db.insert(eggsTable).values({
    nestId: nest.id,
    name,
    description,
    dockerImage,
    dockerImages,
    startup,
    installScript,
  }).returning();

  // Insert variables
  const variables = Array.isArray(eggJson.variables) ? eggJson.variables as Record<string, unknown>[] : [];
  for (const v of variables) {
    await db.insert(eggVariablesTable).values({
      eggId: egg.id,
      name: String(v.name ?? ""),
      description: v.description ? String(v.description) : null,
      envVariable: String(v.env_variable ?? ""),
      defaultValue: String(v.default_value ?? ""),
      userViewable: String(v.user_viewable ?? "true"),
      userEditable: String(v.user_editable ?? "false"),
      rules: String(v.rules ?? ""),
    });
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "egg.imported",
    description: `Imported egg: ${name}`,
  });

  res.status(201).json({ ...egg, nestName: nest.name });
});

router.get("/eggs/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [egg] = await db
    .select({
      id: eggsTable.id,
      nestId: eggsTable.nestId,
      nestName: nestsTable.name,
      name: eggsTable.name,
      description: eggsTable.description,
      dockerImage: eggsTable.dockerImage,
      dockerImages: eggsTable.dockerImages,
      startup: eggsTable.startup,
      installScript: eggsTable.installScript,
      configFiles: eggsTable.configFiles,
      createdAt: eggsTable.createdAt,
    })
    .from(eggsTable)
    .leftJoin(nestsTable, eq(eggsTable.nestId, nestsTable.id))
    .where(eq(eggsTable.id, id));

  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  const variables = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, id));

  res.json({
    ...egg,
    nestName: egg.nestName ?? "Unknown",
    variables: variables.map((v) => ({
      ...v,
      userViewable: v.userViewable === "true",
      userEditable: v.userEditable === "true",
    })),
  });
});

router.patch("/eggs/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const parsed = UpdateEggBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [egg] = await db.update(eggsTable).set(parsed.data).where(eq(eggsTable.id, id)).returning();
  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  const nest = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, egg.nestId));
  res.json({ ...egg, nestName: nest[0]?.name ?? "Unknown" });
});

router.delete("/eggs/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [egg] = await db.delete(eggsTable).where(eq(eggsTable.id, id)).returning();
  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
