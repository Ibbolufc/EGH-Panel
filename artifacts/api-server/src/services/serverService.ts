/**
 * ServerService
 *
 * Business logic for server lifecycle operations.
 * Routes call this service; the service uses the provider registry.
 */

import { eq, and } from "drizzle-orm";
import {
  db,
  serversTable,
  nodesTable,
  usersTable,
  eggsTable,
  allocationsTable,
  eggVariablesTable,
  serverVariablesTable,
} from "@workspace/db";
import type { PowerAction, ProviderServer, ProviderNode } from "../providers/types";
import { ProviderError } from "../providers/types";
import { getProviderForNode } from "../providers/registry";
import { logActivity } from "../lib/activity";
import type { Request } from "express";

export async function buildProviderServer(serverId: number): Promise<{
  providerServer: ProviderServer;
  dbServer: typeof serversTable.$inferSelect;
}> {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
  if (!server) throw new ProviderError("Server not found", "NOT_FOUND", 404);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, server.nodeId));
  if (!node) throw new ProviderError("Node not found", "NOT_FOUND", 404);

  // daemonToken is the explicit per-node secret set after Wings connects;
  // fall back to registrationToken (same value Wings stores as `token:` in
  // its config.yml) so JWT auth works for any node that has completed install.
  const providerNode: ProviderNode = {
    id: node.id,
    fqdn: node.fqdn,
    scheme: node.scheme,
    daemonPort: node.daemonPort,
    daemonToken: node.daemonToken ?? node.registrationToken,
  };

  const [allocation] = await db
    .select({ ip: allocationsTable.ip, port: allocationsTable.port })
    .from(allocationsTable)
    .where(eq(allocationsTable.id, server.allocationId));

  const serverVars = await db
    .select({ envVariable: serverVariablesTable.envVariable, value: serverVariablesTable.value })
    .from(serverVariablesTable)
    .where(eq(serverVariablesTable.serverId, serverId));

  const environment: Record<string, string> = {};
  for (const v of serverVars) environment[v.envVariable] = v.value ?? "";

  const providerServer: ProviderServer = {
    id: server.id,
    uuid: server.uuid,
    node: providerNode,
    dockerImage: server.dockerImage,
    startup: server.startup,
    memoryLimit: server.memoryLimit,
    diskLimit: server.diskLimit,
    cpuLimit: server.cpuLimit,
    allocationIp: allocation?.ip ?? "0.0.0.0",
    allocationPort: allocation?.port ?? 0,
    environment,
  };

  return { providerServer, dbServer: server };
}

export async function formatServer(server: typeof serversTable.$inferSelect) {
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
    startup: server.startup,
    dockerImage: server.dockerImage,
    createdAt: server.createdAt,
  };
}

const STATUS_MAP: Record<PowerAction, typeof serversTable.$inferSelect["status"]> = {
  start: "running",
  stop: "offline",
  restart: "running",
  kill: "offline",
};

export async function executePowerAction(
  req: Request,
  serverId: number,
  action: PowerAction,
): Promise<void> {
  const { providerServer, dbServer } = await buildProviderServer(serverId);
  const provider = getProviderForNode(providerServer.node);

  await provider.powerAction(providerServer, action);

  const newStatus = STATUS_MAP[action];
  await db.update(serversTable).set({ status: newStatus }).where(eq(serversTable.id, serverId));

  await logActivity({
    req,
    userId: req.user?.userId,
    serverId,
    event: `server.${action}`,
    description: `Server "${dbServer.name}" ${action} action executed`,
  });
}

export async function getServerStartupVars(serverId: number) {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
  if (!server) throw new ProviderError("Server not found", "NOT_FOUND", 404);

  const eggVars = await db.select().from(eggVariablesTable).where(eq(eggVariablesTable.eggId, server.eggId));
  const serverVars = await db.select().from(serverVariablesTable).where(eq(serverVariablesTable.serverId, serverId));

  const varMap: Record<string, string> = {};
  for (const v of serverVars) varMap[v.envVariable] = v.value;

  return {
    startup: server.startup ?? "",
    dockerImage: server.dockerImage ?? "",
    variables: eggVars.map((ev) => ({
      name: ev.name,
      description: ev.description ?? "",
      envVariable: ev.envVariable,
      defaultValue: ev.defaultValue ?? "",
      currentValue: varMap[ev.envVariable] ?? ev.defaultValue ?? "",
      rules: ev.rules ?? "",
      userViewable: ev.userViewable === "true",
      userEditable: ev.userEditable === "true",
    })),
  };
}

export async function updateServerStartupVars(
  req: Request,
  serverId: number,
  variables: Record<string, string>,
  startup?: string,
): Promise<void> {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
  if (!server) throw new ProviderError("Server not found", "NOT_FOUND", 404);

  for (const [envVar, value] of Object.entries(variables)) {
    const [eggVar] = await db
      .select()
      .from(eggVariablesTable)
      .where(and(eq(eggVariablesTable.eggId, server.eggId), eq(eggVariablesTable.envVariable, envVar)));

    if (req.user?.role === "client" && eggVar?.userEditable !== "true") continue;

    const existing = await db
      .select()
      .from(serverVariablesTable)
      .where(and(eq(serverVariablesTable.serverId, serverId), eq(serverVariablesTable.envVariable, envVar)));

    if (existing.length > 0) {
      await db
        .update(serverVariablesTable)
        .set({ value })
        .where(and(eq(serverVariablesTable.serverId, serverId), eq(serverVariablesTable.envVariable, envVar)));
    } else {
      await db.insert(serverVariablesTable).values({ serverId, envVariable: envVar, value });
    }
  }

  if (startup && (req.user?.role === "admin" || req.user?.role === "super_admin")) {
    await db.update(serversTable).set({ startup }).where(eq(serversTable.id, serverId));
  }
}
