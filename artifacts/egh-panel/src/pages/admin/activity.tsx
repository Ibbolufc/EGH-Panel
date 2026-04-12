import { AdminLayout } from "@/components/layout/admin-layout";
import { useListActivity } from "@workspace/api-client-react";
import {
  Activity, LogIn, LogOut, Server, User, Database, Shield,
  RefreshCcw, ChevronLeft, ChevronRight, Filter
} from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const eventMeta: Record<string, { label: string; icon: any; color: string }> = {
  "auth.login":             { label: "User signed in",      icon: LogIn,   color: "bg-emerald-500/10 text-emerald-400" },
  "auth.logout":            { label: "User signed out",     icon: LogOut,  color: "bg-slate-500/10 text-slate-400" },
  "server.power.start":     { label: "Server started",      icon: Server,  color: "bg-emerald-500/10 text-emerald-400" },
  "server.power.stop":      { label: "Server stopped",      icon: Server,  color: "bg-slate-500/10 text-slate-400" },
  "server.power.restart":   { label: "Server restarted",    icon: Server,  color: "bg-amber-500/10 text-amber-400" },
  "server.power.kill":      { label: "Server force-killed", icon: Server,  color: "bg-red-500/10 text-red-400" },
  "server.created":         { label: "Server created",      icon: Server,  color: "bg-sky-500/10 text-sky-400" },
  "server.deleted":         { label: "Server deleted",      icon: Server,  color: "bg-red-500/10 text-red-400" },
  "user.created":           { label: "User created",        icon: User,    color: "bg-violet-500/10 text-violet-400" },
  "user.updated":           { label: "User updated",        icon: User,    color: "bg-violet-500/10 text-violet-400" },
  "user.deleted":           { label: "User deleted",        icon: User,    color: "bg-red-500/10 text-red-400" },
  "backup.created":         { label: "Backup started",      icon: Database, color: "bg-sky-500/10 text-sky-400" },
  "backup.deleted":         { label: "Backup deleted",      icon: Database, color: "bg-red-500/10 text-red-400" },
  "egg.imported":           { label: "Egg imported",        icon: Shield,  color: "bg-orange-500/10 text-orange-400" },
};

const EVENT_CATEGORIES = [
  { label: "All Events",   value: "" },
  { label: "Auth",         value: "auth" },
  { label: "Servers",      value: "server" },
  { label: "Users",        value: "user" },
  { label: "Backups",      value: "backup" },
  { label: "Eggs",         value: "egg" },
];

const PAGE_SIZE = 30;

function formatTime(dateStr: string): { relative: string; absolute: string } {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  let relative: string;
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 1440) relative = `${Math.floor(mins / 60)}h ago`;
  else relative = `${Math.floor(mins / 1440)}d ago`;
  const absolute = date.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return { relative, absolute };
}

export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const { data, isLoading, refetch } = useListActivity({ page, limit: PAGE_SIZE });

  const allLogs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const logs = category
    ? allLogs.filter((l: any) => l.event?.startsWith(category))
    : allLogs;

  function handleCategoryChange(val: string) {
    setCategory(val);
    setPage(1);
  }

  return (
    <AdminLayout title="Activity">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Activity Log</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${total} event${total !== 1 ? "s" : ""} recorded`}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-border/60 bg-white/3 px-3 py-2 text-sm text-muted-foreground hover:bg-white/8 hover:text-foreground transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm divide-y divide-border/40">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-4 py-3">
                <Skeleton className="mt-0.5 h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5 py-0.5">
                  <Skeleton className="h-3.5 w-64 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-3">
                <Activity className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No events recorded</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {category ? "No events match the selected filter" : "Activity will appear here as actions are taken"}
              </p>
            </div>
          ) : (
            logs.map((log: any) => {
              const meta = eventMeta[log.event] ?? { label: log.event, icon: Activity, color: "bg-slate-500/10 text-slate-400" };
              const Icon = meta.icon;
              const { relative, absolute } = formatTime(log.createdAt);
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3.5 px-4 py-3 hover:bg-white/3 transition-colors"
                  data-testid={`row-activity-${log.id}`}
                >
                  <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{log.description}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] font-mono text-muted-foreground/60">{log.event}</span>
                      {log.ip && (
                        <span className="text-[11px] text-muted-foreground/60">IP: {log.ip}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right" title={absolute}>
                    <span className="text-xs text-muted-foreground">{relative}</span>
                    <div className="text-[10px] text-muted-foreground/40 mt-0.5">{absolute}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
              <span className="ml-2 text-muted-foreground/60">({total} events total)</span>
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
