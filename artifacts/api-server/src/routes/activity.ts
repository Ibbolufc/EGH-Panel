import { Router } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, activityLogsTable, usersTable, serversTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: Router = Router();

router.get("/activity", requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const offset = (page - 1) * limit;

  const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
  const serverId = req.query.serverId ? parseInt(String(req.query.serverId), 10) : undefined;

  const conditions = [];
  if (userId) conditions.push(eq(activityLogsTable.userId, userId));
  if (serverId) conditions.push(eq(activityLogsTable.serverId, serverId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db
      .select({
        id: activityLogsTable.id,
        userId: activityLogsTable.userId,
        userEmail: usersTable.email,
        serverId: activityLogsTable.serverId,
        serverName: serversTable.name,
        event: activityLogsTable.event,
        description: activityLogsTable.description,
        ip: activityLogsTable.ip,
        createdAt: activityLogsTable.createdAt,
      })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
      .leftJoin(serversTable, eq(activityLogsTable.serverId, serversTable.id))
      .where(whereClause)
      .orderBy(activityLogsTable.createdAt)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(activityLogsTable).where(whereClause),
  ]);

  res.json({ data: logs, total: Number(total), page, limit });
});

export default router;
