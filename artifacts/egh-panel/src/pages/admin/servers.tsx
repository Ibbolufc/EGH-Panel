import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListServers, useListNodes, useListEggs, useListUsers, useCreateServer, useDeleteServer } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Search, Server, Trash2, MemoryStick, HardDrive } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
    if (!confirm("Are you sure you want to delete this server? This cannot be undone.")) return;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Servers</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage all game servers across your nodes</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-server"
          >
            <Plus className="h-4 w-4" />
            New Server
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Server</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resources</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No servers found</td></tr>
              ) : (
                filtered.map((server: any) => (
                  <tr key={server.id} className="hover:bg-white/5 transition-colors" data-testid={`row-server-${server.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Server className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{server.name}</div>
                          <div className="text-xs text-muted-foreground">{server.description || "No description"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={server.status} /></td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MemoryStick className="h-3 w-3" />
                          {server.memoryLimit} MB RAM
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HardDrive className="h-3 w-3" />
                          {server.diskLimit} MB Disk
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">Node #{server.nodeId}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        data-testid={`button-delete-server-${server.id}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl my-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Create Server</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Server Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required data-testid="input-server-name"
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Owner</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required>
                <option value={0}>Select user...</option>
                {(users?.data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Node</label>
              <select value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required>
                <option value={0}>Select node...</option>
                {(nodes?.data ?? []).map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Egg (Game Type)</label>
            <select value={form.eggId} onChange={(e) => setForm({ ...form, eggId: Number(e.target.value) })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" required>
              <option value={0}>Select egg...</option>
              {(eggs?.data ?? []).map((eg: any) => <option key={eg.id} value={eg.id}>{eg.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">RAM (MB)</label>
              <input type="number" value={form.memoryLimit} onChange={(e) => setForm({ ...form, memoryLimit: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" min={128} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Disk (MB)</label>
              <input type="number" value={form.diskLimit} onChange={(e) => setForm({ ...form, diskLimit: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" min={512} required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CPU (%)</label>
              <input type="number" value={form.cpuLimit} onChange={(e) => setForm({ ...form, cpuLimit: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" min={1} max={800} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createServer.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createServer.isPending ? "Creating..." : "Create Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
