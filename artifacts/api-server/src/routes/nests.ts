import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, nestsTable, eggsTable } from "@workspace/db";
import { CreateNestBody } from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../lib/auth";

const router: Router = Router();

router.get("/nests", requireAuth, async (req, res): Promise<void> => {
  const nests = await db
    .select({
      id: nestsTable.id,
      name: nestsTable.name,
      description: nestsTable.description,
      createdAt: nestsTable.createdAt,
      eggCount: count(eggsTable.id),
    })
    .from(nestsTable)
    .leftJoin(eggsTable, eq(eggsTable.nestId, nestsTable.id))
    .groupBy(nestsTable.id);

  res.json(nests.map((n) => ({
    ...n,
    eggCount: Number(n.eggCount),
  })));
});

router.post("/nests", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateNestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [nest] = await db.insert(nestsTable).values(parsed.data).returning();
  res.status(201).json({ ...nest, eggCount: 0 });
});

router.get("/nests/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [result] = await db
    .select({
      id: nestsTable.id,
      name: nestsTable.name,
      description: nestsTable.description,
      createdAt: nestsTable.createdAt,
      eggCount: count(eggsTable.id),
    })
    .from(nestsTable)
    .leftJoin(eggsTable, eq(eggsTable.nestId, nestsTable.id))
    .where(eq(nestsTable.id, id))
    .groupBy(nestsTable.id);

  if (!result) {
    res.status(404).json({ error: "Nest not found" });
    return;
  }

  res.json({ ...result, eggCount: Number(result.eggCount) });
});

router.patch("/nests/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const parsed = CreateNestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [nest] = await db.update(nestsTable).set(parsed.data).where(eq(nestsTable.id, id)).returning();
  if (!nest) {
    res.status(404).json({ error: "Nest not found" });
    return;
  }
  res.json({ ...nest, eggCount: 0 });
});

router.delete("/nests/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [nest] = await db.delete(nestsTable).where(eq(nestsTable.id, id)).returning();
  if (!nest) {
    res.status(404).json({ error: "Nest not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
