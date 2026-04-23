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
 *
 * When the node uses WingsProvider, the API server opens a server-side
 * WebSocket to the daemon (`wss://{fqdn}:{port}/api/servers/{uuid}/ws`)
 * and proxies messages bidirectionally.  For MockProvider nodes the
 * existing in-memory log polling is used as a fallback.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { eq } from "drizzle-orm";
import { db, serversTable, nodesTable } from "@workspace/db";
import { verifyToken } from "../lib/auth";
import { getProviderForNode } from "../providers/registry";
import { makeWingsToken } from "../providers/wings";
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
  /** Live connection to the Wings daemon (only set when using WingsProvider) */
  daemonWs: WebSocket | null;
}

function send(ws: WebSocket, type: string, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

/** Convert Wings stats JSON payload to the panel's ServerStats shape */
function translateWingsStats(raw: Record<string, unknown>): object {
  const network = raw.network as Record<string, number> | undefined;
  return {
    cpuAbsolute: (raw.cpu_absolute as number) ?? 0,
    memoryBytes: (raw.memory_bytes as number) ?? 0,
    memoryLimitBytes: (raw.memory_limit_bytes as number) ?? 0,
    diskBytes: (raw.disk_bytes as number) ?? 0,
    networkRxBytes: network?.rx_bytes ?? 0,
    networkTxBytes: network?.tx_bytes ?? 0,
    uptime: (raw.uptime as number) ?? 0,
    state: (raw.state as string) ?? "unknown",
  };
}

/**
 * Open a server-side WebSocket to the Wings daemon and proxy events to the
 * panel client.  Returns the daemon WebSocket so the caller can close it.
 *
 * Wings events received:
 *   "console output"  → panel "console"
 *   "install output"  → panel "console"
 *   "status"          → panel "status"
 *   "stats"           → panel "stats" (JSON-parsed and translated)
 *   "auth success"    → logged only
 */
function openDaemonWebSocket(
  panelWs: WebSocket,
  server: ProviderServer,
  node: ProviderNode,
): WebSocket {
  const wsScheme = node.scheme === "https" ? "wss" : "ws";
  const url = `${wsScheme}://${node.fqdn}:${node.daemonPort}/api/servers/${server.uuid}/ws`;

  let token: string;
  try {
    token = makeWingsToken(node);
  } catch (err) {
    logger.error({ err, serverId: server.id }, "Cannot create daemon auth token for WebSocket");
    // Return a dummy closed WebSocket — caller checks readyState before use
    const dummy = new WebSocket("ws://127.0.0.1:1");
    dummy.on("open", () => dummy.close());
    return dummy;
  }

  const daemonWs = new WebSocket(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Daemon nodes may use self-signed TLS certs; the JWT provides auth
    rejectUnauthorized: false,
  });

  daemonWs.on("open", () => {
    logger.info({ serverId: server.id }, "Daemon WebSocket connected");
  });

  daemonWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { event?: string; args?: string[] };
      switch (msg.event) {
        case "console output":
        case "install output":
          send(panelWs, "console", msg.args?.[0] ?? "");
          break;
        case "status":
          send(panelWs, "status", { status: msg.args?.[0] ?? "unknown" });
          break;
        case "stats": {
          try {
            const statsRaw = JSON.parse(msg.args?.[0] ?? "{}") as Record<string, unknown>;
            send(panelWs, "stats", translateWingsStats(statsRaw));
          } catch {
            // Malformed stats payload — skip
          }
          break;
        }
        case "auth success":
          logger.debug({ serverId: server.id }, "Daemon WebSocket auth success");
          break;
        default:
          logger.debug({ event: msg.event, serverId: server.id }, "Unhandled daemon WS event");
      }
    } catch (err) {
      logger.error({ err }, "Failed to parse daemon WebSocket message");
    }
  });

  daemonWs.on("close", (code, reason) => {
    logger.info(
      { serverId: server.id, code, reason: reason.toString() },
      "Daemon WebSocket closed",
    );
    if (panelWs.readyState === WebSocket.OPEN) {
      panelWs.close(1011, "Daemon disconnected");
    }
  });

  daemonWs.on("error", (err) => {
    logger.error({ err, serverId: server.id }, "Daemon WebSocket error");
    if (panelWs.readyState === WebSocket.OPEN) {
      panelWs.close(1011, "Daemon connection error");
    }
  });

  return daemonWs;
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
    const isWings = provider.name === "wings";

    logger.info({ serverId, userId: payload.userId, mode: isWings ? "wings" : "mock" }, "WebSocket client connected");

    send(ws, "status", { status: dbServer.status });

    const client: WsClient = {
      ws,
      serverId,
      userId: payload.userId,
      role: payload.role,
      statsInterval: null,
      consoleInterval: null,
      lastLogIndex: 0,
      daemonWs: null,
    };

    if (isWings) {
      // ── Wings mode: open a server-side daemon WS and proxy everything ────
      client.daemonWs = openDaemonWebSocket(ws, ctx.providerServer, ctx.providerNode);
    } else {
      // ── Mock mode: replay buffered logs and poll for new ones ─────────────
      const recentLogs = mockProvider.getRecentLogs(serverId);
      for (const line of recentLogs) {
        send(ws, "console", line);
      }
      client.lastLogIndex = recentLogs.length;

      client.statsInterval = setInterval(async () => {
        try {
          const stats = await provider.getStats(ctx.providerServer);
          send(ws, "stats", stats);
        } catch {
          // Provider temporarily unavailable — skip tick
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
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { event?: string; args?: string[] };
        if (!msg.event) return;

        if (isWings) {
          // ── Wings: translate our protocol → Wings protocol and forward ────
          const dws = client.daemonWs;
          if (!dws || dws.readyState !== WebSocket.OPEN) return;
          switch (msg.event) {
            case "send_command":
              dws.send(JSON.stringify({ event: "send command", args: msg.args ?? [] }));
              break;
            case "set_state":
              if (client.role === "client") break;
              dws.send(JSON.stringify({ event: "set state", args: msg.args ?? [] }));
              break;
          }
          return;
        }

        // ── Mock: execute locally ────────────────────────────────────────────
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
            const statusMap: Record<string, string> = {
              start: "running",
              stop: "offline",
              restart: "running",
              kill: "offline",
            };
            await db
              .update(serversTable)
              .set({ status: statusMap[action] as typeof dbServer.status })
              .where(eq(serversTable.id, serverId));
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
      if (client.daemonWs && client.daemonWs.readyState !== WebSocket.CLOSED) {
        client.daemonWs.close();
      }
      logger.info({ serverId, userId: payload.userId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, serverId }, "Panel WebSocket error");
    });
  });

  return wss;
}
