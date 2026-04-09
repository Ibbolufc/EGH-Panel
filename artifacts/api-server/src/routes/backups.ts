import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, serversTable, backupsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { asyncHandler } from "../middleware/errorHandler";
import { parseIntParam, validateBody } from "../middleware/validate";
import { buildProviderServer } from "../services/serverService";
import { getProviderForNode } from "../providers/registry";

const router: Router = Router();

const CreateBackupBody = z.object({
  name: z.string().min(1).max(255).optional(),
});

async function assertServerAccess(
  serverId: number,
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
): Promise<typeof serversTable.$inferSelect | null> {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
  if (!server) { res.status(404).json({ error: "Server not found" }); return null; }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" }); return null;
  }
  return server;
}

router.get("/servers/:id/backups", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await assertServerAccess(id, req, res))) return;
  const backups = await db.select().from(backupsTable).where(eq(backupsTable.serverId, id));
  res.json(backups);
}));

router.post("/servers/:id/backups", requireAuth, validateBody(CreateBackupBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const server = await assertServerAccess(id, req, res);
  if (!server) return;

  const name = (req.body as z.infer<typeof CreateBackupBody>).name ?? `Backup ${new Date().toISOString()}`;

  const [backup] = await db.insert(backupsTable).values({
    serverId: id,
    name,
    size: 0,
    status: "in_progress",
  }).returning();

  const { providerServer } = await buildProviderServer(id);
  const provider = getProviderForNode(providerServer.node);

  provider.createBackup(providerServer, name).then(async () => {
    await db.update(backupsTable).set({
      status: "completed",
      size: Math.floor(Math.random() * 500_000_000) + 50_000_000,
      completedAt: new Date(),
    }).where(eq(backupsTable.id, backup.id));
  }).catch(async () => {
    await db.update(backupsTable).set({ status: "failed" }).where(eq(backupsTable.id, backup.id));
  });

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "backup.created",
    description: `Backup "${name}" initiated for server "${server.name}"`,
  });

  res.status(201).json(backup);
}));

router.delete("/servers/:id/backups/:backupId", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  const backupId = parseIntParam(req, res, "backupId");
  if (backupId === null) return;

  const server = await assertServerAccess(id, req, res);
  if (!server) return;

  const [backup] = await db.select().from(backupsTable).where(eq(backupsTable.id, backupId));
  if (!backup) { res.status(404).json({ error: "Backup not found" }); return; }

  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).deleteBackup(providerServer, String(backupId));
  await db.delete(backupsTable).where(eq(backupsTable.id, backupId));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "backup.deleted",
    description: `Backup "${backup.name}" deleted from server "${server.name}"`,
  });

  res.sendStatus(204);
}));

router.post("/servers/:id/backups/:backupId/restore", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  const backupId = parseIntParam(req, res, "backupId");
  if (backupId === null) return;

  const server = await assertServerAccess(id, req, res);
  if (!server) return;

  const [backup] = await db.select().from(backupsTable).where(eq(backupsTable.id, backupId));
  if (!backup) { res.status(404).json({ error: "Backup not found" }); return; }
  if (backup.status !== "completed") { res.status(400).json({ error: "Backup is not completed yet" }); return; }

  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).restoreBackup(providerServer, String(backupId));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "backup.restore",
    description: `Backup "${backup.name}" restore initiated for server "${server.name}"`,
  });

  res.json({ message: "Backup restore initiated" });
}));

export default router;
