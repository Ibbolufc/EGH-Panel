/**
 * MockProvider
 *
 * A fully structured mock of INodeProvider.
 * All operations succeed in-memory with realistic simulated responses.
 *
 * Replace with WingsProvider (or a custom agent) by registering
 * a different provider in registry.ts — no route code changes needed.
 */

import type {
  INodeProvider,
  ProviderNode,
  ProviderServer,
  FileEntry,
  ServerStats,
  NodeHeartbeatResult,
} from "./types";
import { ProviderError } from "./types";

const fileStore = new Map<string, Map<string, { content?: string; size: number; isDirectory: boolean; modifiedAt: Date }>>();

function getStore(serverId: number): Map<string, { content?: string; size: number; isDirectory: boolean; modifiedAt: Date }> {
  const key = String(serverId);
  if (!fileStore.has(key)) {
    const store = new Map<string, { content?: string; size: number; isDirectory: boolean; modifiedAt: Date }>();
    const now = new Date();
    store.set("/server.jar", { size: 45_678_900, isDirectory: false, modifiedAt: now });
    store.set("/server.properties", {
      size: 512,
      isDirectory: false,
      modifiedAt: now,
      content: `# Minecraft server properties\nserver-port=25565\nmax-players=20\ngamemode=survival\ndifficulty=normal\nspawn-protection=16\nmotd=A Minecraft Server hosted on EGH Panel`,
    });
    store.set("/ops.json", { size: 2, isDirectory: false, modifiedAt: now, content: "[]" });
    store.set("/eula.txt", { size: 28, isDirectory: false, modifiedAt: now, content: "eula=true" });
    store.set("/plugins", { size: 0, isDirectory: true, modifiedAt: now });
    store.set("/world", { size: 0, isDirectory: true, modifiedAt: now });
    store.set("/logs", { size: 0, isDirectory: true, modifiedAt: now });
    fileStore.set(key, store);
  }
  return fileStore.get(key)!;
}

function normalise(p: string): string {
  const s = p.startsWith("/") ? p : `/${p}`;
  return s === "" ? "/" : s;
}

const consoleLogs: Record<number, string[]> = {};

function appendLog(serverId: number, line: string): void {
  if (!consoleLogs[serverId]) consoleLogs[serverId] = [];
  consoleLogs[serverId].push(line);
  if (consoleLogs[serverId].length > 200) consoleLogs[serverId].shift();
}

export class MockProvider implements INodeProvider {
  readonly name = "mock";

  async heartbeat(_node: ProviderNode): Promise<NodeHeartbeatResult> {
    return {
      online: true,
      version: "egh-mock-1.0.0",
      memoryUsedBytes: Math.floor(Math.random() * 2_000_000_000),
      diskUsedBytes: Math.floor(Math.random() * 100_000_000_000),
      uploadBytes: Math.floor(Math.random() * 1_000_000),
      downloadBytes: Math.floor(Math.random() * 5_000_000),
    };
  }

  async powerAction(server: ProviderServer, action: string): Promise<void> {
    const messages: Record<string, string[]> = {
      start: [
        `[Server] Starting server ${server.uuid}...`,
        "[Server] Loading configuration...",
        "[Server] Binding to 0.0.0.0:25565",
        "[Server] Server started successfully.",
      ],
      stop: [
        "[Server] Stopping server...",
        "[Server] Saving world...",
        "[Server] Server stopped.",
      ],
      restart: [
        "[Server] Restarting server...",
        "[Server] Server stopped.",
        "[Server] Server started successfully.",
      ],
      kill: ["[Server] Server process killed."],
    };
    for (const msg of messages[action] ?? []) {
      appendLog(server.id, msg);
    }
  }

  async sendCommand(server: ProviderServer, command: string): Promise<void> {
    appendLog(server.id, `> ${command}`);
    if (command === "list") {
      appendLog(server.id, "[Server] There are 0/20 players online.");
    } else if (command.startsWith("say ")) {
      appendLog(server.id, `[Server] [EGH] ${command.slice(4)}`);
    } else {
      appendLog(server.id, `[Server] Unknown command: ${command}`);
    }
  }

  async getStats(server: ProviderServer): Promise<ServerStats> {
    return {
      cpuAbsolute: Math.random() * (server.cpuLimit * 0.8),
      memoryBytes: Math.floor(Math.random() * server.memoryLimit * 0.9 * 1024 * 1024),
      memoryLimitBytes: server.memoryLimit * 1024 * 1024,
      diskBytes: Math.floor(Math.random() * server.diskLimit * 0.6 * 1024 * 1024),
      networkRxBytes: Math.floor(Math.random() * 10_000_000),
      networkTxBytes: Math.floor(Math.random() * 5_000_000),
      uptime: Math.floor(Math.random() * 86400),
      state: "running",
    };
  }

  async listFiles(server: ProviderServer, path: string): Promise<FileEntry[]> {
    const store = getStore(server.id);
    const dir = normalise(path);
    const entries: FileEntry[] = [];

    for (const [filePath, meta] of store.entries()) {
      if (filePath === "/") continue;
      const parent = filePath.includes("/", 1)
        ? filePath.slice(0, filePath.lastIndexOf("/"))
        : "/";
      if (parent !== dir) continue;
      const name = filePath.slice(filePath.lastIndexOf("/") + 1);
      entries.push({
        name,
        path: filePath,
        size: meta.size,
        isDirectory: meta.isDirectory,
        isFile: !meta.isDirectory,
        modifiedAt: meta.modifiedAt.toISOString(),
        isEditable: !meta.isDirectory,
      });
    }

    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readFile(server: ProviderServer, path: string): Promise<string> {
    const store = getStore(server.id);
    const entry = store.get(normalise(path));
    if (!entry) throw new ProviderError(`File not found: ${path}`, "FILE_NOT_FOUND", 404);
    if (entry.isDirectory) throw new ProviderError("Cannot read a directory", "IS_DIRECTORY", 400);
    return entry.content ?? `# ${path}\n`;
  }

  async writeFile(server: ProviderServer, path: string, content: string): Promise<void> {
    const store = getStore(server.id);
    const key = normalise(path);
    const existing = store.get(key);
    store.set(key, {
      content,
      size: Buffer.byteLength(content, "utf8"),
      isDirectory: false,
      modifiedAt: new Date(),
      ...(existing && { modifiedAt: new Date() }),
    });
  }

  async deleteFiles(server: ProviderServer, paths: string[]): Promise<void> {
    const store = getStore(server.id);
    for (const p of paths) {
      const key = normalise(p);
      store.delete(key);
      for (const existing of [...store.keys()]) {
        if (existing.startsWith(`${key}/`)) store.delete(existing);
      }
    }
  }

  async renameFile(server: ProviderServer, from: string, to: string): Promise<void> {
    const store = getStore(server.id);
    const fromKey = normalise(from);
    const toKey = normalise(to);
    const entry = store.get(fromKey);
    if (!entry) throw new ProviderError(`File not found: ${from}`, "FILE_NOT_FOUND", 404);
    store.set(toKey, { ...entry, modifiedAt: new Date() });
    store.delete(fromKey);
  }

  async createDirectory(server: ProviderServer, path: string): Promise<void> {
    const store = getStore(server.id);
    store.set(normalise(path), { size: 0, isDirectory: true, modifiedAt: new Date() });
  }

  async createBackup(_server: ProviderServer, _name: string): Promise<{ uuid: string }> {
    const { randomUUID } = await import("crypto");
    return { uuid: randomUUID() };
  }

  async deleteBackup(_server: ProviderServer, _backupUuid: string): Promise<void> {
  }

  async restoreBackup(_server: ProviderServer, _backupUuid: string): Promise<void> {
  }

  async installServer(_server: ProviderServer): Promise<void> {
  }

  async deleteServer(server: ProviderServer): Promise<void> {
    fileStore.delete(String(server.id));
  }

  /** Return recent console lines for this server (used by WebSocket handler) */
  getRecentLogs(serverId: number): string[] {
    return consoleLogs[serverId] ?? [];
  }
}

export const mockProvider = new MockProvider();
