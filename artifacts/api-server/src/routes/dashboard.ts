import { Router } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, usersTable, serversTable, nodesTable, eggsTable, activityLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: Router = Router();

router.get("/dashboard/admin-stats", requireAdmin, async (req, res): Promise<void> => {
  const [
    [{ totalUsers }],
    [{ totalServers }],
    [{ totalNodes }],
    [{ totalEggs }],
    serverStatuses,
    nodeStatuses,
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ totalServers: count() }).from(serversTable),
    db.select({ totalNodes: count() }).from(nodesTable),
    db.select({ totalEggs: count() }).from(eggsTable),
    db.select({ status: serversTable.status, count: count() }).from(serversTable).groupBy(serversTable.status),
    db.select({ status: nodesTable.status, count: count() }).from(nodesTable).groupBy(nodesTable.status),
  ]);

  const serverCountByStatus = Object.fromEntries(serverStatuses.map((s) => [s.status, Number(s.count)]));
  const nodeCountByStatus = Object.fromEntries(nodeStatuses.map((n) => [n.status, Number(n.count)]));

  res.json({
    totalUsers: Number(totalUsers),
    totalServers: Number(totalServers),
    totalNodes: Number(totalNodes),
    totalEggs: Number(totalEggs),
    activeServers: serverCountByStatus.running ?? 0,
    offlineServers: serverCountByStatus.offline ?? 0,
    installingServers: serverCountByStatus.installing ?? 0,
    suspendedServers: serverCountByStatus.suspended ?? 0,
    onlineNodes: nodeCountByStatus.online ?? 0,
    offlineNodes: nodeCountByStatus.offline ?? 0,
  });
});

router.get("/dashboard/client-stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const servers = await db.select({
    status: serversTable.status,
    diskLimit: serversTable.diskLimit,
    memoryLimit: serversTable.memoryLimit,
  }).from(serversTable).where(eq(serversTable.userId, userId));

  const totalServers = servers.length;
  const runningServers = servers.filter((s) => s.status === "running").length;
  const offlineServers = servers.filter((s) => s.status === "offline").length;
  const totalDiskUsed = servers.reduce((acc, s) => acc + (s.diskLimit ?? 0), 0);
  const totalMemoryAllocated = servers.reduce((acc, s) => acc + (s.memoryLimit ?? 0), 0);

  res.json({
    totalServers,
    runningServers,
    offlineServers,
    totalDiskUsed,
    totalMemoryAllocated,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);

  const conditions = req.user?.role === "client"
    ? [eq(activityLogsTable.userId, req.user.userId)]
    : [];

  const logs = await db
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
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(limit);

  res.json(logs);
});

router.get("/dashboard/server-status-summary", requireAuth, async (req, res): Promise<void> => {
  const conditions = req.user?.role === "client"
    ? eq(serversTable.userId, req.user.userId)
    : undefined;

  const statusCounts = await db
    .select({ status: serversTable.status, count: count() })
    .from(serversTable)
    .where(conditions)
    .groupBy(serversTable.status);

  const summary = {
    running: 0,
    offline: 0,
    installing: 0,
    suspended: 0,
    starting: 0,
    stopping: 0,
  };

  for (const row of statusCounts) {
    if (row.status in summary) {
      summary[row.status as keyof typeof summary] = Number(row.count);
    }
  }

  res.json(summary);
});

export default router;
