import { Router } from "express";
import { eq, and, ilike, count } from "drizzle-orm";
import { db, serversTable, usersTable, nodesTable, eggsTable, allocationsTable, serverVariablesTable, eggVariablesTable } from "@workspace/db";
import { CreateServerBody, UpdateServerBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: Router = Router();

// Helper to format server response
async function formatServer(server: typeof serversTable.$inferSelect) {
  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, server.userId));
  const [node] = await db.select({ name: nodesTable.name }).from(nodesTable).where(eq(nodesTable.id, server.nodeId));
  const [egg] = await db.select({ name: eggsTable.name }).from(eggsTable).where(eq(eggsTable.id, server.eggId));
  const [allocation] = await db.select({ ip: allocationsTable.ip, port: allocationsTable.port }).from(allocationsTable).where(eq(allocationsTable.id, server.allocationId));

  return {
    id: server.id,
    uuid: server.uuid,
    name: server.name,
    description: server.description,
    userId: server.userId,
    userEmail: user?.email ?? "unknown",
    nodeId: server.nodeId,
    nodeName: node?.name ?? "unknown",
    eggId: server.eggId,
    eggName: egg?.name ?? "unknown",
    allocationId: server.allocationId,
    allocationIp: allocation?.ip ?? "0.0.0.0",
    allocationPort: allocation?.port ?? 0,
    status: server.status,
    memoryLimit: server.memoryLimit,
    diskLimit: server.diskLimit,
    cpuLimit: server.cpuLimit,
    createdAt: server.createdAt,
  };
}

router.get("/servers", requireAuth, async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const conditions = [];

  // Non-admins only see their own servers
  if (req.user?.role === "client") {
    conditions.push(eq(serversTable.userId, req.user.userId));
  } else {
    if (req.query.userId) conditions.push(eq(serversTable.userId, parseInt(String(req.query.userId), 10)));
    if (req.query.nodeId) conditions.push(eq(serversTable.nodeId, parseInt(String(req.query.nodeId), 10)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [servers, [{ total }]] = await Promise.all([
    db.select().from(serversTable).where(whereClause).limit(limit).offset(offset),
    db.select({ total: count() }).from(serversTable).where(whereClause),
  ]);

  const formatted = await Promise.all(servers.map(formatServer));
  res.json({ data: formatted, total: Number(total), page, limit });
});

router.post("/servers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateServerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { variables, ...serverData } = parsed.data;

  // Get egg defaults
  const [egg] = await db.select().from(eggsTable).where(eq(eggsTable.id, serverData.eggId));

  const [server] = await db.insert(serversTable).values({
    ...serverData,
    status: "installing",
    startup: serverData.startup ?? egg?.startup,
    dockerImage: serverData.dockerImage ?? egg?.dockerImage,
  }).returning();

  // Mark allocation as assigned
  await db.update(allocationsTable).set({ serverId: server.id }).where(eq(allocationsTable.id, server.allocationId));

  // Set up server variables from egg defaults
  const eggVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, serverData.eggId));
  for (const eggVar of eggVars) {
    const value = (variables as Record<string, string>)?.[eggVar.envVariable] ?? eggVar.defaultValue;
    await db.insert(serverVariablesTable).values({
      serverId: server.id,
      envVariable: eggVar.envVariable,
      value,
    });
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: server.id,
    event: "server.created",
    description: `Server ${server.name} created`,
  });

  const formatted = await formatServer(server);
  res.status(201).json(formatted);
});

router.get("/servers/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  // Check access for clients
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const formatted = await formatServer(server);

  // Get variables
  const serverVars = await db.select().from(serverVariablesTable).where(eq(serverVariablesTable.serverId, id));
  const eggVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, server.eggId));

  const variables = eggVars.map((eggVar) => {
    const serverVar = serverVars.find((sv) => sv.envVariable === eggVar.envVariable);
    return {
      id: serverVar?.id ?? 0,
      serverId: id,
      name: eggVar.name,
      envVariable: eggVar.envVariable,
      value: serverVar?.value ?? eggVar.defaultValue,
      description: eggVar.description,
      userViewable: eggVar.userViewable === "true",
      userEditable: eggVar.userEditable === "true",
      rules: eggVar.rules,
    };
  });

  res.json({
    ...formatted,
    variables,
    dockerImage: server.dockerImage ?? "",
    startup: server.startup ?? "",
  });
});

router.patch("/servers/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const parsed = UpdateServerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [server] = await db.update(serversTable).set(parsed.data).where(eq(serversTable.id, id)).returning();
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  const formatted = await formatServer(server);
  res.json(formatted);
});

router.delete("/servers/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.delete(serversTable).where(eq(serversTable.id, id)).returning();
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  // Release allocation
  await db.update(allocationsTable).set({ serverId: null }).where(eq(allocationsTable.serverId, id));

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "server.deleted",
    description: `Server ${server.name} deleted`,
  });

  res.sendStatus(204);
});

router.post("/servers/:id/power", requireAuth, async (req, res): Promise<void> => {
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

  const action = req.body.action as string;
  const validActions = ["start", "stop", "restart", "kill"];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  // Mock status change
  const statusMap: Record<string, "running" | "offline" | "starting" | "stopping"> = {
    start: "running",
    stop: "offline",
    restart: "running",
    kill: "offline",
  };

  await db.update(serversTable).set({ status: statusMap[action] }).where(eq(serversTable.id, id));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: `server.power.${action}`,
    description: `Power action '${action}' sent to server ${server.name}`,
  });

  res.json({ message: `Power action '${action}' sent` });
});

router.post("/servers/:id/reinstall", requireAuth, async (req, res): Promise<void> => {
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

  await db.update(serversTable).set({ status: "installing" }).where(eq(serversTable.id, id));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "server.reinstall",
    description: `Server ${server.name} reinstall initiated`,
  });

  res.json({ message: "Reinstall initiated" });
});

router.get("/servers/:id/startup", requireAuth, async (req, res): Promise<void> => {
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

  const serverVars = await db.select().from(serverVariablesTable).where(eq(serverVariablesTable.serverId, id));
  const eggVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, server.eggId));

  const variables = eggVars.map((eggVar) => {
    const serverVar = serverVars.find((sv) => sv.envVariable === eggVar.envVariable);
    return {
      id: serverVar?.id ?? 0,
      serverId: id,
      name: eggVar.name,
      envVariable: eggVar.envVariable,
      value: serverVar?.value ?? eggVar.defaultValue,
      description: eggVar.description,
      userViewable: eggVar.userViewable === "true",
      userEditable: eggVar.userEditable === "true",
      rules: eggVar.rules,
    };
  });

  res.json(variables);
});

router.patch("/servers/:id/startup", requireAuth, async (req, res): Promise<void> => {
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

  const { variables, startup } = req.body as { variables: Record<string, string>; startup?: string };

  if (variables) {
    for (const [envVar, value] of Object.entries(variables)) {
      // Check if variable is editable for clients
      const [eggVar] = await db.select().from(eggVariablesTable)
        .where(and(eq(eggVariablesTable.eggId, server.eggId), eq(eggVariablesTable.envVariable, envVar)));

      if (req.user?.role === "client" && eggVar?.userEditable !== "true") continue;

      const existing = await db.select().from(serverVariablesTable)
        .where(and(eq(serverVariablesTable.serverId, id), eq(serverVariablesTable.envVariable, envVar)));

      if (existing.length > 0) {
        await db.update(serverVariablesTable).set({ value }).where(
          and(eq(serverVariablesTable.serverId, id), eq(serverVariablesTable.envVariable, envVar))
        );
      } else {
        await db.insert(serverVariablesTable).values({ serverId: id, envVariable: envVar, value });
      }
    }
  }

  if (startup && (req.user?.role === "admin" || req.user?.role === "super_admin")) {
    await db.update(serversTable).set({ startup }).where(eq(serversTable.id, id));
  }

  res.json({ message: "Startup variables updated" });
});

export default router;
