import { ClientLayout } from "@/components/layout/client-layout";
import { useListServers } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Server, MemoryStick, HardDrive, Cpu, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function ClientDashboard() {
  const { data, isLoading } = useListServers();
  const servers = data?.data ?? [];

  return (
    <ClientLayout title="My Servers">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Servers</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor your game servers</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading servers...</div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
            <Server className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-foreground font-medium">No servers found</p>
            <p className="text-sm text-muted-foreground mt-1">Contact your administrator to create a server for you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {servers.map((server: any) => (
              <Link key={server.id} href={`/client/servers/${server.id}`}>
                <a className="block rounded-lg border border-border bg-card p-5 hover:bg-white/5 hover:border-primary/30 transition-all group" data-testid={`card-server-${server.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{server.name}</div>
                        <div className="text-xs text-muted-foreground">{server.description || "No description"}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="mb-3">
                    <StatusBadge status={server.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <MemoryStick className="h-3 w-3" />RAM
                      </div>
                      <div className="text-xs font-semibold text-foreground">{server.memoryLimit} MB</div>
                    </div>
                    <div className="rounded bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <HardDrive className="h-3 w-3" />Disk
                      </div>
                      <div className="text-xs font-semibold text-foreground">{server.diskLimit} MB</div>
                    </div>
                    <div className="rounded bg-white/5 p-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Cpu className="h-3 w-3" />CPU
                      </div>
                      <div className="text-xs font-semibold text-foreground">{server.cpuLimit}%</div>
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
