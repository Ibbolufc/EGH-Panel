/**
 * WebSocket Console Server
 *
 * Provides real-time console output, power state changes, and stats
 * for server control. Each connection is authenticated via JWT query param.
 *
 * Client connects to: ws://HOST/ws?token=JWT&serverId=N
 *
 * Outgoing message format:
 *   { type: "console" | "status" | "stats" | "auth_error" | "not_found", data: string | object }
 *
 * Incoming message format:
 *   { event: "send_command", args: ["say hello"] }
 *   { event: "set_state", args: ["start"] }
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { db, serversTable, nodesTable } from "@workspace/db";
import { verifyToken } from "../lib/auth";
import { getProviderForNode } from "../providers/registry";
import type { ProviderNode, ProviderServer } from "../providers/types";
import { logger } from "../lib/logger";
import { mockProvider } from "../providers/mock";

interface WsClient {
  ws: WebSocket;
  serverId: number;
  userId: number;
  role: string;
  statsInterval: ReturnType<typeof setInterval> | null;
  consoleInterval: ReturnType<typeof setInterval> | null;
  lastLogIndex: number;
}

function send(ws: WebSocket, type: string, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

async function buildProviderContext(serverId: number): Promise<{
  providerServer: ProviderServer;
  providerNode: ProviderNode;
} | null> {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
  if (!server) return null;
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, server.nodeId));
  if (!node) return null;

  const providerNode: ProviderNode = {
    id: node.id,
    fqdn: node.fqdn,
    scheme: node.scheme,
    daemonPort: node.daemonPort,
    daemonToken: node.daemonToken,
  };
  const providerServer: ProviderServer = {
    id: server.id,
    uuid: server.uuid,
    node: providerNode,
    dockerImage: server.dockerImage,
    startup: server.startup,
    memoryLimit: server.memoryLimit,
    diskLimit: server.diskLimit,
    cpuLimit: server.cpuLimit,
  };

  return { providerServer, providerNode };
}

export function attachWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const serverIdRaw = url.searchParams.get("serverId");
    const serverId = parseInt(serverIdRaw ?? "", 10);

    if (!token || Number.isNaN(serverId)) {
      send(ws, "auth_error", "Missing token or serverId");
      ws.close(1008, "Bad request");
      return;
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      send(ws, "auth_error", "Invalid or expired token");
      ws.close(1008, "Unauthorized");
      return;
    }

    const ctx = await buildProviderContext(serverId);
    if (!ctx) {
      send(ws, "not_found", "Server not found");
      ws.close(1011, "Not found");
      return;
    }

    const [dbServer] = await db.select().from(serversTable).where(eq(serversTable.id, serverId));
    if (!dbServer) {
      ws.close(1011, "Not found");
      return;
    }

    if (payload.role === "client" && dbServer.userId !== payload.userId) {
      send(ws, "auth_error", "Access denied");
      ws.close(1008, "Forbidden");
      return;
    }

    const provider = getProviderForNode(ctx.providerNode);

    logger.info({ serverId, userId: payload.userId }, "WebSocket client connected");

    send(ws, "status", { status: dbServer.status });

    const recentLogs = mockProvider.getRecentLogs(serverId);
    for (const line of recentLogs) {
      send(ws, "console", line);
    }

    const client: WsClient = {
      ws,
      serverId,
      userId: payload.userId,
      role: payload.role,
      statsInterval: null,
      consoleInterval: null,
      lastLogIndex: recentLogs.length,
    };

    client.statsInterval = setInterval(async () => {
      try {
        const stats = await provider.getStats(ctx.providerServer);
        send(ws, "stats", stats);
      } catch {
      }
    }, 5000);

    client.consoleInterval = setInterval(() => {
      const logs = mockProvider.getRecentLogs(serverId);
      const newLogs = logs.slice(client.lastLogIndex);
      for (const line of newLogs) {
        send(ws, "console", line);
      }
      client.lastLogIndex = logs.length;
    }, 500);

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { event?: string; args?: string[] };
        if (!msg.event) return;

        switch (msg.event) {
          case "send_command": {
            const command = msg.args?.[0];
            if (!command) break;
            await provider.sendCommand(ctx.providerServer, command);
            break;
          }
          case "set_state": {
            if (client.role === "client") break;
            const action = msg.args?.[0] as "start" | "stop" | "restart" | "kill" | undefined;
            if (!action) break;
            await provider.powerAction(ctx.providerServer, action);
            const statusMap: Record<string, string> = { start: "running", stop: "offline", restart: "running", kill: "offline" };
            await db.update(serversTable).set({ status: statusMap[action] as typeof dbServer.status }).where(eq(serversTable.id, serverId));
            send(ws, "status", { status: statusMap[action] });
            break;
          }
        }
      } catch (err) {
        logger.error({ err }, "WebSocket message error");
      }
    });

    ws.on("close", () => {
      if (client.statsInterval) clearInterval(client.statsInterval);
      if (client.consoleInterval) clearInterval(client.consoleInterval);
      logger.info({ serverId, userId: payload.userId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, serverId }, "WebSocket error");
    });
  });

  return wss;
}
