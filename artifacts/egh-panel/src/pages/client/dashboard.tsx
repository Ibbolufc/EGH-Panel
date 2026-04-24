import { ClientLayout } from "@/components/layout/client-layout";
import { useListServers } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Server, MemoryStick, HardDrive, Cpu, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function ServerCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
      <Skeleton className="h-5 w-16 rounded-md" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
    </div>
  );
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default function ClientDashboard() {
  const { data, isLoading } = useListServers();
  const servers = data?.data ?? [];

  return (
    <ClientLayout title="My Servers">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">My Servers</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${servers.length} server${servers.length !== 1 ? "s" : ""} available`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <ServerCardSkeleton key={i} />)}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
              <Server className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground">No servers yet</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
              You don&apos;t have any servers assigned to your account.
              Contact your administrator to create one for you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {servers.map((server: any) => (
              <Link
                key={server.id}
                href={`/client/servers/${server.id}`}
                className="group block rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-md transition-all duration-200"
                data-testid={`card-server-${server.id}`}
              >
                  {/* Server header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {server.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {server.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-0.5 ml-2" />
                  </div>

                  {/* Status */}
                  <div className="mb-4">
                    <StatusBadge status={server.status} />
                  </div>

                  {/* Resource chips */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { icon: MemoryStick, label: "RAM",  value: formatMB(server.memoryLimit) },
                      { icon: HardDrive,   label: "Disk", value: formatMB(server.diskLimit) },
                      { icon: Cpu,         label: "CPU",  value: `${server.cpuLimit}%` },
                    ].map((res) => (
                      <div
                        key={res.label}
                        className="flex flex-col gap-1 rounded-lg bg-white/3 border border-border/40 p-2"
                      >
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <res.icon className="h-3 w-3" />
                          <span className="text-[10px] font-medium uppercase tracking-wide">{res.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{res.value}</span>
                      </div>
                    ))}
                  </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
