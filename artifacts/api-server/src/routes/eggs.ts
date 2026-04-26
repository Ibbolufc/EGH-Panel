/**
 * Eggs & Nests Routes
 *
 * Supports manual egg creation and Pterodactyl egg JSON import.
 * Import endpoint validates both legacy Pterodactyl egg JSON and PTDL_v2
 * before inserting.
 *
 * Preview mode: POST /api/eggs/import/preview returns parsed egg data
 * without writing to the database.
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

const LegacyVariableSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  env_variable: z.string(),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional().default(""),
  user_viewable: z.union([z.boolean(), z.number()]).optional().default(true),
  user_editable: z.union([z.boolean(), z.number()]).optional().default(false),
  rules: z.string().optional().default(""),
});

const LegacyEggSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  startup: z.string().min(1),
  docker_image: z.string().optional(),
  docker_images: z.record(z.string(), z.string()).optional(),
  variables: z.array(LegacyVariableSchema).optional().default([]),
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

const PTDLv2VariableSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  env_variable: z.string(),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional().default(""),
  user_viewable: z.union([z.boolean(), z.number()]).optional().default(true),
  user_editable: z.union([z.boolean(), z.number()]).optional().default(false),
  rules: z.string().optional().default(""),
});

const PTDLv2EggSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  startup: z.string().min(1),
  docker_image: z.string().optional(),
  docker_images: z.record(z.string(), z.string()).optional(),
  variables: z.array(PTDLv2VariableSchema).optional().default([]),
  scripts: z
    .object({
      installation: z
        .object({
          script: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  nest: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
  meta: z
    .object({
      version: z.string().optional(),
    })
    .optional(),
});

const ImportEggBody = z
  .object({
    json: z.unknown().optional(),
    eggJson: z.unknown().optional(),
    nestId: z.number().int().positive().optional(),
  })
  .refine((data) => data.json !== undefined || data.eggJson !== undefined, {
    message: "Either 'json' or 'eggJson' is required",
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

function boolish(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function stringifyDefault(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parsePterodactylEgg(raw: unknown) {
  const legacy = LegacyEggSchema.safeParse(raw);
  if (legacy.success) {
    const data = legacy.data;

    const dockerImages = data.docker_images
      ? Object.values(data.docker_images)
      : data.docker_image
        ? [data.docker_image]
        : [];

    const dockerImage =
      data.docker_image ??
      dockerImages[0] ??
      "ghcr.io/pterodactyl/yolks:debian";

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
        defaultValue: stringifyDefault(v.default_value),
        userViewable: boolish(v.user_viewable, true),
        userEditable: boolish(v.user_editable, false),
        rules: v.rules || "",
      })),
    };
  }

  const v2 = PTDLv2EggSchema.safeParse(raw);
  if (v2.success) {
    const data = v2.data;

    const dockerImages = data.docker_images
      ? Object.values(data.docker_images)
      : data.docker_image
        ? [data.docker_image]
        : [];

    const dockerImage =
      data.docker_image ??
      dockerImages[0] ??
      "ghcr.io/pterodactyl/yolks:debian";

    return {
      success: true as const,
      egg: {
        name: data.name,
        description: data.description ?? null,
        startup: data.startup,
        dockerImage,
        dockerImages,
        installScript: data.scripts?.installation?.script ?? null,
        nestName: data.nest?.name ?? "Imported",
      },
      variables: (data.variables ?? []).map((v) => ({
        name: v.name,
        description: v.description || null,
        envVariable: v.env_variable,
        defaultValue: stringifyDefault(v.default_value),
        userViewable: boolish(v.user_viewable, true),
        userEditable: boolish(v.user_editable, false),
        rules: v.rules || "",
      })),
    };
  }

  const error =
    legacy.error?.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") ||
    v2.error?.issues?.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") ||
    "Unsupported egg format";

  return { success: false as const, error };
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
  const body = req.body as z.infer<typeof ImportEggBody>;
  const json = body.json ?? body.eggJson;
  const result = parsePterodactylEgg(json);

  if (!result.success) {
    res.status(400).json({ error: "Invalid Pterodactyl egg JSON", details: result.error });
    return;
  }

  res.json({ egg: result.egg, variables: result.variables });
}));

router.post("/eggs/import", requireAdmin, validateBody(ImportEggBody), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof ImportEggBody>;
  const json = body.json ?? body.eggJson;
  const overrideNestId = body.nestId;

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

  const data = req.body as z.infer<typeof UpdateEggBody>;
  const { variables, ...eggUpdates } = data;

  const [updatedEgg] = await db.update(eggsTable).set(eggUpdates).where(eq(eggsTable.id, id)).returning();

  if (!updatedEgg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  if (variables && variables.length > 0) {
    for (const variable of variables) {
      await db.update(eggVariablesTable).set({
        ...(variable.name !== undefined ? { name: variable.name } : {}),
        ...(variable.description !== undefined ? { description: variable.description } : {}),
        ...(variable.defaultValue !== undefined ? { defaultValue: variable.defaultValue } : {}),
        ...(variable.userViewable !== undefined ? { userViewable: String(variable.userViewable) } : {}),
        ...(variable.userEditable !== undefined ? { userEditable: String(variable.userEditable) } : {}),
        ...(variable.rules !== undefined ? { rules: variable.rules } : {}),
      }).where(eq(eggVariablesTable.id, variable.id));
    }
  }

  const [nest] = await db.select({ name: nestsTable.name }).from(nestsTable).where(eq(nestsTable.id, updatedEgg.nestId));

  res.json({
    ...updatedEgg,
    nestName: nest?.name ?? "Unknown",
  });
}));

router.delete("/eggs/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  await db.delete(eggVariablesTable).where(eq(eggVariablesTable.eggId, id));

  const [deletedEgg] = await db.delete(eggsTable).where(eq(eggsTable.id, id)).returning();

  if (!deletedEgg) {
    res.status(404).json({ error: "Egg not found" });
    return;
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "egg.deleted",
    description: `Deleted egg: "${deletedEgg.name}"`,
  });

  res.sendStatus(204);
}));

export default router;
