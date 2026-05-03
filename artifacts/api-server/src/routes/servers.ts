import { Router } from "express";
import { eq, and, ilike, count } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  serversTable,
  allocationsTable,
  eggVariablesTable,
  serverVariablesTable,
  eggsTable,
} from "@workspace/db";
import { CreateServerBody, UpdateServerBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { asyncHandler } from "../middleware/errorHandler";
import { parseIntParam, validateBody } from "../middleware/validate";
import {
  formatServer,
  executePowerAction,
  getServerStartupVars,
  updateServerStartupVars,
  buildProviderServer,
} from "../services/serverService";
import { getProviderForNode } from "../providers/registry";

const router: Router = Router();

const PowerActionBody = z.object({
  action: z.enum(["start", "stop", "restart", "kill"]),
});

const UpdateStartupBody = z.object({
  startup: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

router.get("/servers", requireAuth, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (req.user?.role === "client") {
    conditions.push(eq(serversTable.userId, req.user.userId));
  } else {
    if (req.query.userId) conditions.push(eq(serversTable.userId, parseInt(String(req.query.userId), 10)));
    if (req.query.nodeId) conditions.push(eq(serversTable.nodeId, parseInt(String(req.query.nodeId), 10)));
    if (req.query.search) conditions.push(ilike(serversTable.name, `%${req.query.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [servers, [{ total }]] = await Promise.all([
    db.select().from(serversTable).where(whereClause).limit(limit).offset(offset),
    db.select({ total: count() }).from(serversTable).where(whereClause),
  ]);

  const data = await Promise.all(servers.map(formatServer));
  res.json({ data, total: Number(total), page, limit });
}));

router.post("/servers", requireAdmin, validateBody(CreateServerBody), asyncHandler(async (req, res) => {
  const { variables, ...serverData } = req.body as z.infer<typeof CreateServerBody>;

  const [egg] = await db.select().from(eggsTable).where(eq(eggsTable.id, serverData.eggId));

  const [server] = await db.insert(serversTable).values({
    ...serverData,
    status: "installing",
    startup: serverData.startup ?? egg?.startup,
    dockerImage: serverData.dockerImage ?? egg?.dockerImage,
  }).returning();

  await db.update(allocationsTable).set({ serverId: server.id }).where(eq(allocationsTable.id, server.allocationId));

  const eggVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, serverData.eggId));
  if (eggVars.length > 0) {
    await db.insert(serverVariablesTable).values(
      eggVars.map((eggVar) => ({
        serverId: server.id,
        envVariable: eggVar.envVariable,
        value: (variables as Record<string, string>)?.[eggVar.envVariable] ?? eggVar.defaultValue,
      })),
    );
  }

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: server.id,
    event: "server.created",
    description: `Server "${server.name}" created`,
  });

  // Best-effort: send full server config to the daemon and trigger install.
  // For a real Wings daemon the install is async — status stays "installing"
  // until Wings POSTs back to /api/remote/servers/:uuid/install.
  // For the mock provider (no daemon) the provision is synchronous, so we
  // advance status to "offline" immediately so the server becomes usable.
  // Non-fatal if the node is offline; admin can retry via reinstall later.
  try {
    const { providerServer } = await buildProviderServer(server.id);
    const provider = getProviderForNode(providerServer.node);
    await provider.provisionServer(providerServer);
    if (provider.name === "mock") {
      await db.update(serversTable).set({ status: "offline" }).where(eq(serversTable.id, server.id));
    }
  } catch (err) {
    // Daemon unreachable or node not configured yet — server stays "installing"
    req.log.warn({ serverId: server.id, err }, "[servers] Daemon provisioning failed");
  }

  res.status(201).json(await formatServer(server));
}));

router.get("/servers/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [formatted, serverVars, eggVars] = await Promise.all([
    formatServer(server),
    db.select().from(serverVariablesTable).where(eq(serverVariablesTable.serverId, id)),
    db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, server.eggId)),
  ]);

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

  res.json({ ...formatted, variables });
}));

router.patch("/servers/:id", requireAdmin, validateBody(UpdateServerBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.update(serversTable).set(req.body as z.infer<typeof UpdateServerBody>).where(eq(serversTable.id, id)).returning();
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  res.json(await formatServer(server));
}));

router.delete("/servers/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  // Best-effort: ask daemon to destroy the container and volumes before we
  // remove the DB record.  Non-fatal — proceed with deletion regardless.
  try {
    const { providerServer } = await buildProviderServer(id);
    await getProviderForNode(providerServer.node).deleteServer(providerServer);
  } catch (err) {
    // Daemon offline, node not configured, or server was never provisioned
    console.warn(`[servers] Daemon delete failed for server ${id}: ${err instanceof Error ? err.message : String(err)}`);
  }

  await db.delete(serversTable).where(eq(serversTable.id, id));
  await db.update(allocationsTable).set({ serverId: null }).where(eq(allocationsTable.serverId, id));

  await logActivity({
    req,
    userId: req.user?.userId,
    event: "server.deleted",
    description: `Server "${server.name}" deleted`,
  });

  res.sendStatus(204);
}));

router.post("/servers/:id/power", requireAuth, validateBody(PowerActionBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { action } = req.body as z.infer<typeof PowerActionBody>;
  await executePowerAction(req, id, action);
  res.json({ message: `Power action '${action}' executed` });
}));

router.post("/servers/:id/reinstall", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).installServer(providerServer);
  await db.update(serversTable).set({ status: "installing" }).where(eq(serversTable.id, id));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId: id,
    event: "server.reinstall",
    description: `Server "${server.name}" reinstall initiated`,
  });

  res.json({ message: "Reinstall initiated" });
}));

router.get("/servers/:id/startup", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const data = await getServerStartupVars(id);
  res.json(data);
}));

router.patch("/servers/:id/startup", requireAuth, validateBody(UpdateStartupBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { variables, startup } = req.body as z.infer<typeof UpdateStartupBody>;
  await updateServerStartupVars(req, id, variables ?? {}, startup);
  res.json({ message: "Startup variables updated" });
}));

router.get("/servers/:id/stats", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { providerServer } = await buildProviderServer(id);
  const stats = await getProviderForNode(providerServer.node).getStats(providerServer);
  res.json(stats);
}));

export default router;
