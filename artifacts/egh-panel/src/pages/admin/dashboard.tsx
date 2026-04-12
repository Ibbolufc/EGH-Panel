import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetAdminStats } from "@workspace/api-client-react";
import {
  Server, Users, Cpu, Activity,
  CheckCircle2, Clock, AlertTriangle, ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  accentClass: string;
  iconBgClass: string;
}

function StatCard({ icon: Icon, label, value, sub, accentClass, iconBgClass }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <span className={cn("stat-card-accent", accentClass)} />
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value ?? "—"}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBgClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const quickActions = [
  { label: "Manage Servers", href: "/admin/servers", desc: "Start, stop, create" },
  { label: "Add Node",        href: "/admin/nodes",   desc: "Register a node" },
  { label: "Manage Users",   href: "/admin/users",   desc: "Accounts & roles" },
  { label: "View Activity",  href: "/admin/activity", desc: "Event log" },
];

export default function AdminDashboard() {
  const { data, isLoading } = useGetAdminStats();
  const stats = data?.data;
  const loading = isLoading ? "…" : 0;

  const offlineServers = Math.max(
    0,
    (stats?.totalServers ?? 0) - (stats?.runningServers ?? 0) - (stats?.installingServers ?? 0)
  );

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-7">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">System status and quick actions</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Server}
            label="Total Servers"
            value={stats?.totalServers ?? loading}
            sub={`${stats?.runningServers ?? 0} currently running`}
            accentClass="bg-sky-500"
            iconBgClass="bg-sky-500/10 text-sky-400"
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers ?? loading}
            sub="registered accounts"
            accentClass="bg-violet-500"
            iconBgClass="bg-violet-500/10 text-violet-400"
          />
          <StatCard
            icon={Cpu}
            label="Active Nodes"
            value={stats?.activeNodes ?? loading}
            sub={`of ${stats?.totalNodes ?? 0} nodes online`}
            accentClass="bg-emerald-500"
            iconBgClass="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard
            icon={Activity}
            label="Activity (24h)"
            value={stats?.recentActivity ?? loading}
            sub="events logged"
            accentClass="bg-orange-500"
            iconBgClass="bg-orange-500/10 text-orange-400"
          />
        </div>

        {/* Lower panels */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Server status breakdown */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Server Status</h3>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Running",
                  value: stats?.runningServers ?? 0,
                  icon: CheckCircle2,
                  dotClass: "bg-emerald-400",
                  textClass: "text-emerald-400",
                },
                {
                  label: "Installing",
                  value: stats?.installingServers ?? 0,
                  icon: Clock,
                  dotClass: "bg-yellow-400",
                  textClass: "text-yellow-400",
                },
                {
                  label: "Offline",
                  value: offlineServers,
                  icon: AlertTriangle,
                  dotClass: "bg-slate-500",
                  textClass: "text-slate-400",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", item.dotClass)} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums", item.textClass)}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link key={action.label} href={action.href}>
                  <a className="group flex flex-col gap-0.5 rounded-lg border border-border/50 bg-white/3 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {action.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{action.desc}</span>
                  </a>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
