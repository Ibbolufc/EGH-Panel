import { AdminLayout } from "@/components/layout/admin-layout";
import { useListActivity } from "@workspace/api-client-react";
import { Activity, LogIn, Server, User, Database, Shield, RefreshCcw } from "lucide-react";
import { useState } from "react";

const eventIcons: Record<string, any> = {
  "auth.login": LogIn,
  "auth.logout": LogIn,
  "server.power.start": Server,
  "server.power.stop": Server,
  "server.power.restart": Server,
  "server.created": Server,
  "server.deleted": Server,
  "user.created": User,
  "user.updated": User,
  "user.deleted": User,
  "backup.created": Database,
  "backup.deleted": Database,
  "egg.imported": Shield,
};

const eventColors: Record<string, string> = {
  "auth.login": "text-green-400 bg-green-500/10",
  "server.power.start": "text-green-400 bg-green-500/10",
  "server.power.stop": "text-gray-400 bg-gray-500/10",
  "server.power.restart": "text-yellow-400 bg-yellow-500/10",
  "server.created": "text-blue-400 bg-blue-500/10",
  "server.deleted": "text-red-400 bg-red-500/10",
  "user.created": "text-violet-400 bg-violet-500/10",
  "egg.imported": "text-orange-400 bg-orange-500/10",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useListActivity({ page, limit: 30 });
  const logs = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <AdminLayout title="Activity">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Activity Log</h2>
            <p className="text-sm text-muted-foreground mt-1">{total} total events recorded</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No activity recorded yet.</div>
          ) : (
            logs.map((log: any) => {
              const Icon = eventIcons[log.event] ?? Activity;
              const colorClass = eventColors[log.event] ?? "text-gray-400 bg-gray-500/10";
              return (
                <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-white/5 transition-colors" data-testid={`row-activity-${log.id}`}>
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{log.description}</div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{log.event}</span>
                      {log.ip && <span className="text-xs text-muted-foreground">{log.ip}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(log.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>

        {total > 30 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 30)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/5 disabled:opacity-50 transition-colors">
                Previous
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/5 disabled:opacity-50 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
