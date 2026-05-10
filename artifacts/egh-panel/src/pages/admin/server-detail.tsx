import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetServer, useUpdateServer } from "@workspace/api-client-react";
import type { ServerDetail } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronRight, Server, Settings, Activity, MemoryStick,
  HardDrive, Cpu, Globe, Loader2, Save, User, Egg, Network,
  Play, Square, RotateCcw, Terminal, Flame, Ban,
} from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LiveServerStats {
  cpuAbsolute: number;
  memoryBytes: number;
  memoryLimitBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptime: number;
  state: string;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function SectionHeader({ icon: Icon, title, subtitle }: {
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

function TabBtn({ active, onClick, icon: Icon, label }: {
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

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <dt className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label, disabled, pending = false, tone = "default" }: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        tone === "danger"
          ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
          : "border border-border/60 bg-white/3 text-foreground hover:bg-white/8",
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

type TabId = "overview" | "settings";
const VALID_TABS: TabId[] = ["overview", "settings"];

function getTabFromSearch(): TabId {
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return VALID_TABS.includes(t as TabId) ? (t as TabId) : "overview";
}

export default function AdminServerDetail() {
  const { id } = useParams<{ id: string }>();
  const serverId = Number(id);
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>(getTabFromSearch);
  const { toast } = useToast();

  const { data: server, isLoading, refetch } = useGetServer(serverId) as {
    data: ServerDetail | undefined; isLoading: boolean; refetch: () => void;
  };

  const updateServer = useUpdateServer();
  const [form, setForm] = useState({ name: "", description: "", memoryLimit: 1024, diskLimit: 10000, cpuLimit: 100 });
  const [formDirty, setFormDirty] = useState(false);
  const [stats, setStats] = useState<LiveServerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const displayStatus = stats?.state ?? server?.status ?? null;
  const isRunning = displayStatus === "running";

  useEffect(() => {
    if (server) {
      setForm({
        name: server.name,
        description: server.description ?? "",
        memoryLimit: server.memoryLimit,
        diskLimit: server.diskLimit,
        cpuLimit: server.cpuLimit,
      });
    }
  }, [server]);

  useEffect(() => {
    function onPop() { setTab(getTabFromSearch()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!serverId || Number.isNaN(serverId)) return;

    let cancelled = false;

    async function loadStats() {
      try {
        setStatsLoading(true);
        const token = localStorage.getItem("egh_token");
        const res = await fetch(`${API_BASE}/api/servers/${serverId}/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as LiveServerStats;
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    const interval = window.setInterval(loadStats, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [serverId]);

  function handleTabChange(newTab: TabId) {
    setTab(newTab);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", newTab);
    navigate(`${window.location.pathname}?${sp.toString()}`);
  }

  function handleFormChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateServer.mutateAsync({ id: serverId, data: form });
      toast({ title: "Server updated" });
      setFormDirty(false);
      refetch();
    } catch {
      toast({ title: "Failed to update server", variant: "destructive" });
    }
  }

  async function postServerAction(path: string, body?: Record<string, unknown>) {
    const token = localStorage.getItem("egh_token");
    const res = await fetch(`${API_BASE}/api/servers/${serverId}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const payload = await res.json() as { error?: string; message?: string };
        message = payload.error ?? payload.message ?? message;
      } catch {
        // ignore json parse errors
      }
      throw new Error(message);
    }

    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function handlePowerAction(action: "start" | "stop" | "restart" | "kill") {
    try {
      setActionPending(action);
      await postServerAction("/power", { action });
      toast({ title: `Server ${action} sent` });
      refetch();
      setTimeout(() => refetch(), 1200);
    } catch (err) {
      toast({ title: `Failed to ${action} server`, description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  }

  async function handleReinstall() {
    try {
      setActionPending("reinstall");
      await postServerAction("/reinstall");
      toast({ title: "Reinstall started" });
      refetch();
    } catch (err) {
      toast({ title: "Failed to reinstall server", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="Server">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/servers" className="hover:text-foreground transition-colors">Servers</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!server) {
    return (
      <AdminLayout title="Server">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Server className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Server not found</p>
          <Link href="/admin/servers" className="mt-3 text-xs text-primary hover:underline">Back to servers</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={server.name}>
      <div className="space-y-5">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/servers" className="hover:text-foreground transition-colors">Servers</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{server.name}</span>
        </nav>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{server.name}</h1>
              <p className="text-sm text-muted-foreground">{server.description || "No description"}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {statsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <StatusBadge status={displayStatus ?? server.status} />
            </div>
          </div>

          <div className="border-t border-border/40 px-4 py-3 flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => handlePowerAction("start")} icon={Play} label="Start" disabled={isRunning} pending={actionPending === "start"} />
            <ActionButton onClick={() => handlePowerAction("stop")} icon={Square} label="Stop" disabled={!isRunning} pending={actionPending === "stop"} />
            <ActionButton onClick={() => handlePowerAction("restart")} icon={RotateCcw} label="Restart" disabled={!isRunning} pending={actionPending === "restart"} />
            <ActionButton onClick={() => handlePowerAction("kill")} icon={Ban} label="Kill" disabled={!isRunning} pending={actionPending === "kill"} tone="danger" />
            <ActionButton onClick={handleReinstall} icon={Flame} label="Reinstall" pending={actionPending === "reinstall"} />
            <Link href={`/client/servers/${serverId}/console`} className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/3 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/8 transition-colors">
              <Terminal className="h-4 w-4" />
              Open Console
            </Link>
          </div>

          <div className="border-t border-border/40 px-4 py-2 flex items-center gap-1">
            <TabBtn active={tab === "overview"} onClick={() => handleTabChange("overview")} icon={Activity} label="Overview" />
            <TabBtn active={tab === "settings"} onClick={() => handleTabChange("settings")} icon={Settings} label="Settings" />
          </div>
        </div>

        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={MemoryStick} title="Resources" subtitle="Allocated limits and latest live stats" />
              <dl className="space-y-0">
                <InfoRow label="RAM Limit" value={<span className="flex items-center gap-1.5"><MemoryStick className="h-3.5 w-3.5 text-blue-400" />{formatMB(server.memoryLimit)}</span>} />
                <InfoRow label="Disk Limit" value={<span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-orange-400" />{formatMB(server.diskLimit)}</span>} />
                <InfoRow label="CPU Limit" value={<span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-emerald-400" />{server.cpuLimit}%</span>} />
                <InfoRow label="Live Memory" value={stats ? formatBytes(stats.memoryBytes) : "—"} />
                <InfoRow label="Live Disk" value={stats ? formatBytes(stats.diskBytes) : "—"} />
                <InfoRow label="Live CPU" value={stats ? `${stats.cpuAbsolute.toFixed(1)}%` : "—"} />
                <InfoRow label="Uptime" value={stats ? formatUptime(stats.uptime) : "—"} />
              </dl>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={Globe} title="Assignment" subtitle="Node, egg, and owner" />
              <dl className="space-y-0">
                <InfoRow label="Owner" value={<Link href={`/admin/users/${server.userId}`} className="text-primary hover:underline flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{server.userEmail}</Link>} />
                <InfoRow label="Node" value={<Link href={`/admin/nodes/${server.nodeId}`} className="text-primary hover:underline flex items-center gap-1.5"><Network className="h-3.5 w-3.5" />{server.nodeName || `Node #${server.nodeId}`}</Link>} />
                <InfoRow label="Egg" value={<span className="flex items-center gap-1.5"><Egg className="h-3.5 w-3.5 text-orange-400" />{server.eggName || `Egg #${server.eggId}`}</span>} />
                <InfoRow label="Allocation" value={<span className="flex items-center gap-1.5 font-mono text-xs"><Globe className="h-3.5 w-3.5 text-muted-foreground" />{server.allocationIp}:{server.allocationPort}</span>} />
              </dl>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 lg:col-span-2">
              <SectionHeader icon={Server} title="Metadata" />
              <dl className="space-y-0">
                <InfoRow label="Server ID" value={<code className="text-xs font-mono">{server.id}</code>} />
                <InfoRow label="UUID" value={<code className="text-xs font-mono break-all">{server.uuid}</code>} />
                <InfoRow label="Created" value={new Date(server.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
              </dl>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <SectionHeader icon={Settings} title="Server Settings" subtitle="Rename, update description, or adjust resource limits" />
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={labelClass}>Server Name</label>
                <input value={form.name} onChange={(e) => handleFormChange("name", e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>Description <span className="text-muted-foreground/40 font-normal">(optional)</span></label>
                <input value={form.description} onChange={(e) => handleFormChange("description", e.target.value)} className={inputClass} placeholder="Brief description of this server" />
              </div>
              <div>
                <label className={labelClass}>Resource Limits</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">RAM (MB)</p>
                    <input type="number" value={form.memoryLimit} onChange={(e) => handleFormChange("memoryLimit", Number(e.target.value))} className={inputClass} min={128} required />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Disk (MB)</p>
                    <input type="number" value={form.diskLimit} onChange={(e) => handleFormChange("diskLimit", Number(e.target.value))} className={inputClass} min={512} required />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">CPU (%)</p>
                    <input type="number" value={form.cpuLimit} onChange={(e) => handleFormChange("cpuLimit", Number(e.target.value))} className={inputClass} min={1} max={800} required />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={!formDirty || updateServer.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {updateServer.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
