import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useServerPowerAction } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Server, Play, Square, RefreshCcw, MemoryStick, HardDrive, Cpu, Globe, Terminal } from "lucide-react";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ServerOverview() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, isLoading, refetch } = useGetServer({ id });
  const powerAction = useServerPowerAction();
  const { toast } = useToast();
  const server = data?.data;

  async function handlePower(action: "start" | "stop" | "restart" | "kill") {
    try {
      await powerAction.mutateAsync({ id, data: { action } });
      toast({ title: `Power action "${action}" sent` });
      setTimeout(() => refetch(), 1000);
    } catch {
      toast({ title: "Failed to send power action", variant: "destructive" });
    }
  }

  if (isLoading) return <ClientLayout title="Server"><div className="text-center py-12 text-muted-foreground">Loading...</div></ClientLayout>;
  if (!server) return <ClientLayout title="Server"><div className="text-center py-12 text-muted-foreground">Server not found.</div></ClientLayout>;

  return (
    <ClientLayout title={server.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{server.name}</h2>
                <p className="text-sm text-muted-foreground">{server.description || "No description"}</p>
              </div>
            </div>
          </div>
          <StatusBadge status={server.status} />
        </div>

        {/* Power Controls */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Power Controls</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePower("start")}
              disabled={server.status === "running" || powerAction.isPending}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              data-testid="button-power-start"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
            <button
              onClick={() => handlePower("stop")}
              disabled={server.status !== "running" || powerAction.isPending}
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              data-testid="button-power-stop"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
            <button
              onClick={() => handlePower("restart")}
              disabled={server.status !== "running" || powerAction.isPending}
              className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 disabled:opacity-50 transition-colors"
              data-testid="button-power-restart"
            >
              <RefreshCcw className="h-4 w-4" />
              Restart
            </button>
            <button
              onClick={() => handlePower("kill")}
              disabled={powerAction.isPending}
              className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              data-testid="button-power-kill"
            >
              Kill
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: MemoryStick, label: "RAM", value: `${server.memoryLimit} MB`, color: "text-blue-400" },
            { icon: HardDrive, label: "Disk", value: `${server.diskLimit} MB`, color: "text-green-400" },
            { icon: Cpu, label: "CPU", value: `${server.cpuLimit}%`, color: "text-orange-400" },
            { icon: Globe, label: "Node", value: `Node #${server.nodeId}`, color: "text-violet-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <div className="text-lg font-bold text-foreground">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Navigation</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { href: `/client/servers/${id}/console`, icon: Terminal, label: "Console" },
              { href: `/client/servers/${id}/files`, icon: HardDrive, label: "Files" },
              { href: `/client/servers/${id}/startup`, icon: Play, label: "Startup" },
              { href: `/client/servers/${id}/backups`, icon: Server, label: "Backups" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <a className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-3 py-2.5 text-sm text-foreground hover:bg-white/10 transition-colors">
                  <link.icon className="h-4 w-4 text-primary" />
                  {link.label}
                </a>
              </Link>
            ))}
          </div>
        </div>

        {/* Startup command */}
        {server.startup && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Startup Command</h3>
            <code className="text-xs font-mono text-green-400 bg-black/40 rounded-md p-3 block break-all">
              {server.startup}
            </code>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
