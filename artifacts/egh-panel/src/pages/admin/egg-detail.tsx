import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetEgg } from "@workspace/api-client-react";
import type { EggDetail, EggVariable } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronRight, Egg, Settings, List,
  Terminal, FileCode, Tag, Eye, EyeOff, Pencil,
} from "lucide-react";

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
      <dd className="text-sm font-medium text-foreground min-w-0 flex-1">{value ?? "—"}</dd>
    </div>
  );
}

type TabId = "details" | "variables";
const VALID_TABS: TabId[] = ["details", "variables"];

function getTabFromSearch(): TabId {
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return VALID_TABS.includes(t as TabId) ? (t as TabId) : "details";
}

export default function AdminEggDetail() {
  const { id } = useParams<{ id: string }>();
  const eggId = Number(id);
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>(getTabFromSearch);

  const { data: egg, isLoading } = useGetEgg(eggId) as {
    data: EggDetail | undefined; isLoading: boolean;
  };

  useEffect(() => {
    function onPop() { setTab(getTabFromSearch()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function handleTabChange(newTab: TabId) {
    setTab(newTab);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", newTab);
    navigate(`${window.location.pathname}?${sp.toString()}`);
  }

  if (isLoading) {
    return (
      <AdminLayout title="Egg">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/eggs" className="hover:text-foreground transition-colors">Eggs &amp; Nests</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!egg) {
    return (
      <AdminLayout title="Egg">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Egg className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Egg not found</p>
          <Link href="/admin/eggs" className="mt-3 text-xs text-primary hover:underline">Back to eggs &amp; nests</Link>
        </div>
      </AdminLayout>
    );
  }

  const variables: EggVariable[] = egg.variables ?? [];

  return (
    <AdminLayout title={egg.name}>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/eggs" className="hover:text-foreground transition-colors">Eggs &amp; Nests</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{egg.nestName}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{egg.name}</span>
        </nav>

        {/* Header card */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              <Egg className="h-6 w-6 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{egg.name}</h1>
              <p className="text-sm text-muted-foreground">{egg.description || "No description"}</p>
            </div>
            <div className="shrink-0 rounded-md bg-white/5 border border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
              {egg.nestName}
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-t border-border/40 px-4 py-2 flex items-center gap-1">
            <TabBtn active={tab === "details"} onClick={() => handleTabChange("details")} icon={Settings} label="Details" />
            <TabBtn
              active={tab === "variables"}
              onClick={() => handleTabChange("variables")}
              icon={List}
              label={`Variables${variables.length > 0 ? ` (${variables.length})` : ""}`}
            />
          </div>
        </div>

        {/* Details tab */}
        {tab === "details" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Docker & Runtime */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={Settings} title="Docker &amp; Runtime" subtitle="Image and startup configuration" />
              <dl className="space-y-0">
                <InfoRow label="Docker Image" value={
                  <code className="text-xs font-mono break-all text-foreground">{egg.dockerImage}</code>
                } />
                <InfoRow label="Startup Command" value={
                  <code className="text-xs font-mono break-all text-emerald-400">{egg.startup}</code>
                } />
                {egg.dockerImages && egg.dockerImages.length > 1 && (
                  <InfoRow label="Alt. Images" value={
                    <div className="space-y-1">
                      {egg.dockerImages.map((img, i) => (
                        <code key={i} className="block text-xs font-mono break-all text-muted-foreground">{img}</code>
                      ))}
                    </div>
                  } />
                )}
              </dl>
            </div>

            {/* Metadata */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={Tag} title="Metadata" />
              <dl className="space-y-0">
                <InfoRow label="Egg ID" value={<code className="text-xs font-mono">{egg.id}</code>} />
                <InfoRow label="Nest" value={egg.nestName} />
                <InfoRow label="Variables" value={`${variables.length} variable${variables.length !== 1 ? "s" : ""}`} />
                <InfoRow label="Created" value={new Date(egg.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
              </dl>
            </div>

            {/* Install Script */}
            {egg.installScript && (
              <div className="rounded-xl border border-border/60 bg-card p-5 lg:col-span-2">
                <SectionHeader icon={FileCode} title="Install Script" subtitle="Runs during server installation" />
                <div className="overflow-hidden rounded-lg border border-border/40 bg-black/40">
                  <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">bash</span>
                  </div>
                  <pre className="p-4 text-[11px] text-emerald-400 font-mono overflow-auto leading-relaxed max-h-64">
                    {egg.installScript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Variables tab */}
        {tab === "variables" && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <SectionHeader
                icon={List}
                title="Variables"
                subtitle={`${variables.length} environment variable${variables.length !== 1 ? "s" : ""} for this egg`}
              />
            </div>
            {variables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <List className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No variables</p>
                <p className="text-xs text-muted-foreground mt-1">This egg has no environment variables defined.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {variables.map((v) => (
                  <div key={v.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{v.name}</span>
                          <code className="text-[10px] font-mono bg-black/30 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground">
                            {v.envVariable}
                          </code>
                        </div>
                        {v.description && (
                          <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            Default: <code className="font-mono text-foreground/70">{v.defaultValue || "none"}</code>
                          </span>
                          {v.rules && (
                            <span className="text-xs text-muted-foreground">
                              Rules: <code className="font-mono text-foreground/70">{v.rules}</code>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                          v.userViewable ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-muted-foreground"
                        )}>
                          {v.userViewable ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {v.userViewable ? "Viewable" : "Hidden"}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                          v.userEditable ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted-foreground"
                        )}>
                          <Pencil className="h-3 w-3" />
                          {v.userEditable ? "Editable" : "Locked"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
