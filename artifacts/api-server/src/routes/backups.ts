import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, serversTable, backupsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: Router = Router();

router.get("/servers/:id/backups", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const backups = await db.select().from(backupsTable).where(eq(backupsTable.serverId, id));
  res.json(backups);
});

router.post("/servers/:id/backups", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const name = String(req.body.name ?? `Backup ${new Date().toLocaleString()}`);
  const [backup] = await db.insert(backupsTable).values({
    serverId: id,
    name,
    size: 0,
    status: "in_progress",
  }).returning();

  // Simulate completion after a short time
  setTimeout(async () => {
    await db.update(backupsTable).set({
      status: "completed",
      size: Math.floor(Math.random() * 500000000) + 50000000,
      completedAt: new Date(),
    }).where(eq(backupsTable.id, backup.id));
  }, 3000);

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "backup.created",
    description: `Backup '${name}' created for server ${server.name}`,
  });

  res.status(201).json(backup);
});

router.delete("/servers/:id/backups/:backupId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const rawBid = Array.isArray(req.params.backupId) ? req.params.backupId[0] : req.params.backupId;
  const backupId = parseInt(rawBid, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(backupsTable).where(eq(backupsTable.id, backupId));
  res.sendStatus(204);
});

router.post("/servers/:id/backups/:backupId/restore", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "backup.restore",
    description: `Backup restore initiated for server ${server.name}`,
  });

  res.json({ message: "Backup restore initiated" });
});

export default router;
