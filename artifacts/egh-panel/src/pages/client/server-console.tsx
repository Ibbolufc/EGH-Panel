import { useState, useRef, useEffect } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer } from "@workspace/api-client-react";
import { Terminal, Send } from "lucide-react";
import { useParams } from "wouter";

const MOCK_LOGS = [
  "[00:00:01] [Server thread/INFO]: Starting Minecraft server...",
  "[00:00:02] [Server thread/INFO]: Loading properties",
  "[00:00:03] [Server thread/INFO]: Default game type: SURVIVAL",
  "[00:00:04] [Server thread/INFO]: Generating keypair",
  "[00:00:05] [Server thread/INFO]: Starting Minecraft server on *:25565",
  "[00:00:08] [Server thread/INFO]: Preparing level 'world'",
  "[00:00:12] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld",
  "[00:00:14] [Server thread/INFO]: Done (5.382s)! For help, type 'help'",
  "[00:01:20] [Server thread/INFO]: <Player1> Hello!",
  "[00:02:45] [Server thread/INFO]: Player1 joined the game",
];

export default function ServerConsole() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data } = useGetServer({ id });
  const server = data?.data;

  const [logs, setLogs] = useState<string[]>(MOCK_LOGS);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, `[${ts}] [Server console/CMD]: ${command}`]);
    setHistory((prev) => [command, ...prev]);
    setCommand("");
  }

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Console`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">{server?.name ?? "Server"} Console</h2>
          <span className={`text-xs rounded px-2 py-0.5 ${server?.status === "running" ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"}`}>
            {server?.status ?? "unknown"}
          </span>
        </div>

        {/* Console output */}
        <div className="rounded-lg border border-border bg-black/50 h-96 overflow-y-auto p-4 font-mono text-xs" data-testid="console-output">
          {logs.map((line, i) => (
            <div key={i} className={`leading-5 ${line.includes("[CMD]:") ? "text-yellow-300" : line.includes("ERROR") ? "text-red-400" : line.includes("WARN") ? "text-yellow-400" : "text-green-300"}`}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Command input */}
        <form onSubmit={sendCommand} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-mono text-sm">$</span>
            <input
              type="text"
              placeholder="Enter server command..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={server?.status !== "running"}
              className="w-full rounded-md border border-border bg-black/40 pl-8 pr-3 py-2.5 text-sm font-mono text-green-400 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              data-testid="input-console-command"
            />
          </div>
          <button
            type="submit"
            disabled={!command.trim() || server?.status !== "running"}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="button-send-command"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>

        {server?.status !== "running" && (
          <p className="text-xs text-muted-foreground">Console is only available when the server is running.</p>
        )}
      </div>
    </ClientLayout>
  );
}
