import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNodes, useCreateNode, useDeleteNode } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Cpu, HardDrive, MemoryStick, Server, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatMemory(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

function formatDisk(mb: number) {
  if (mb >= 1000) return `${(mb / 1000).toFixed(0)} GB`;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Nodes</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage your server infrastructure nodes</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-node"
          >
            <Plus className="h-4 w-4" />
            Add Node
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {nodes.map((node: any) => (
              <div key={node.id} className="rounded-lg border border-border bg-card p-5" data-testid={`card-node-${node.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{node.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">{node.scheme}://{node.fqdn}:{node.daemonPort}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={node.status} />
                    <button
                      onClick={() => handleDelete(node.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      data-testid={`button-delete-node-${node.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MemoryStick className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs text-muted-foreground">Memory</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground">{formatMemory(node.memoryTotal)}</div>
                  </div>
                  <div className="rounded-md bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <HardDrive className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs text-muted-foreground">Disk</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground">{formatDisk(node.diskTotal)}</div>
                  </div>
                  <div className="rounded-md bg-white/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Server className="h-3.5 w-3.5 text-violet-400" />
                      <span className="text-xs text-muted-foreground">Public</span>
                    </div>
                    <div className="text-sm font-semibold text-foreground">{node.isPublic ? "Yes" : "No"}</div>
                  </div>
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

  const field = (label: string, key: keyof typeof form, type = "text", extra?: any) => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {type === "select" ? (
        <select
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {extra?.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={String(form[key])}
          onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">Add New Node</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Node Name", "name")}
            {field("FQDN / IP", "fqdn")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {field("Scheme", "scheme", "select", { options: ["https", "http"] })}
            {field("Daemon Port", "daemonPort", "number")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Total Memory (MB)", "memoryTotal", "number")}
            {field("Total Disk (MB)", "diskTotal", "number")}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNode.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNode.isPending ? "Adding..." : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
