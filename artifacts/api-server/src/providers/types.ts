/**
 * Node Provider Interface
 *
 * This abstraction layer decouples the control panel from the
 * underlying daemon implementation. Swap out MockProvider for a
 * real WingsProvider (or custom agent) without touching route code.
 */

export type PowerAction = "start" | "stop" | "restart" | "kill";

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt: string;
  isEditable?: boolean;
}

export interface ServerStats {
  cpuAbsolute: number;
  memoryBytes: number;
  memoryLimitBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptime: number;
  state: string;
}

export interface ConsoleMessage {
  type: "console" | "status" | "stats" | "install";
  data: string;
}

export interface BackupEntry {
  uuid: string;
  name: string;
  bytes: number;
  checksum: string;
  completedAt: string | null;
  isSuccessful: boolean;
  isLocked: boolean;
}

export interface NodeHeartbeatResult {
  online: boolean;
  version?: string;
  memoryUsedBytes?: number;
  diskUsedBytes?: number;
  uploadBytes?: number;
  downloadBytes?: number;
}

/**
 * INodeProvider — all interactions with a game server daemon.
 * Every method is async and may throw ProviderError on failure.
 */
export interface INodeProvider {
  readonly name: string;

  /** Check if node is reachable and get resource usage */
  heartbeat(node: ProviderNode): Promise<NodeHeartbeatResult>;

  /** Start, stop, restart, or kill a server process */
  powerAction(server: ProviderServer, action: PowerAction): Promise<void>;

  /** Send a command to the server console */
  sendCommand(server: ProviderServer, command: string): Promise<void>;

  /** Get current resource usage stats */
  getStats(server: ProviderServer): Promise<ServerStats>;

  /** List files at a given path */
  listFiles(server: ProviderServer, path: string): Promise<FileEntry[]>;

  /** Read a file's content */
  readFile(server: ProviderServer, path: string): Promise<string>;

  /** Write a file's content */
  writeFile(server: ProviderServer, path: string, content: string): Promise<void>;

  /** Delete one or more files/directories */
  deleteFiles(server: ProviderServer, paths: string[]): Promise<void>;

  /** Rename / move a file */
  renameFile(server: ProviderServer, from: string, to: string): Promise<void>;

  /** Create a directory */
  createDirectory(server: ProviderServer, path: string): Promise<void>;

  /** Trigger a backup creation */
  createBackup(server: ProviderServer, name: string): Promise<{ uuid: string }>;

  /** Delete a backup */
  deleteBackup(server: ProviderServer, backupUuid: string): Promise<void>;

  /** Initiate a backup restore */
  restoreBackup(server: ProviderServer, backupUuid: string): Promise<void>;

  /**
   * Provision a brand-new server on the daemon.
   * Sends the full Wings-compatible configuration (image, startup, resources,
   * allocation, env vars) and then triggers the install sequence.
   * Called once, immediately after the panel's DB insert.
   */
  provisionServer(server: ProviderServer): Promise<void>;

  /** Trigger a reinstall sequence on an already-provisioned server */
  installServer(server: ProviderServer): Promise<void>;

  /** Remove a server from the daemon, deleting its containers and volumes */
  deleteServer(server: ProviderServer): Promise<void>;
}

/** Minimal node info passed to the provider */
export interface ProviderNode {
  id: number;
  fqdn: string;
  scheme: "http" | "https";
  daemonPort: number;
  daemonToken: string | null;
}

/** Minimal server info passed to the provider */
export interface ProviderServer {
  id: number;
  uuid: string;
  node: ProviderNode;
  dockerImage: string | null;
  startup: string | null;
  memoryLimit: number;
  diskLimit: number;
  cpuLimit: number;
  /**
   * Primary allocation details — required for provisionServer().
   * Optional elsewhere (power actions, file ops, etc. don't need it).
   */
  allocationIp?: string;
  allocationPort?: number;
  /**
   * Environment variable values (envVar → value) — required for provisionServer().
   * Optional elsewhere.
   */
  environment?: Record<string, string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
