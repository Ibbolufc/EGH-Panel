import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, serversTable, schedulesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { parseIntParam, validateBody } from "../middleware/validate";

const router: Router = Router();

const CreateScheduleBody = z.object({
  name: z.string().min(1).max(255),
  cronMinute: z.string().default("0"),
  cronHour: z.string().default("*"),
  cronDayOfMonth: z.string().default("*"),
  cronMonth: z.string().default("*"),
  cronDayOfWeek: z.string().default("*"),
  action: z.enum(["start", "stop", "restart", "kill", "backup", "command"]).default("restart"),
  payload: z.string().max(512).optional(),
  isEnabled: z.boolean().default(true),
});

const UpdateScheduleBody = CreateScheduleBody.partial();

function formatSchedule(s: typeof schedulesTable.$inferSelect) {
  return { ...s, isEnabled: s.isEnabled === "true" };
}

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

router.get("/servers/:id/schedules", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await assertServerAccess(id, req, res))) return;
  const schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.serverId, id));
  res.json(schedules.map(formatSchedule));
}));

router.post("/servers/:id/schedules", requireAuth, validateBody(CreateScheduleBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await assertServerAccess(id, req, res))) return;

  const body = req.body as z.infer<typeof CreateScheduleBody>;
  if (body.action === "command" && !body.payload) {
    res.status(400).json({ error: "payload is required for command action" }); return;
  }

  const [schedule] = await db.insert(schedulesTable).values({
    serverId: id,
    name: body.name,
    cronMinute: body.cronMinute,
    cronHour: body.cronHour,
    cronDayOfMonth: body.cronDayOfMonth,
    cronMonth: body.cronMonth,
    cronDayOfWeek: body.cronDayOfWeek,
    action: body.action,
    payload: body.payload ?? null,
    isEnabled: body.isEnabled ? "true" : "false",
  }).returning();

  res.status(201).json(formatSchedule(schedule));
}));

router.patch("/servers/:id/schedules/:scheduleId", requireAuth, validateBody(UpdateScheduleBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  const scheduleId = parseIntParam(req, res, "scheduleId");
  if (scheduleId === null) return;
  if (!(await assertServerAccess(id, req, res))) return;

  const body = req.body as z.infer<typeof UpdateScheduleBody>;
  const updateData: Record<string, unknown> = { ...body };
  if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled ? "true" : "false";
  else delete updateData.isEnabled;

  const [schedule] = await db.update(schedulesTable).set(updateData).where(eq(schedulesTable.id, scheduleId)).returning();
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(formatSchedule(schedule));
}));

router.delete("/servers/:id/schedules/:scheduleId", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  const scheduleId = parseIntParam(req, res, "scheduleId");
  if (scheduleId === null) return;
  if (!(await assertServerAccess(id, req, res))) return;
  await db.delete(schedulesTable).where(eq(schedulesTable.id, scheduleId));
  res.sendStatus(204);
}));

export default router;
