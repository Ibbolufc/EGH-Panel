/**
 * Eggs & Nests Routes
 *
 * Supports manual egg creation and Pterodactyl egg JSON import.
 * Import endpoint validates the egg JSON structure before inserting.
 *
 * Preview mode: POST /api/eggs/import/preview returns parsed egg data
 * without writing to the database — useful for showing a confirmation UI.
 */

import { Router } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { z } from "zod";
import { db, eggsTable, eggVariablesTable, nestsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { asyncHandler } from "../middleware/errorHandler";
import { parseIntParam, validateBody } from "../middleware/validate";

const router: Router = Router();

const PterodactylVariableSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  env_variable: z.string(),
  default_value: z.string().optional().default(""),
  user_viewable: z.union([z.boolean(), z.number()]).optional().default(true),
  user_editable: z.union([z.boolean(), z.number()]).optional().default(false),
  rules: z.string().optional().default(""),
});

const PterodactylEggSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  startup: z.string().min(1),
  docker_image: z.string().optional(),
  docker_images: z.record(z.string(), z.string()).optional(),
  variables: z.array(PterodactylVariableSchema).optional().default([]),
  script: z
    .object({
      install: z.string().optional(),
    })
    .optional(),
  nest: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  meta: z.object({ version: z.string().optional() }).optional(),
});

const ImportEggBody = z.object({
  json: z.unknown(),
  nestId: z.number().int().positive().optional(),
});

const CreateEggBody = z.object({
  nestId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  dockerImage: z.string().min(1),
  startup: z.string().min(1),
  installScript: z.string().optional(),
});

const UpdateEggVariableItem = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  userViewable: z.boolean().optional(),
  userEditable: z.boolean().optional(),
  rules: z.string().optional(),
});

const UpdateEggBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  dockerImage: z.string().min(1).optional(),
  startup: z.string().min(1).optional(),
  installScript: z.string().optional(),
  variables: z.array(UpdateEggVariableItem).optional(),
});

function parsePterodactylEgg(raw: unknown) {
  const parsed = PterodactylEggSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const data = parsed.data;

  const dockerImages =
    data.docker_images
      ? Object.keys(data.docker_images)
      : data.docker_image
        ? [data.docker_image]
        : [];

  const dockerImage =
    data.docker_image ?? dockerImages[0] ?? "ghcr.io/pterodactyl/yolks:debian";

  return {
    success: true as const,
    egg: {
      name: data.name,
      description: data.description ?? null,
      startup: data.startup,
      dockerImage,
      dockerImages,
      installScript: data.script?.install ?? null,
      nestName: data.nest?.name ?? "Imported",
    },
    variables: (data.variables ?? []).map((v) => ({
      name: v.name,
      description: v.description || null,
      envVariable: v.env_variable,
      defaultValue: String(v.default_value ?? ""),
      userViewable: Boolean(v.user_viewable),
      userEditable: Boolean(v.user_editable),
      rules: v.rules || "",
    })),
  };
}

router.get("/eggs", requireAuth, asyncHandler(async (req, res) => {
  const nestId = req.query.nestId ? parseInt(String(req.query.nestId), 10) : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const conditions = [];
  if (nestId && !Number.isNaN(nestId)) conditions.push(eq(eggsTable.nestId, nestId));
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
}));

router.post("/eggs", requireAdmin, validateBody(CreateEggBody), asyncHandler(async (req, res) => {
  const data = req.body as z.infer<typeof CreateEggBody>;
  const [egg] = await db.insert(eggsTable).values(data).returning();
  const [nest] = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, egg.nestId));
  res.status(201).json({ ...egg, nestName: nest?.name ?? "Unknown" });
}));

router.post("/eggs/import/preview", requireAdmin, validateBody(ImportEggBody), asyncHandler(async (req, res) => {
  const { json } = req.body as z.infer<typeof ImportEggBody>;
  const result = parsePterodactylEgg(json);

  if (!result.success) {
    res.status(400).json({ error: "Invalid Pterodactyl egg JSON", details: result.error });
    return;
  }

  res.json({ egg: result.egg, variables: result.variables });
}));

router.post("/eggs/import", requireAdmin, validateBody(ImportEggBody), asyncHandler(async (req, res) => {
  const { json, nestId: overrideNestId } = req.body as z.infer<typeof ImportEggBody>;
  const result = parsePterodactylEgg(json);

  if (!result.success) {
    res.status(400).json({ error: "Invalid Pterodactyl egg JSON", details: result.error });
    return;
  }

  const { egg: eggData, variables } = result;

  let nestId = overrideNestId;
  if (!nestId) {
    let [nest] = await db.select().from(nestsTable).where(eq(nestsTable.name, eggData.nestName));
    if (!nest) {
      const [created] = await db.insert(nestsTable).values({ name: eggData.nestName }).returning();
      nest = created;
    }
    nestId = nest.id;
  }

  const [egg] = await db.insert(eggsTable).values({
    nestId,
    name: eggData.name,
    description: eggData.description,
    dockerImage: eggData.dockerImage,
    dockerImages: eggData.dockerImages,
    startup: eggData.startup,
    installScript: eggData.installScript,
  }).returning();

  if (variables.length > 0) {
    await db.insert(eggVariablesTable).values(
      variables.map((v) => ({
        eggId: egg.id,
        name: v.name,
        description: v.description,
        envVariable: v.envVariable,
        defaultValue: v.defaultValue,
        userViewable: String(v.userViewable),
        userEditable: String(v.userEditable),
        rules: v.rules,
      })),
    );
  }

  const [nest] = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, nestId));

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "egg.imported",
    description: `Imported egg: "${egg.name}" into nest "${nest?.name}"`,
  });

  res.status(201).json({ ...egg, nestName: nest?.name ?? "Unknown", variableCount: variables.length });
}));

router.get("/eggs/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

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
}));

router.patch("/eggs/:id", requireAdmin, validateBody(UpdateEggBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const { variables, ...eggFields } = req.body as z.infer<typeof UpdateEggBody>;

  const hasEggFields = Object.keys(eggFields).length > 0;
  let egg: typeof eggsTable.$inferSelect | undefined;

  if (hasEggFields) {
    const [updated] = await db.update(eggsTable).set(eggFields).where(eq(eggsTable.id, id)).returning();
    egg = updated;
  } else {
    const [found] = await db.select().from(eggsTable).where(eq(eggsTable.id, id));
    egg = found;
  }

  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  if (variables && variables.length > 0) {
    for (const v of variables) {
      const { id: varId, userViewable, userEditable, ...rest } = v;
      const update: Record<string, unknown> = { ...rest };
      if (userViewable !== undefined) update.userViewable = String(userViewable);
      if (userEditable !== undefined) update.userEditable = String(userEditable);
      if (Object.keys(update).length === 0) continue;
      await db
        .update(eggVariablesTable)
        .set(update)
        .where(and(eq(eggVariablesTable.id, varId), eq(eggVariablesTable.eggId, id)));
    }
  }

  const [nest] = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, egg.nestId));
  const updatedVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, id));
  res.json({
    ...egg,
    nestName: nest?.name ?? "Unknown",
    variables: updatedVars.map((v) => ({
      ...v,
      userViewable: v.userViewable === "true",
      userEditable: v.userEditable === "true",
    })),
  });
}));

router.delete("/eggs/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [egg] = await db.delete(eggsTable).where(eq(eggsTable.id, id)).returning();
  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }
  res.sendStatus(204);
}));

const CreateEggVariableBody = z.object({
  name: z.string().min(1).max(255),
  envVariable: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultValue: z.string().optional().default(""),
  userViewable: z.boolean().optional().default(true),
  userEditable: z.boolean().optional().default(false),
  rules: z.string().optional().default(""),
});

router.post("/eggs/:id/variables", requireAdmin, validateBody(CreateEggVariableBody), asyncHandler(async (req, res) => {
  const eggId = parseIntParam(req, res, "id");
  if (eggId === null) return;

  const [egg] = await db.select({ id: eggsTable.id }).from(eggsTable).where(eq(eggsTable.id, eggId));
  if (!egg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  const data = req.body as z.infer<typeof CreateEggVariableBody>;
  const [variable] = await db.insert(eggVariablesTable).values({
    eggId,
    name: data.name,
    envVariable: data.envVariable,
    description: data.description ?? null,
    defaultValue: data.defaultValue ?? "",
    userViewable: String(data.userViewable ?? true),
    userEditable: String(data.userEditable ?? false),
    rules: data.rules ?? "",
  }).returning();

  res.status(201).json({
    ...variable,
    userViewable: variable.userViewable === "true",
    userEditable: variable.userEditable === "true",
  });
}));

router.delete("/eggs/:id/variables/:varId", requireAdmin, asyncHandler(async (req, res) => {
  const eggId = parseIntParam(req, res, "id");
  if (eggId === null) return;

  const varId = parseInt(req.params.varId, 10);
  if (Number.isNaN(varId)) {
    res.status(400).json({ error: "Invalid variable ID" });
    return;
  }

  const [deleted] = await db
    .delete(eggVariablesTable)
    .where(and(eq(eggVariablesTable.id, varId), eq(eggVariablesTable.eggId, eggId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Variable not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
