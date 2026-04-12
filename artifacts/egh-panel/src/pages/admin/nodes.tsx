import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNodes, useCreateNode, useDeleteNode } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Cpu, HardDrive, MemoryStick, Server, Trash2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

export default function AdminNodes() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch } = useListNodes({ page: 1, limit: 50 });
  const deleteNode = useDeleteNode();
  const { toast } = useToast();

  const nodes = data?.data ?? [];

  async function handleDelete(id: number) {
    if (!confirm("Delete this node? All associated allocations will be removed.")) return;
    try {
      await deleteNode.mutateAsync({ id });
      toast({ title: "Node deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete node", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Nodes">
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Nodes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage infrastructure nodes that host your game servers</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-node"
          >
            <Plus className="h-4 w-4" />
            Add Node
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map(j => <Skeleton key={j} className="h-16 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
              <Cpu className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-foreground">No nodes configured</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
              Add your first node to start hosting game servers. Nodes are the physical or virtual machines that run your servers.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {nodes.map((node: any) => (
              <div key={node.id} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm" data-testid={`card-node-${node.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground truncate">{node.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {node.scheme}://{node.fqdn}:{node.daemonPort}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={node.status} />
                    <button
                      onClick={() => handleDelete(node.id)}
                      className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      data-testid={`button-delete-node-${node.id}`}
                      title="Delete node"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: MemoryStick, label: "Memory",  value: formatMB(node.memoryTotal), color: "text-sky-400", bg: "bg-sky-500/10" },
                    { icon: HardDrive,   label: "Disk",    value: formatMB(node.diskTotal),   color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { icon: Globe,       label: "Public",  value: node.isPublic ? "Yes" : "No", color: "text-violet-400", bg: "bg-violet-500/10" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-border/40 bg-white/3 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded", stat.bg)}>
                          <stat.icon className={cn("h-3 w-3", stat.color)} />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <CreateNodeModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); refetch(); }} />
        )}
      </div>
    </AdminLayout>
  );
}

function CreateNodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "", fqdn: "", scheme: "https", daemonPort: 8080,
    isPublic: true, memoryTotal: 4096, memoryOverallocate: 0,
    diskTotal: 50000, diskOverallocate: 0
  });
  const createNode = useCreateNode();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createNode.mutateAsync({ data: form });
      toast({ title: "Node added successfully" });
      onSuccess();
    } catch {
      toast({ title: "Failed to add node", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground mb-5">Add New Node</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Node Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="US-East-1" required />
            </div>
            <div>
              <label className={labelClass}>FQDN / IP</label>
              <input value={form.fqdn} onChange={(e) => setForm({ ...form, fqdn: e.target.value })} className={inputClass} placeholder="node.example.com" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Scheme</label>
              <select value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value })} className={inputClass}>
                <option value="https">https</option>
                <option value="http">http</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Daemon Port</label>
              <input type="number" value={form.daemonPort} onChange={(e) => setForm({ ...form, daemonPort: Number(e.target.value) })} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Total Memory (MB)</label>
              <input type="number" value={form.memoryTotal} onChange={(e) => setForm({ ...form, memoryTotal: Number(e.target.value) })} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Total Disk (MB)</label>
              <input type="number" value={form.diskTotal} onChange={(e) => setForm({ ...form, diskTotal: Number(e.target.value) })} className={inputClass} required />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNode.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNode.isPending ? "Adding…" : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
