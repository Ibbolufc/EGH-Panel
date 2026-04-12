import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNodes, useCreateNode, useDeleteNode } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Plus, Cpu, HardDrive, MemoryStick, Server, Trash2, Globe,
  Terminal, ArrowRight, CheckCircle2, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

const SETUP_STEPS = [
  {
    n: "1",
    title: "Provision a server",
    desc: "Any Linux VPS or dedicated machine with Docker installed. Ubuntu 22.04+ recommended.",
    done: false,
  },
  {
    n: "2",
    title: "Install Wings (daemon)",
    desc: "Run the Wings installer on your node machine.",
    code: "curl -sL https://raw.githubusercontent.com/pterodactyl/wings/release/install.sh | bash",
    done: false,
  },
  {
    n: "3",
    title: "Register the node here",
    desc: "Click \"Add Node\" above and enter the node's FQDN or IP address.",
    done: false,
  },
];

export default function AdminNodes() {
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data, isLoading, refetch } = useListNodes({ page: 1, limit: 50 });
  const deleteNode = useDeleteNode();
  const { toast } = useToast();

  const nodes = data?.data ?? [];

  async function handleDelete(id: number) {
    if (!confirm("Delete this node? All associated allocations will be removed.")) return;
    setDeletingId(id);
    try {
      await deleteNode.mutateAsync({ id });
      toast({ title: "Node deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete node", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminLayout title="Nodes">
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Nodes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${nodes.length} node${nodes.length !== 1 ? "s" : ""} registered`}
            </p>
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
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(j => <Skeleton key={j} className="h-14 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          /* ---- Setup guide empty state ---- */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Steps */}
            <div className="lg:col-span-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/40">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No nodes configured</p>
                  <p className="text-xs text-muted-foreground">Follow these steps to connect your first node</p>
                </div>
              </div>
              <ol className="space-y-4">
                {SETUP_STEPS.map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white/5 text-xs font-bold text-muted-foreground mt-0.5">
                      {step.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                      {step.code && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/40 bg-black/40 px-3 py-2">
                          <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <code className="text-[11px] font-mono text-emerald-400 break-all">{step.code}</code>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 pt-4 border-t border-border/40">
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add First Node
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Info / tips */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">What is a node?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A node is a physical or virtual server that runs the Wings daemon. EGH Panel connects to Wings over HTTPS to deploy and manage game server containers on that machine.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Requirements</p>
                <ul className="space-y-2">
                  {[
                    "Linux (Ubuntu 22.04+ recommended)",
                    "Docker Engine installed",
                    "Ports 443 & 8080 open",
                    "Wings daemon installed",
                  ].map((req) => (
                    <li key={req} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* ---- Node cards ---- */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {nodes.map((node: any) => (
              <div key={node.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm" data-testid={`card-node-${node.id}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Cpu className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground text-sm truncate">{node.name}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground font-mono truncate ml-9">
                      {node.scheme}://{node.fqdn}:{node.daemonPort}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={node.status} />
                    <button
                      onClick={() => handleDelete(node.id)}
                      disabled={deletingId === node.id}
                      className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                      data-testid={`button-delete-node-${node.id}`}
                      title="Delete node"
                    >
                      {deletingId === node.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: MemoryStick, label: "Memory",   value: formatMB(node.memoryTotal), color: "text-sky-400",     bg: "bg-sky-500/10" },
                    { icon: HardDrive,   label: "Disk",     value: formatMB(node.diskTotal),   color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { icon: Globe,       label: "Visibility", value: node.isPublic ? "Public" : "Private", color: "text-violet-400", bg: "bg-violet-500/10" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-border/40 bg-white/3 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded", stat.bg)}>
                          <stat.icon className={cn("h-3 w-3", stat.color)} />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">{stat.label}</span>
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
      toast({ title: "Node added", description: `${form.name} is now registered.` });
      onSuccess();
    } catch {
      toast({ title: "Failed to add node", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-foreground">Add New Node</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Enter the connection details for your Wings daemon.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Node Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="US-East-1" required autoFocus />
            </div>
            <div>
              <label className={labelClass}>FQDN / IP Address</label>
              <input value={form.fqdn} onChange={(e) => setForm({ ...form, fqdn: e.target.value })} className={inputClass} placeholder="node.example.com" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Scheme</label>
              <select value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value })} className={inputClass}>
                <option value="https">https (recommended)</option>
                <option value="http">http</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Daemon Port</label>
              <input type="number" value={form.daemonPort} onChange={(e) => setForm({ ...form, daemonPort: Number(e.target.value) })} className={inputClass} required />
            </div>
          </div>
          <div>
            <label className={labelClass}>Resources</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Total Memory (MB)</p>
                <input type="number" value={form.memoryTotal} onChange={(e) => setForm({ ...form, memoryTotal: Number(e.target.value) })} className={inputClass} required />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Total Disk (MB)</p>
                <input type="number" value={form.diskTotal} onChange={(e) => setForm({ ...form, diskTotal: Number(e.target.value) })} className={inputClass} required />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNode.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNode.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : "Add Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
