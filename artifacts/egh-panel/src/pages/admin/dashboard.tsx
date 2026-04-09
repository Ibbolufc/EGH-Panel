import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Server, Users, Cpu, Activity, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Link } from "wouter";

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useGetAdminStats();
  const stats = data?.data;

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Welcome to EGH Panel admin dashboard</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Server}
            label="Total Servers"
            value={stats?.totalServers ?? (isLoading ? "..." : 0)}
            sub={`${stats?.runningServers ?? 0} running`}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers ?? (isLoading ? "..." : 0)}
            sub="registered accounts"
            color="bg-violet-500/10 text-violet-400"
          />
          <StatCard
            icon={Cpu}
            label="Active Nodes"
            value={stats?.activeNodes ?? (isLoading ? "..." : 0)}
            sub={`of ${stats?.totalNodes ?? 0} nodes online`}
            color="bg-green-500/10 text-green-400"
          />
          <StatCard
            icon={Activity}
            label="Activity (24h)"
            value={stats?.recentActivity ?? (isLoading ? "..." : 0)}
            sub="events logged"
            color="bg-orange-500/10 text-orange-400"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Server Status Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { label: "Running", value: stats?.runningServers ?? 0, icon: CheckCircle, color: "text-green-400" },
                { label: "Installing", value: stats?.installingServers ?? 0, icon: Clock, color: "text-yellow-400" },
                { label: "Offline", value: Math.max(0, (stats?.totalServers ?? 0) - (stats?.runningServers ?? 0) - (stats?.installingServers ?? 0)), icon: AlertTriangle, color: "text-gray-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Manage Servers", href: "/admin/servers" },
                { label: "Add Node", href: "/admin/nodes" },
                { label: "Manage Users", href: "/admin/users" },
                { label: "View Activity", href: "/admin/activity" },
              ].map((action) => (
                <Link key={action.label} href={action.href}>
                  <a className="flex items-center justify-center rounded-md border border-border bg-white/5 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-white/10 transition-colors">
                    {action.label}
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
