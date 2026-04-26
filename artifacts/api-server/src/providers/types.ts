/**
 * Node Provider Interface
 *
 * This abstraction layer decouples the control panel from the
 * underlying node runtime implementation. Swap out the mock provider
 * for a real provider without touching route code.
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
 * INodeProvider — all interactions with a game server node runtime.
 * Every method is async and may throw ProviderError on failure.
 */
export interface INodeProvider {
  readonly name: string;

  heartbeat(node: ProviderNode): Promise<NodeHeartbeatResult>;
  powerAction(server: ProviderServer, action: PowerAction): Promise<void>;
  sendCommand(server: ProviderServer, command: string): Promise<void>;
  getStats(server: ProviderServer): Promise<ServerStats>;
  listFiles(server: ProviderServer, path: string): Promise<FileEntry[]>;
  readFile(server: ProviderServer, path: string): Promise<string>;
  writeFile(server: ProviderServer, path: string, content: string): Promise<void>;
  deleteFiles(server: ProviderServer, paths: string[]): Promise<void>;
  renameFile(server: ProviderServer, from: string, to: string): Promise<void>;
  createDirectory(server: ProviderServer, path: string): Promise<void>;
  createBackup(server: ProviderServer, name: string): Promise<{ uuid: string }>;
  deleteBackup(server: ProviderServer, backupUuid: string): Promise<void>;
  restoreBackup(server: ProviderServer, backupUuid: string): Promise<void>;

  /**
   * Provision a brand-new server on the target runtime.
   * Sends the full server configuration (image, startup, resources,
   * allocation, environment variables) and then triggers the install sequence.
   */
  provisionServer(server: ProviderServer): Promise<void>;

  installServer(server: ProviderServer): Promise<void>;
  deleteServer(server: ProviderServer): Promise<void>;
}

export interface ProviderNode {
  id: number;
  fqdn: string;
  scheme: "http" | "https";
  daemonPort: number;
  daemonToken: string | null;
}

export interface ProviderServer {
  id: number;
  uuid: string;
  node: ProviderNode;
  dockerImage: string | null;
  startup: string | null;
  memoryLimit: number;
  diskLimit: number;
  cpuLimit: number;
  allocationIp?: string;
  allocationPort?: number;
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
