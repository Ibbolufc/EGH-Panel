import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetAdminStats, useListActivity } from "@workspace/api-client-react";
import {
  Server, Users, Cpu, Activity,
  CheckCircle2, Clock, AlertTriangle, ArrowRight,
  LogIn, LogOut, Database, Shield, User
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  accentClass: string;
  iconBgClass: string;
  loading?: boolean;
}

function StatCard({ icon: Icon, label, value, sub, accentClass, iconBgClass, loading }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <span className={cn("stat-card-accent", accentClass)} />
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 rounded" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">{value ?? "—"}</p>
          )}
          {sub && !loading && <p className="text-xs text-muted-foreground">{sub}</p>}
          {loading && <Skeleton className="h-3 w-24 rounded" />}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBgClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const quickActions = [
  { label: "Manage Servers", href: "/admin/servers", desc: "Start, stop, create servers" },
  { label: "Add Node",       href: "/admin/nodes",   desc: "Register a new node" },
  { label: "Manage Users",   href: "/admin/users",   desc: "Accounts and roles" },
  { label: "Import Egg",     href: "/admin/eggs",    desc: "Add game templates" },
];

const activityIconMap: Record<string, React.ElementType> = {
  "auth.login": LogIn, "auth.logout": LogOut,
  "server.created": Server, "server.deleted": Server,
  "server.power.start": Server, "server.power.stop": Server, "server.power.restart": Server,
  "user.created": User, "user.updated": User, "user.deleted": User,
  "backup.created": Database, "egg.imported": Shield,
};

const activityColorMap: Record<string, string> = {
  "auth.login": "text-emerald-400 bg-emerald-500/10",
  "auth.logout": "text-slate-400 bg-slate-500/10",
  "server.created": "text-sky-400 bg-sky-500/10",
  "server.deleted": "text-red-400 bg-red-500/10",
  "server.power.start": "text-emerald-400 bg-emerald-500/10",
  "server.power.stop": "text-slate-400 bg-slate-500/10",
  "server.power.restart": "text-amber-400 bg-amber-500/10",
  "user.created": "text-violet-400 bg-violet-500/10",
  "user.deleted": "text-red-400 bg-red-500/10",
  "backup.created": "text-sky-400 bg-sky-500/10",
  "egg.imported": "text-orange-400 bg-orange-500/10",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function AdminDashboard() {
  const { data, isLoading } = useGetAdminStats();
  const { data: activityData, isLoading: activityLoading } = useListActivity({ page: 1, limit: 8 });
  const stats = data?.data;
  const recentLogs = activityData?.data ?? [];

  const offlineServers = Math.max(
    0,
    (stats?.totalServers ?? 0) - (stats?.runningServers ?? 0) - (stats?.installingServers ?? 0)
  );

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">System status at a glance</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard loading={isLoading}
            icon={Server} label="Total Servers"
            value={stats?.totalServers ?? 0}
            sub={`${stats?.runningServers ?? 0} running`}
            accentClass="bg-sky-500" iconBgClass="bg-sky-500/10 text-sky-400"
          />
          <StatCard loading={isLoading}
            icon={Users} label="Total Users"
            value={stats?.totalUsers ?? 0}
            sub="registered accounts"
            accentClass="bg-violet-500" iconBgClass="bg-violet-500/10 text-violet-400"
          />
          <StatCard loading={isLoading}
            icon={Cpu} label="Active Nodes"
            value={stats?.activeNodes ?? 0}
            sub={`of ${stats?.totalNodes ?? 0} total`}
            accentClass="bg-emerald-500" iconBgClass="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard loading={isLoading}
            icon={Activity} label="Events (24h)"
            value={stats?.recentActivity ?? 0}
            sub="activity events"
            accentClass="bg-orange-500" iconBgClass="bg-orange-500/10 text-orange-400"
          />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Server status breakdown */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Server Status</h3>
              </div>
              <Link href="/admin/servers" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Running",    value: stats?.runningServers ?? 0,  dotClass: "bg-emerald-400", textClass: "text-emerald-400", status: "running" },
                { label: "Installing", value: stats?.installingServers ?? 0, dotClass: "bg-amber-400",  textClass: "text-amber-400",  status: "installing" },
                { label: "Offline",    value: offlineServers,               dotClass: "bg-slate-500",  textClass: "text-slate-400",  status: "offline" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 py-1">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", item.dotClass)} />
                  <span className="flex-1 text-sm text-muted-foreground">{item.label}</span>
                  {isLoading
                    ? <Skeleton className="h-4 w-8 rounded" />
                    : <span className={cn("text-sm font-bold tabular-nums", item.textClass)}>{item.value}</span>
                  }
                </div>
              ))}
            </div>
            {!isLoading && stats?.totalServers === 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-border/40 py-4 text-center">
                <p className="text-xs text-muted-foreground">No servers yet.</p>
                <Link href="/admin/servers" className="mt-1 text-xs text-primary hover:underline">Create one →</Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link key={action.label} href={action.href} className="group flex flex-col gap-0.5 rounded-lg border border-border/50 bg-white/3 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{action.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>
            <Link href="/admin/activity" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-52 rounded" />
                    <Skeleton className="h-2.5 w-28 rounded" />
                  </div>
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))
            ) : recentLogs.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-10">
                <Activity className="h-6 w-6 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              </div>
            ) : (
              recentLogs.map((log: any) => {
                const Icon = activityIconMap[log.event] ?? Activity;
                const colorClass = activityColorMap[log.event] ?? "text-slate-400 bg-slate-500/10";
                return (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", colorClass)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{log.description}</p>
                      <p className="text-[11px] font-mono text-muted-foreground/50">{log.event}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
