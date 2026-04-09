import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, serversTable, schedulesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: Router = Router();

router.get("/servers/:id/schedules", requireAuth, async (req, res): Promise<void> => {
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

  const schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.serverId, id));
  res.json(schedules.map((s) => ({ ...s, isEnabled: s.isEnabled === "true" })));
});

router.post("/servers/:id/schedules", requireAuth, async (req, res): Promise<void> => {
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

  const { name, cronMinute, cronHour, cronDayOfMonth, cronMonth, cronDayOfWeek, action, isEnabled } = req.body as {
    name: string;
    cronMinute: string;
    cronHour: string;
    cronDayOfMonth: string;
    cronMonth: string;
    cronDayOfWeek: string;
    action: "start" | "stop" | "restart" | "kill" | "backup";
    isEnabled: boolean;
  };

  const [schedule] = await db.insert(schedulesTable).values({
    serverId: id,
    name,
    cronMinute: cronMinute ?? "0",
    cronHour: cronHour ?? "*",
    cronDayOfMonth: cronDayOfMonth ?? "*",
    cronMonth: cronMonth ?? "*",
    cronDayOfWeek: cronDayOfWeek ?? "*",
    action: action ?? "restart",
    isEnabled: isEnabled ? "true" : "false",
  }).returning();

  res.status(201).json({ ...schedule, isEnabled: schedule.isEnabled === "true" });
});

router.patch("/servers/:id/schedules/:scheduleId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const rawSid = Array.isArray(req.params.scheduleId) ? req.params.scheduleId[0] : req.params.scheduleId;
  const scheduleId = parseInt(rawSid, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { isEnabled, ...rest } = req.body as { isEnabled?: boolean; [key: string]: unknown };
  const updateData: Record<string, unknown> = { ...rest };
  if (isEnabled !== undefined) updateData.isEnabled = isEnabled ? "true" : "false";

  const [schedule] = await db.update(schedulesTable).set(updateData).where(eq(schedulesTable.id, scheduleId)).returning();
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  res.json({ ...schedule, isEnabled: schedule.isEnabled === "true" });
});

router.delete("/servers/:id/schedules/:scheduleId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const rawSid = Array.isArray(req.params.scheduleId) ? req.params.scheduleId[0] : req.params.scheduleId;
  const scheduleId = parseInt(rawSid, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(schedulesTable).where(eq(schedulesTable.id, scheduleId));
  res.sendStatus(204);
});

export default router;
