import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListServers, useListNodes, useListEggs, useListUsers, useCreateServer, useDeleteServer } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Search, Server, Trash2, MemoryStick, HardDrive } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default function AdminServers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useListServers({ page: 1, limit: 50 });
  const deleteServer = useDeleteServer();
  const { toast } = useToast();

  const servers = data?.data ?? [];
  const filtered = servers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.status?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: number) {
    if (!confirm("Delete this server? This cannot be undone.")) return;
    try {
      await deleteServer.mutateAsync({ id });
      toast({ title: "Server deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete server", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Servers">
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Servers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage all game servers across your nodes</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-server"
          >
            <Plus className="h-4 w-4" />
            New Server
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search servers by name or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(inputClass, "pl-9")}
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-white/3">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Server</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Resources</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Node</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-32 rounded" />
                          <Skeleton className="h-2.5 w-24 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-8 w-28 rounded" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-3 w-16 rounded" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-6 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                        <Server className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {search ? "No servers match your search" : "No servers yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {search ? "Try a different keyword" : "Create your first server to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((server: any) => (
                  <tr key={server.id} className="hover:bg-white/3 transition-colors" data-testid={`row-server-${server.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Server className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/client/servers/${server.id}`}>
                            <a className="font-medium text-foreground hover:text-primary transition-colors">
                              {server.name}
                            </a>
                          </Link>
                          <div className="text-xs text-muted-foreground truncate">{server.description || "No description"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={server.status} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MemoryStick className="h-3 w-3 shrink-0" />
                          {formatMB(server.memoryLimit)} RAM
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HardDrive className="h-3 w-3 shrink-0" />
                          {formatMB(server.diskLimit)} Disk
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">Node #{server.nodeId}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        data-testid={`button-delete-server-${server.id}`}
                        title="Delete server"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showCreate && (
          <CreateServerModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); refetch(); }} />
        )}
      </div>
    </AdminLayout>
  );
}

function CreateServerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "", description: "", userId: 0, nodeId: 0, eggId: 0, allocationId: 0,
    memoryLimit: 1024, diskLimit: 10000, cpuLimit: 100,
    startup: "", dockerImage: ""
  });
  const createServer = useCreateServer();
  const { data: nodes } = useListNodes();
  const { data: eggs } = useListEggs();
  const { data: users } = useListUsers();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createServer.mutateAsync({ data: form });
      toast({ title: "Server created successfully" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create server", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl my-8">
        <h3 className="text-base font-semibold text-foreground mb-5">Create Server</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Server Name</label>
            <input
              placeholder="My Game Server"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required data-testid="input-server-name"
            />
          </div>
          <div>
            <label className={labelClass}>Description <span className="text-muted-foreground/50 font-normal">(optional)</span></label>
            <input
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Owner</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: Number(e.target.value) })}
                className={inputClass} required>
                <option value={0}>Select user…</option>
                {(users?.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Node</label>
              <select value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: Number(e.target.value) })}
                className={inputClass} required>
                <option value={0}>Select node…</option>
                {(nodes?.data ?? []).map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Egg (Game Type)</label>
            <select value={form.eggId} onChange={(e) => setForm({ ...form, eggId: Number(e.target.value) })}
              className={inputClass} required>
              <option value={0}>Select egg…</option>
              {(eggs?.data ?? []).map((eg: any) => <option key={eg.id} value={eg.id}>{eg.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>RAM (MB)</label>
              <input type="number" value={form.memoryLimit} onChange={(e) => setForm({ ...form, memoryLimit: Number(e.target.value) })}
                className={inputClass} min={128} required />
            </div>
            <div>
              <label className={labelClass}>Disk (MB)</label>
              <input type="number" value={form.diskLimit} onChange={(e) => setForm({ ...form, diskLimit: Number(e.target.value) })}
                className={inputClass} min={512} required />
            </div>
            <div>
              <label className={labelClass}>CPU (%)</label>
              <input type="number" value={form.cpuLimit} onChange={(e) => setForm({ ...form, cpuLimit: Number(e.target.value) })}
                className={inputClass} min={1} max={800} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createServer.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createServer.isPending ? "Creating…" : "Create Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
