import { useState } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useListSchedules, useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from "@workspace/api-client-react";
import { Clock, Plus, Trash2, Power } from "lucide-react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ServerSchedules() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: serverData } = useGetServer({ id });
  const { data, isLoading, refetch } = useListSchedules(id);
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();
  const { toast } = useToast();
  const server = serverData?.data;
  const schedules = data?.data ?? [];
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", cronExpression: "0 4 * * *", action: "power_start" as string, payload: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSchedule.mutateAsync({ id, data: form });
      toast({ title: "Schedule created" });
      setShowCreate(false);
      setForm({ name: "", cronExpression: "0 4 * * *", action: "power_start", payload: "" });
      refetch();
    } catch {
      toast({ title: "Failed to create schedule", variant: "destructive" });
    }
  }

  async function handleDelete(scheduleId: number) {
    if (!confirm("Delete this schedule?")) return;
    try {
      await deleteSchedule.mutateAsync({ id, scheduleId });
      toast({ title: "Schedule deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete schedule", variant: "destructive" });
    }
  }

  async function handleToggle(sched: any) {
    try {
      await updateSchedule.mutateAsync({ id, scheduleId: sched.id, data: { ...sched, isEnabled: !sched.isEnabled } });
      refetch();
    } catch {
      toast({ title: "Failed to toggle schedule", variant: "destructive" });
    }
  }

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Schedules`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Schedules</h2>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-schedule"
          >
            <Plus className="h-4 w-4" />
            New Schedule
          </button>
        </div>

        {showCreate && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Create Schedule</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                placeholder="Schedule Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required data-testid="input-schedule-name"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cron Expression</label>
                  <input
                    placeholder="0 4 * * *"
                    value={form.cronExpression}
                    onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required data-testid="input-cron"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Action</label>
                  <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    data-testid="select-action">
                    <option value="power_start">Power: Start</option>
                    <option value="power_stop">Power: Stop</option>
                    <option value="power_restart">Power: Restart</option>
                    <option value="command">Run Command</option>
                    <option value="backup">Create Backup</option>
                  </select>
                </div>
              </div>
              {form.action === "command" && (
                <input
                  placeholder="Command to run"
                  value={form.payload}
                  onChange={(e) => setForm({ ...form, payload: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={createSchedule.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {createSchedule.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
            No schedules configured. Create one to automate server tasks.
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((sched: any) => (
              <div key={sched.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4" data-testid={`card-schedule-${sched.id}`}>
                <button
                  onClick={() => handleToggle(sched)}
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors",
                    sched.isEnabled ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-gray-500/15 text-gray-400 hover:bg-gray-500/25"
                  )}
                  data-testid={`button-toggle-schedule-${sched.id}`}
                >
                  <Power className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{sched.name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs font-mono text-muted-foreground">{sched.cronExpression}</code>
                    <span className="text-xs text-muted-foreground">{sched.action}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(sched.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    data-testid={`button-delete-schedule-${sched.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
