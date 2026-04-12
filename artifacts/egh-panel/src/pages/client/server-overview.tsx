import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useServerPowerAction } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Server, Play, Square, RefreshCcw, MemoryStick, HardDrive,
  Cpu, Globe, Terminal, Zap
} from "lucide-react";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function LoadingState() {
  return (
    <ClientLayout title="Server">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3.5 w-32 rounded" />
          </div>
        </div>
        <Skeleton className="h-[88px] w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    </ClientLayout>
  );
}

interface PowerBtnProps {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  disabled: boolean;
  variant: "start" | "stop" | "restart" | "kill";
}

function PowerBtn({ label, icon: Icon, onClick, disabled, variant }: PowerBtnProps) {
  const styles: Record<string, string> = {
    start:   "bg-emerald-600 hover:bg-emerald-500 text-white border-transparent",
    stop:    "bg-red-600 hover:bg-red-500 text-white border-transparent",
    restart: "border border-border/60 bg-white/4 text-foreground hover:bg-white/8",
    kill:    "border border-red-500/30 bg-red-500/8 text-red-400 hover:bg-red-500/15 hover:border-red-500/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        styles[variant]
      )}
      data-testid={`button-power-${variant}`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {label}
    </button>
  );
}

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

  if (isLoading) return <LoadingState />;
  if (!server) return (
    <ClientLayout title="Server">
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
          <Server className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-semibold text-foreground">Server not found</p>
        <p className="mt-1.5 text-xs text-muted-foreground">This server may have been deleted or you don&apos;t have access.</p>
      </div>
    </ClientLayout>
  );

  const isRunning = server.status === "running";
  const isBusy    = powerAction.isPending;

  return (
    <ClientLayout title={server.name}>
      <div className="space-y-5">
        {/* Server header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{server.name}</h2>
              <p className="text-sm text-muted-foreground">{server.description || "No description"}</p>
            </div>
          </div>
          <StatusBadge status={server.status} />
        </div>

        {/* Power Controls */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Power Controls</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <PowerBtn
              variant="start"
              icon={Play}
              label="Start"
              onClick={() => handlePower("start")}
              disabled={isRunning || isBusy}
            />
            <PowerBtn
              variant="stop"
              icon={Square}
              label="Stop"
              onClick={() => handlePower("stop")}
              disabled={!isRunning || isBusy}
            />
            <PowerBtn
              variant="restart"
              icon={RefreshCcw}
              label="Restart"
              onClick={() => handlePower("restart")}
              disabled={!isRunning || isBusy}
            />
            <PowerBtn
              variant="kill"
              label="Force Kill"
              onClick={() => handlePower("kill")}
              disabled={isBusy}
            />
          </div>
        </div>

        {/* Resource info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: MemoryStick, label: "RAM",    value: formatMB(server.memoryLimit), color: "text-sky-400",    bg: "bg-sky-500/10" },
            { icon: HardDrive,   label: "Disk",   value: formatMB(server.diskLimit),   color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Cpu,         label: "CPU",    value: `${server.cpuLimit}%`,         color: "text-orange-400", bg: "bg-orange-500/10" },
            { icon: Globe,       label: "Node",   value: `Node #${server.nodeId}`,      color: "text-violet-400", bg: "bg-violet-500/10" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", item.bg)}>
                  <item.icon className={cn("h-3.5 w-3.5", item.color)} />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Quick navigation */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Quick Navigation</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { href: `/client/servers/${id}/console`,   icon: Terminal,   label: "Console",  desc: "Live output" },
              { href: `/client/servers/${id}/files`,     icon: HardDrive,  label: "Files",    desc: "File manager" },
              { href: `/client/servers/${id}/startup`,   icon: Play,       label: "Startup",  desc: "Variables" },
              { href: `/client/servers/${id}/backups`,   icon: Server,     label: "Backups",  desc: "Snapshots" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <a className="group flex flex-col gap-0.5 rounded-lg border border-border/50 bg-white/3 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <div className="flex items-center gap-1.5">
                    <link.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {link.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{link.desc}</span>
                </a>
              </Link>
            ))}
          </div>
        </div>

        {/* Startup command */}
        {server.startup && (
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-2.5 text-sm font-semibold text-foreground">Startup Command</h3>
            <pre className="overflow-x-auto rounded-lg border border-border/40 bg-black/40 p-3 text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap break-all">
              {server.startup}
            </pre>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
