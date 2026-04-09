import { useState, useRef, useEffect, useCallback } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer } from "@workspace/api-client-react";
import { Terminal, Send, Wifi, WifiOff, Loader2, Cpu, MemoryStick, HardDrive, Activity } from "lucide-react";
import { useParams } from "wouter";

type WsStatus = "connecting" | "connected" | "disconnected" | "error";

interface ServerStats {
  cpuAbsolute: number;
  memoryBytes: number;
  memoryLimitBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptime: number;
  state: string;
}

function buildWsUrl(serverId: number, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}&serverId=${serverId}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatBar({ label, icon: Icon, value, max, formatted }: {
  label: string;
  icon: React.ElementType;
  value: number;
  max?: number;
  formatted: string;
}) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-mono text-foreground">{formatted}</span>
      </div>
      {max !== undefined && (
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function ServerConsole() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data } = useGetServer({ id });
  const server = data?.data;

  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const terminalErrorRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current || terminalErrorRef.current) return;

    const token = localStorage.getItem("egh_token");
    if (!token || !id || Number.isNaN(id)) {
      terminalErrorRef.current = true;
      setWsStatus("error");
      return;
    }

    setWsStatus("connecting");
    const ws = new WebSocket(buildWsUrl(id, token));
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setWsStatus("connected");
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data: unknown };
        switch (msg.type) {
          case "console":
            setLogs((prev) => {
              const next = [...prev, String(msg.data)];
              return next.length > 500 ? next.slice(-500) : next;
            });
            break;
          case "status":
            setLiveStatus((msg.data as { status: string }).status);
            break;
          case "stats":
            setStats(msg.data as ServerStats);
            break;
          case "auth_error":
          case "not_found":
            terminalErrorRef.current = true;
            setWsStatus("error");
            ws.close();
            break;
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setWsStatus("disconnected");
      reconnectTimer.current = setTimeout(() => {
        if (!unmountedRef.current) connect();
      }, 4000);
    };

    ws.onerror = () => {
      setWsStatus("error");
    };
  }, [id]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "send_command", args: [cmd] }));
    setCommand("");
  }

  const displayStatus = liveStatus ?? server?.status;
  const isRunning = displayStatus === "running";

  const wsStatusLabel: Record<WsStatus, string> = {
    connecting: "Connecting...",
    connected: "Live",
    disconnected: "Reconnecting...",
    error: "Connection error",
  };

  const wsStatusColor: Record<WsStatus, string> = {
    connecting: "text-yellow-400",
    connected: "text-green-400",
    disconnected: "text-yellow-400",
    error: "text-red-400",
  };

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Console`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">{server?.name ?? "Server"} Console</h2>
            {displayStatus && (
              <span className={`text-xs rounded px-2 py-0.5 ${isRunning ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"}`}>
                {displayStatus}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${wsStatusColor[wsStatus]}`}>
            {wsStatus === "connecting" || wsStatus === "disconnected" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : wsStatus === "connected" ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {wsStatusLabel[wsStatus]}
          </div>
        </div>

        {/* Live stats bar — shown once stats start arriving */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4" data-testid="console-stats">
            <StatBar
              label="CPU"
              icon={Cpu}
              value={stats.cpuAbsolute}
              max={100}
              formatted={`${stats.cpuAbsolute.toFixed(1)}%`}
            />
            <StatBar
              label="Memory"
              icon={MemoryStick}
              value={stats.memoryBytes}
              max={stats.memoryLimitBytes}
              formatted={`${formatBytes(stats.memoryBytes)} / ${formatBytes(stats.memoryLimitBytes)}`}
            />
            <StatBar
              label="Disk"
              icon={HardDrive}
              value={stats.diskBytes}
              formatted={formatBytes(stats.diskBytes)}
            />
            <StatBar
              label="Uptime"
              icon={Activity}
              value={stats.uptime}
              formatted={formatUptime(stats.uptime)}
            />
          </div>
        )}

        {/* Console output */}
        <div
          className="rounded-lg border border-border bg-black/50 h-96 overflow-y-auto p-4 font-mono text-xs"
          data-testid="console-output"
        >
          {logs.length === 0 ? (
            <span className="text-muted-foreground italic">
              {wsStatus === "connecting" ? "Connecting to server console..." : "No output yet."}
            </span>
          ) : (
            logs.map((line, i) => (
              <div
                key={i}
                className={`leading-5 ${
                  line.startsWith(">") || line.includes("[CMD]")
                    ? "text-yellow-300"
                    : line.includes("ERROR") || line.includes("error")
                    ? "text-red-400"
                    : line.includes("WARN")
                    ? "text-yellow-400"
                    : "text-green-300"
                }`}
              >
                {line}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Command input */}
        <form onSubmit={sendCommand} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-mono text-sm">$</span>
            <input
              type="text"
              placeholder={wsStatus !== "connected" ? "Waiting for connection..." : "Enter server command..."}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={wsStatus !== "connected"}
              className="w-full rounded-md border border-border bg-black/40 pl-8 pr-3 py-2.5 text-sm font-mono text-green-400 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              data-testid="input-console-command"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={!command.trim() || wsStatus !== "connected"}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="button-send-command"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>

        {wsStatus === "error" && (
          <p className="text-xs text-red-400">
            Console connection failed. Check that the server is reachable and your session is valid.
          </p>
        )}
      </div>
    </ClientLayout>
  );
}
