import { useState } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useListBackups, useCreateBackup, useDeleteBackup } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { HardDrive, Plus, Trash2, Download, RefreshCcw } from "lucide-react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ServerBackups() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: serverData } = useGetServer({ id });
  const { data, isLoading, refetch } = useListBackups(id);
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const { toast } = useToast();
  const server = serverData?.data;
  const backups = data?.data ?? [];

  async function handleCreate() {
    try {
      await createBackup.mutateAsync({ id, data: { name: `Backup ${new Date().toLocaleString()}` } });
      toast({ title: "Backup started" });
      refetch();
    } catch {
      toast({ title: "Failed to create backup", variant: "destructive" });
    }
  }

  async function handleDelete(backupId: string) {
    if (!confirm("Delete this backup?")) return;
    try {
      await deleteBackup.mutateAsync({ id, backupId });
      toast({ title: "Backup deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete backup", variant: "destructive" });
    }
  }

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Backups`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Backups</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-muted-foreground hover:bg-white/10 transition-colors">
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleCreate}
              disabled={createBackup.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid="button-create-backup"
            >
              <Plus className="h-4 w-4" />
              {createBackup.isPending ? "Creating..." : "Create Backup"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Created</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
              ) : backups.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No backups yet. Create your first backup above.</td></tr>
              ) : (
                backups.map((backup: any) => (
                  <tr key={backup.uuid} className="hover:bg-white/5 transition-colors" data-testid={`row-backup-${backup.uuid}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{backup.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{backup.uuid?.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={backup.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(backup.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {backup.status === "completed" && (
                          <button className="p-1.5 rounded hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(backup.uuid)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          data-testid={`button-delete-backup-${backup.uuid}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ClientLayout>
  );
}
