import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useGetNode, useUpdateNode, useCreateAllocation,
  useDeleteAllocation, useListServers,
} from "@workspace/api-client-react";
import type {
  NodeDetail, Allocation, Server, ServerListResponse,
  CreateAllocationBody, CreateNodeBody, CreateNodeBodyScheme,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateInstallScript } from "@/lib/install-script";
import {
  ChevronRight, MemoryStick, HardDrive, Server as ServerIcon,
  MapPin, Globe, Plus, Trash2, Loader2, Save, Network,
  FileText, Settings, Activity, Wifi, CheckCircle2, XCircle,
  Download, Copy, Check, AlertTriangle, RefreshCw, Terminal,
} from "lucide-react";

// The API returns extra fields not yet reflected in the generated schema.
// We extend NodeDetail locally rather than casting to `any`.
interface NodeDetailFull extends NodeDetail {
  location?: string | null;
  notes?: string | null;
  registrationToken?: string | null;
  daemonToken?: string | null;
}

interface NodeUpdateForm {
  name: string;
  location: string;
  fqdn: string;
  scheme: CreateNodeBodyScheme;
  daemonPort: number;
  memoryTotal: number;
  memoryOverallocate: number;
  diskTotal: number;
  diskOverallocate: number;
  notes: string;
}

const inputClass =
  "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

// ── Resource usage bar ────────────────────────────────────────────────────────
function ResourceBar({
  label, used, total, icon: Icon, color,
}: {
  label: string; used: number; total: number;
  icon: React.ElementType; color: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : color;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", `${color}/10`)}>
            <Icon className={cn("h-3.5 w-3.5", color)} />
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={cn("text-xs font-semibold tabular-nums", pct >= 80 ? "text-red-400" : "text-muted-foreground")}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground/60 tabular-nums">
        <span>{formatMB(used)} used</span>
        <span>{formatMB(total)} total</span>
      </div>
    </div>
  );
}

// ── Add allocation form ───────────────────────────────────────────────────────
function AddAllocationForm({ nodeId, onSuccess }: { nodeId: number; onSuccess: () => void }) {
  const [ip, setIp] = useState("");
  const [portRange, setPortRange] = useState("");
  const [alias, setAlias] = useState("");
  const [pending, setPending] = useState(false);
  const createAllocation = useCreateAllocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const ports = portRange.split(",").flatMap((part) => {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
          const [start, end] = trimmed.split("-").map(Number);
          const list: number[] = [];
          for (let p = start; p <= Math.min(end, start + 99); p++) list.push(p);
          return list;
        }
        const n = Number(trimmed);
        return isNaN(n) ? [] : [n];
      });

      if (ports.length === 0) {
        toast({ title: "Enter at least one valid port", variant: "destructive" });
        return;
      }

      const body: CreateAllocationBody = { ip, ports, ...(alias ? { alias } : {}) };
      await createAllocation.mutateAsync({ nodeId, data: body });
      toast({ title: `Added ${ports.length} allocation${ports.length !== 1 ? "s" : ""}` });
      setIp(""); setPortRange(""); setAlias("");
      onSuccess();
    } catch {
      toast({ title: "Failed to add allocation", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-dashed border-border/60 bg-white/2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Add Allocations</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>IP Address</label>
          <input value={ip} onChange={(e) => setIp(e.target.value)} className={inputClass} placeholder="0.0.0.0" required />
        </div>
        <div>
          <label className={labelClass}>
            Ports{" "}
            <span className="text-muted-foreground/40 font-normal">(e.g. 25565 or 25565-25570)</span>
          </label>
          <input value={portRange} onChange={(e) => setPortRange(e.target.value)} className={inputClass} placeholder="25565" required />
        </div>
        <div>
          <label className={labelClass}>
            Alias{" "}
            <span className="text-muted-foreground/40 font-normal">(optional)</span>
          </label>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} className={inputClass} placeholder="game.example.com" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit" disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Allocation
        </button>
      </div>
    </form>
  );
}

// ── Edit node form ────────────────────────────────────────────────────────────
function EditNodeForm({ node, onSuccess }: { node: NodeDetailFull; onSuccess: () => void }) {
  const [form, setForm] = useState<NodeUpdateForm>({
    name: node.name,
    location: node.location ?? "",
    fqdn: node.fqdn,
    scheme: node.scheme as CreateNodeBodyScheme,
    daemonPort: node.daemonPort,
    memoryTotal: node.memoryTotal,
    memoryOverallocate: node.memoryOverallocate,
    diskTotal: node.diskTotal,
    diskOverallocate: node.diskOverallocate,
    notes: node.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const updateNode = useUpdateNode();
  const { toast } = useToast();

  useEffect(() => {
    setForm({
      name: node.name,
      location: node.location ?? "",
      fqdn: node.fqdn,
      scheme: node.scheme as CreateNodeBodyScheme,
      daemonPort: node.daemonPort,
      memoryTotal: node.memoryTotal,
      memoryOverallocate: node.memoryOverallocate,
      diskTotal: node.diskTotal,
      diskOverallocate: node.diskOverallocate,
      notes: node.notes ?? "",
    });
  }, [node.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // location and notes are accepted by the backend but not yet in CreateNodeBody;
      // we spread them as extra fields which the API ignores-safely.
      const payload: CreateNodeBody & { location: string; notes: string } = {
        name: form.name,
        fqdn: form.fqdn,
        scheme: form.scheme,
        daemonPort: form.daemonPort,
        memoryTotal: form.memoryTotal,
        memoryOverallocate: form.memoryOverallocate,
        diskTotal: form.diskTotal,
        diskOverallocate: form.diskOverallocate,
        location: form.location,
        notes: form.notes,
      };
      await updateNode.mutateAsync({ id: node.id, data: payload as CreateNodeBody });
      toast({ title: "Node settings saved" });
      onSuccess();
    } catch {
      toast({ title: "Failed to save node settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Node Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass} required
          />
        </div>
        <div>
          <label className={labelClass}>
            Location{" "}
            <span className="text-muted-foreground/40 font-normal">(optional)</span>
          </label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={inputClass} placeholder="New York, USA"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>FQDN / IP Address</label>
        <input
          value={form.fqdn}
          onChange={(e) => setForm({ ...form, fqdn: e.target.value })}
          className={inputClass} required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Scheme</label>
          <select
            value={form.scheme}
            onChange={(e) => setForm({ ...form, scheme: e.target.value as CreateNodeBodyScheme })}
            className={inputClass}
          >
            <option value="https">https</option>
            <option value="http">http</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Daemon Port</label>
          <input
            type="number"
            value={form.daemonPort}
            onChange={(e) => setForm({ ...form, daemonPort: Number(e.target.value) })}
            className={inputClass} required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Memory Total (MB)</label>
          <input
            type="number"
            value={form.memoryTotal}
            onChange={(e) => setForm({ ...form, memoryTotal: Number(e.target.value) })}
            className={inputClass} required
          />
        </div>
        <div>
          <label className={labelClass}>Memory Overallocate (%)</label>
          <input
            type="number"
            value={form.memoryOverallocate}
            onChange={(e) => setForm({ ...form, memoryOverallocate: Number(e.target.value) })}
            className={inputClass} min="0"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Disk Total (MB)</label>
          <input
            type="number"
            value={form.diskTotal}
            onChange={(e) => setForm({ ...form, diskTotal: Number(e.target.value) })}
            className={inputClass} required
          />
        </div>
        <div>
          <label className={labelClass}>Disk Overallocate (%)</label>
          <input
            type="number"
            value={form.diskOverallocate}
            onChange={(e) => setForm({ ...form, diskOverallocate: Number(e.target.value) })}
            className={inputClass} min="0"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Notes{" "}
          <span className="text-muted-foreground/40 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3} className={cn(inputClass, "resize-none")}
          placeholder="e.g. Hetzner CX42, 4 vCPUs, maintenance window Sundays"
        />
      </div>
      <div className="flex justify-end pt-1 border-t border-border/40">
        <button
          type="submit" disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, title, subtitle,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({
  active, onClick, icon: Icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

type TabId = "overview" | "allocations" | "servers" | "install" | "settings";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("egh_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function CopyBtn({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "xs" | "sm" }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className={cn(
      "inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors",
      copied ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border/60 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
      size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
    )}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NodeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();

  const validTabs: TabId[] = ["overview", "allocations", "servers", "install", "settings"];
  const getTabFromSearch = (): TabId => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return validTabs.includes(t as TabId) ? (t as TabId) : "overview";
  };
  const [tab, setTab] = useState<TabId>(getTabFromSearch);

  function handleTabChange(newTab: TabId) {
    setTab(newTab);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", newTab);
    navigate(`${window.location.pathname}?${sp.toString()}`);
  }

  useEffect(() => {
    function onPop() { setTab(getTabFromSearch()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [deletingAllocId, setDeletingAllocId] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [regenPending, setRegenPending] = useState(false);
  const [testResult, setTestResult] = useState<{
    reachable: boolean;
    error?: string;
    version?: string;
    architecture?: string;
    os?: string;
    cpuCount?: number;
    kernelVersion?: string;
    memoryTotal?: number;
  } | null>(null);
  const { toast } = useToast();

  const { data: nodeData, isLoading: nodeLoading, refetch: refetchNode } = useGetNode(id);
  const { data: serversData, isLoading: serversLoading } = useListServers({ page: 1, limit: 200, nodeId: id });
  const deleteAllocation = useDeleteAllocation();

  async function handleTestConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/nodes/${id}/test-connection`, { method: "POST", headers: authHeaders() });
      const data = await res.json() as typeof testResult;
      setTestResult(data);
      if (data?.reachable) {
        refetchNode();
      }
    } catch {
      setTestResult({ reachable: false, error: "Request failed — check panel network connectivity" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleRegenToken() {
    setRegenPending(true);
    try {
      const res = await fetch(`/api/nodes/${id}/regen-token`, { method: "POST", headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      refetchNode();
      toast({ title: "Token regenerated", description: "The previous install command is now invalid." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate token";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setRegenPending(false);
    }
  }

  // Cast to extended type: NodeDetail is correct but location/notes/registrationToken
  // are returned by the API and defined in DB schema; generated types don't include them yet.
  const node = nodeData as NodeDetailFull | undefined;
  const servers: Server[] = (serversData as ServerListResponse | undefined)?.data ?? [];
  const allocations: Allocation[] = node?.allocations ?? [];

  const memoryUsed = servers.reduce((sum, s) => sum + s.memoryLimit, 0);
  const diskUsed = servers.reduce((sum, s) => sum + s.diskLimit, 0);

  async function handleDeleteAlloc(allocId: number) {
    if (!confirm("Delete this allocation?")) return;
    setDeletingAllocId(allocId);
    try {
      await deleteAllocation.mutateAsync({ id: allocId });
      toast({ title: "Allocation removed" });
      refetchNode();
    } catch {
      toast({ title: "Failed to remove allocation", variant: "destructive" });
    } finally {
      setDeletingAllocId(null);
    }
  }

  if (nodeLoading) {
    return (
      <AdminLayout title="Node">
        <div className="space-y-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!node) {
    return (
      <AdminLayout title="Node Not Found">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-muted-foreground">Node not found.</p>
          <Link href="/admin/nodes" className="text-sm text-primary hover:underline">
            Back to Nodes
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={node.name}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/nodes" className="hover:text-foreground transition-colors">
            Nodes
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium">{node.name}</span>
        </div>

        {/* Node header card */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ServerIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground leading-tight">{node.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <Globe className="h-3 w-3" />
                    {node.scheme}://{node.fqdn}:{node.daemonPort}
                  </span>
                  {node.location && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {node.location}
                    </span>
                  )}
                </div>
                {node.notes && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground/60">
                    <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                    {node.notes}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={node.status} />
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border/40">
            {([
              { label: "Servers",           value: servers.length,                                        icon: ServerIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
              { label: "Allocations",       value: allocations.length,                                    icon: Network,    color: "text-sky-400",    bg: "bg-sky-500/10"    },
              { label: "Used allocations",  value: allocations.filter((a) => a.isAssigned).length,        icon: Activity,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ] as const).map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border/40 bg-white/3 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={cn("flex h-5 w-5 items-center justify-center rounded", stat.bg)}>
                    <stat.icon className={cn("h-3 w-3", stat.color)} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                    {stat.label}
                  </span>
                </div>
                <div className="text-lg font-bold text-foreground tabular-nums">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-border/40">
          <TabBtn active={tab === "overview"}     onClick={() => handleTabChange("overview")}     icon={Activity}    label="Resources"    />
          <TabBtn active={tab === "allocations"}  onClick={() => handleTabChange("allocations")}  icon={Network}     label="Allocations"  />
          <TabBtn active={tab === "servers"}      onClick={() => handleTabChange("servers")}      icon={ServerIcon}  label="Servers"      />
          <TabBtn active={tab === "install"}      onClick={() => handleTabChange("install")}      icon={Download}    label="Install"      />
          <TabBtn active={tab === "settings"}     onClick={() => handleTabChange("settings")}     icon={Settings}    label="Settings"     />
        </div>

        {/* ── RESOURCES TAB ───────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ResourceBar label="Memory Usage" used={memoryUsed} total={node.memoryTotal} icon={MemoryStick} color="text-sky-400" />
              <ResourceBar label="Disk Usage"   used={diskUsed}   total={node.diskTotal}   icon={HardDrive}   color="text-emerald-400" />
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <SectionHeader icon={Activity} title="Node Limits" subtitle="Configured maximums for this node" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Memory Total",       value: formatMB(node.memoryTotal) },
                  { label: "Mem Overallocate",   value: `${node.memoryOverallocate}%` },
                  { label: "Disk Total",         value: formatMB(node.diskTotal) },
                  { label: "Disk Overallocate",  value: `${node.diskOverallocate}%` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-border/40 bg-white/3 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection test */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <SectionHeader
                  icon={Wifi}
                  title="Connection Test"
                  subtitle={`Verify daemon reachability at ${node.scheme}://${node.fqdn}:${node.daemonPort}`}
                />
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/8 transition-colors disabled:opacity-50"
                >
                  {isTesting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Testing…</>
                    : <><Wifi className="h-4 w-4" />Test Connection</>
                  }
                </button>
              </div>

              {testResult && (
                <div className={cn(
                  "mt-3 rounded-lg border p-3",
                  testResult.reachable
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5",
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.reachable
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    }
                    <span className={cn("text-sm font-semibold", testResult.reachable ? "text-emerald-400" : "text-red-400")}>
                      {testResult.reachable ? "Daemon reachable" : "Daemon unreachable"}
                    </span>
                  </div>

                  {testResult.reachable ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Version",    value: testResult.version },
                        { label: "OS",         value: testResult.os },
                        { label: "Arch",       value: testResult.architecture },
                        { label: "CPU cores",  value: testResult.cpuCount != null ? String(testResult.cpuCount) : undefined },
                        { label: "Kernel",     value: testResult.kernelVersion },
                        { label: "Host RAM",   value: testResult.memoryTotal ? `${Math.round((testResult.memoryTotal as number) / 1024 / 1024 / 1024 * 10) / 10} GB` : undefined },
                      ].filter((r) => r.value).map((row) => (
                        <div key={row.label} className="rounded-md bg-white/4 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">{row.label}</p>
                          <p className="text-xs font-mono font-medium text-foreground">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALLOCATIONS TAB ─────────────────────────────────────────────── */}
        {tab === "allocations" && (
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <SectionHeader
              icon={Network}
              title="Allocations"
              subtitle={`${allocations.length} allocation${allocations.length !== 1 ? "s" : ""} · ${allocations.filter((a) => a.isAssigned).length} in use`}
            />
            {allocations.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-white/3">
                      {["IP", "Port", "Alias", "Status", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs text-foreground">{alloc.ip}</td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground">{alloc.port}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{alloc.alias ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                            alloc.isAssigned
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-white/5 text-muted-foreground/60 border border-border/40",
                          )}>
                            {alloc.isAssigned ? "In use" : "Free"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleDeleteAlloc(alloc.id)}
                            disabled={deletingAllocId === alloc.id || alloc.isAssigned}
                            title={alloc.isAssigned ? "Cannot delete an allocation in use" : "Delete allocation"}
                            className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {deletingAllocId === alloc.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/40 py-8 text-center">
                <Network className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No allocations yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Add IP/port allocations below to assign them to servers
                </p>
              </div>
            )}
            <AddAllocationForm nodeId={id} onSuccess={() => refetchNode()} />
          </div>
        )}

        {/* ── SERVERS TAB ─────────────────────────────────────────────────── */}
        {tab === "servers" && (
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <SectionHeader
              icon={ServerIcon}
              title="Servers on this Node"
              subtitle={serversLoading ? "Loading…" : `${servers.length} server${servers.length !== 1 ? "s" : ""}`}
            />
            {serversLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : servers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/40 py-10 text-center">
                <ServerIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No servers on this node</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-white/3">
                      {["Name", "Status", "Memory", "Disk"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {servers.map((server) => (
                      <tr key={server.id} className="hover:bg-white/2 transition-colors group">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/client/servers/${server.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors group-hover:underline"
                          >
                            {server.name}
                          </Link>
                          {server.description && (
                            <p className="text-[11px] text-muted-foreground/60 truncate max-w-xs">
                              {server.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={server.status} />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                          {formatMB(server.memoryLimit)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                          {formatMB(server.diskLimit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── INSTALL TAB ─────────────────────────────────────────────────── */}
        {tab === "install" && (() => {
          const panelUrl = window.location.origin;
          const token = node.registrationToken;
          const script = token
            ? generateInstallScript({
                panelUrl,
                nodeId: node.id,
                nodeName: node.name,
                nodeFqdn: node.fqdn,
                daemonPort: node.daemonPort,
                scheme: node.scheme,
                registrationToken: token,
              })
            : null;

          return (
            <div className="space-y-4">
              {/* Warning banner */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/80">
                  <span className="font-semibold text-amber-300">Run this command on the target node machine — not on your EGH Panel server.</span>
                  {" "}SSH into the node as root, then paste and run the script below. It will install Docker, download the EGH Node agent, and link this node back to your panel automatically.
                </div>
              </div>

              {/* Token section */}
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <SectionHeader
                    icon={Terminal}
                    title="EGH Node Install"
                    subtitle={`Node: ${node.name} · ${node.scheme}://${node.fqdn}:${node.daemonPort}`}
                  />
                  <button
                    onClick={handleRegenToken}
                    disabled={regenPending}
                    className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {regenPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Regenerate Token
                  </button>
                </div>

                {/* Registration token display */}
                <div className="mb-4 rounded-lg border border-border/50 bg-white/2 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Registration Token</p>
                  {token ? (
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-foreground font-mono break-all flex-1">{token}</code>
                      <CopyBtn text={token} size="xs" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground/60 flex-1">No token generated yet. Click "Regenerate Token" to create one.</p>
                      <button
                        onClick={handleRegenToken}
                        disabled={regenPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {regenPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Generate Token
                      </button>
                    </div>
                  )}
                </div>

                {/* Install script */}
                {script ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Install Script</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([script], { type: "text/x-shellscript" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `install-egh-node-${node.id}.sh`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
                          data-testid="button-download-install-script"
                        >
                          <Download className="h-3 w-3" />
                          Download .sh
                        </button>
                        <CopyBtn text={script} label="Copy full script" />
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-lg border border-border/40 bg-[hsl(225,20%,4%)]">
                      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                          </div>
                          <span className="text-[10px] text-muted-foreground/50 font-mono">install-egh-node.sh — {node.name}</span>
                        </div>
                        <CopyBtn text={script} size="xs" />
                      </div>
                      <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed font-mono text-emerald-300/90 max-h-72">
                        <code>{script}</code>
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground/60 text-center">
                      This node will appear as <span className="text-emerald-400 font-medium">Online</span> in the panel once EGH Node connects back successfully.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/40 py-10 text-center">
                    <Download className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Generate a token first to see the install script</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Click "Generate Token" above to create the install command</p>
                  </div>
                )}

                {/* Connection details grid */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Panel URL",    value: panelUrl },
                    { label: "Node FQDN",   value: node.fqdn },
                    { label: "Daemon Port", value: String(node.daemonPort) },
                    { label: "Scheme",      value: node.scheme },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border/50 bg-white/2 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">{item.label}</p>
                      <code className="text-xs text-foreground break-all">{item.value}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── SETTINGS TAB ────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <SectionHeader icon={Settings} title="Node Settings" subtitle="Update the node's configuration" />
            <EditNodeForm node={node} onSuccess={() => refetchNode()} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
