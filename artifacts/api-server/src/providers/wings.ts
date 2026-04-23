/**
 * WingsProvider
 *
 * Real implementation of INodeProvider that communicates with a
 * Wings-compatible daemon over HTTP.
 *
 * Authentication: short-lived HS256 JWT signed with the node's
 * registrationToken (the same value Wings stores as `token` in its
 * config.yml).  All REST endpoints match the Pterodactyl Wings API.
 *
 * Keep MockProvider in registry.ts as the default for development;
 * activate this provider by setting EGH_MOCK_PROVIDER=false and
 * ensuring the node has a daemonToken (= registrationToken) set.
 */

import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import type {
  INodeProvider,
  ProviderNode,
  ProviderServer,
  FileEntry,
  ServerStats,
  NodeHeartbeatResult,
  PowerAction,
} from "./types";
import { ProviderError } from "./types";

const REQUEST_TIMEOUT_MS = 12_000;

export class WingsProvider implements INodeProvider {
  readonly name = "wings";

  private baseUrl(node: ProviderNode): string {
    return `${node.scheme}://${node.fqdn}:${node.daemonPort}`;
  }

  private makeToken(node: ProviderNode): string {
    if (!node.daemonToken) {
      throw new ProviderError(
        "Node has no authentication token configured — cannot communicate with daemon",
        "NO_DAEMON_TOKEN",
        500,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        jti: randomUUID(),
        iat: now,
        nbf: now - 5,
        exp: now + 300,
      },
      node.daemonToken,
      { algorithm: "HS256" },
    );
  }

  private async request<T = unknown>(
    node: ProviderNode,
    method: string,
    path: string,
    options: { body?: unknown; rawBody?: string | Buffer; requireAuth?: boolean } = {},
  ): Promise<T> {
    const { body, rawBody, requireAuth = true } = options;
    const url = `${this.baseUrl(node)}${path}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (requireAuth) {
      headers["Authorization"] = `Bearer ${this.makeToken(node)}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    } else if (rawBody !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body:
          rawBody !== undefined
            ? rawBody
            : body !== undefined
              ? JSON.stringify(body)
              : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code =
        err instanceof Error && err.name === "TimeoutError"
          ? "DAEMON_TIMEOUT"
          : "DAEMON_UNREACHABLE";
      throw new ProviderError(
        `Cannot reach daemon at ${this.baseUrl(node)}: ${msg}`,
        code,
        503,
      );
    }

    if (response.status === 204) return {} as T;

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderError(
        `Daemon returned ${response.status}: ${text.slice(0, 300)}`,
        "DAEMON_ERROR",
        response.status,
      );
    }

    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as T;
  }

  async heartbeat(node: ProviderNode): Promise<NodeHeartbeatResult> {
    try {
      const data = await this.request<{
        version?: string;
        memory_total?: number;
      }>(node, "GET", "/api/system", { requireAuth: false });

      return {
        online: true,
        version: data.version ?? "unknown",
        memoryUsedBytes: undefined,
        diskUsedBytes: undefined,
        uploadBytes: undefined,
        downloadBytes: undefined,
      };
    } catch {
      return { online: false };
    }
  }

  async powerAction(server: ProviderServer, action: PowerAction): Promise<void> {
    await this.request(server.node, "POST", `/api/servers/${server.uuid}/power`, {
      body: { action },
    });
  }

  async sendCommand(server: ProviderServer, command: string): Promise<void> {
    await this.request(server.node, "POST", `/api/servers/${server.uuid}/commands`, {
      body: { command },
    });
  }

  async getStats(server: ProviderServer): Promise<ServerStats> {
    const data = await this.request<{
      current_state?: string;
      resources?: {
        cpu_absolute?: number;
        memory_bytes?: number;
        disk_bytes?: number;
        network_rx_bytes?: number;
        network_tx_bytes?: number;
        uptime?: number;
      };
    }>(server.node, "GET", `/api/servers/${server.uuid}/resources`);

    const r = data.resources ?? {};
    return {
      cpuAbsolute: r.cpu_absolute ?? 0,
      memoryBytes: r.memory_bytes ?? 0,
      memoryLimitBytes: server.memoryLimit * 1024 * 1024,
      diskBytes: r.disk_bytes ?? 0,
      networkRxBytes: r.network_rx_bytes ?? 0,
      networkTxBytes: r.network_tx_bytes ?? 0,
      uptime: r.uptime ?? 0,
      state: data.current_state ?? "unknown",
    };
  }

  async listFiles(server: ProviderServer, path: string): Promise<FileEntry[]> {
    const data = await this.request<{ files?: Record<string, unknown>[] }>(
      server.node,
      "GET",
      `/api/servers/${server.uuid}/files/list?directory=${encodeURIComponent(path)}`,
    );

    return (data.files ?? []).map((f) => {
      const isDir =
        (f["is_directory"] as boolean | undefined) ??
        (f["mime_type"] as string | undefined) === "inode/directory";
      return {
        name: (f["name"] as string) ?? "",
        path: `${path}/${f["name"] as string}`,
        size: (f["size"] as number) ?? 0,
        isDirectory: isDir,
        isFile: !isDir,
        modifiedAt:
          (f["modified_at"] as string | undefined) ?? new Date().toISOString(),
        isEditable: !isDir,
      };
    });
  }

  async readFile(server: ProviderServer, path: string): Promise<string> {
    return this.request<string>(
      server.node,
      "GET",
      `/api/servers/${server.uuid}/files/contents?file=${encodeURIComponent(path)}`,
    );
  }

  async writeFile(
    server: ProviderServer,
    path: string,
    content: string,
  ): Promise<void> {
    await this.request(
      server.node,
      "POST",
      `/api/servers/${server.uuid}/files/write?file=${encodeURIComponent(path)}`,
      { rawBody: content },
    );
  }

  async deleteFiles(server: ProviderServer, paths: string[]): Promise<void> {
    await this.request(server.node, "POST", `/api/servers/${server.uuid}/files/delete`, {
      body: { root: "/", files: paths },
    });
  }

  async renameFile(
    server: ProviderServer,
    from: string,
    to: string,
  ): Promise<void> {
    await this.request(server.node, "PUT", `/api/servers/${server.uuid}/files/rename`, {
      body: {
        root: "/",
        files: [{ from: from.replace(/^\//, ""), to: to.replace(/^\//, "") }],
      },
    });
  }

  async createDirectory(server: ProviderServer, path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop() ?? path;
    const root = "/" + parts.join("/");
    await this.request(
      server.node,
      "POST",
      `/api/servers/${server.uuid}/files/create-directory`,
      { body: { root, name } },
    );
  }

  async createBackup(
    server: ProviderServer,
    name: string,
  ): Promise<{ uuid: string }> {
    return this.request<{ uuid: string }>(
      server.node,
      "POST",
      `/api/servers/${server.uuid}/backup`,
      { body: { name } },
    );
  }

  async deleteBackup(server: ProviderServer, backupUuid: string): Promise<void> {
    await this.request(
      server.node,
      "DELETE",
      `/api/servers/${server.uuid}/backup/${backupUuid}`,
    );
  }

  async restoreBackup(
    server: ProviderServer,
    backupUuid: string,
  ): Promise<void> {
    await this.request(
      server.node,
      "POST",
      `/api/servers/${server.uuid}/backup/${backupUuid}/restore`,
    );
  }

  async installServer(server: ProviderServer): Promise<void> {
    await this.request(server.node, "POST", `/api/servers/${server.uuid}/install`);
  }

  async deleteServer(server: ProviderServer): Promise<void> {
    await this.request(server.node, "DELETE", `/api/servers/${server.uuid}`);
  }
}

export const wingsProvider = new WingsProvider();
