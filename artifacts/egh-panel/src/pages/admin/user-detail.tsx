import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetUser, useUpdateUser, useListServers, useDeleteUser, useListUsers } from "@workspace/api-client-react";
import type { UserDetail, Server, UpdateUserBodyRole } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronRight, User, Users, Server as ServerIcon, Shield,
  Loader2, Save, MemoryStick, HardDrive, Mail, Calendar, Trash2, AlertTriangle,
} from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
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

type TabId = "overview" | "servers";
const VALID_TABS: TabId[] = ["overview", "servers"];

function getTabFromSearch(): TabId {
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return VALID_TABS.includes(t as TabId) ? (t as TabId) : "overview";
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>(getTabFromSearch);
  const { toast } = useToast();

  const { data: userData, isLoading, refetch } = useGetUser(userId);
  const user = userData as (UserDetail & { servers?: Server[] }) | undefined;

  // Fetches up to 100 servers and filters client-side. If a user has >100 servers
  // this will undercount — a server-side userId filter would be more robust.
  const { data: serversData } = useListServers({ page: 1, limit: 100 });
  const allServers: Server[] = serversData?.data ?? [];
  const userServers = allServers.filter((s: Server) => s.userId === userId);

  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { data: usersData } = useListUsers({ limit: 100 });
  const otherUsers = (usersData?.data ?? []).filter((u) => u.id !== userId);

  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "client" as UpdateUserBodyRole });
  const [formDirty, setFormDirty] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"none" | "delete" | "reassign">("none");
  const [reassignToId, setReassignToId] = useState<number | "">("");

  useEffect(() => {
    if (user) {
      setForm({ email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role as UpdateUserBodyRole });
    }
  }, [user]);

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

  function handleFormChange(field: string, value: string | UpdateUserBodyRole) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateUser.mutateAsync({ id: userId, data: form });
      toast({ title: "User updated" });
      setFormDirty(false);
      refetch();
    } catch {
      toast({ title: "Failed to update user", variant: "destructive" });
    }
  }

  function openDeleteConfirm() {
    setDeleteAction("none");
    setReassignToId("");
    setDeleteConfirm(true);
  }

  function cancelDeleteConfirm() {
    setDeleteConfirm(false);
    setDeleteAction("none");
    setReassignToId("");
  }

  async function handleDelete() {
    const hasServers = userServers.length > 0;
    if (hasServers && deleteAction === "none") return;
    if (hasServers && deleteAction === "reassign" && !reassignToId) return;
    try {
      await deleteUser.mutateAsync({
        id: userId,
        serverAction: hasServers ? (deleteAction as "delete" | "reassign") : undefined,
        reassignTo: deleteAction === "reassign" && reassignToId ? Number(reassignToId) : undefined,
      });
      toast({ title: "User deleted" });
      navigate("/admin/users");
    } catch {
      toast({ title: "Failed to delete user", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="User">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/users" className="hover:text-foreground transition-colors">Users</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout title="User">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">User not found</p>
          <Link href="/admin/users" className="mt-3 text-xs text-primary hover:underline">Back to users</Link>
        </div>
      </AdminLayout>
    );
  }

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <AdminLayout title={`${user.firstName} ${user.lastName}`}>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/users" className="hover:text-foreground transition-colors">Users</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{user.firstName} {user.lastName}</span>
        </nav>

        {/* Header card */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="p-5 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-lg font-bold ring-2 ring-primary/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="shrink-0">
              <StatusBadge status={user.role} />
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-t border-border/40 px-4 py-2 flex items-center gap-1">
            <TabBtn active={tab === "overview"} onClick={() => handleTabChange("overview")} icon={User} label="Profile" />
            <TabBtn active={tab === "servers"} onClick={() => handleTabChange("servers")} icon={ServerIcon} label={`Servers${userServers.length > 0 ? ` (${userServers.length})` : ""}`} />
          </div>
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Profile info */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={User} title="Profile" subtitle="Identity and account info" />
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      value={form.firstName}
                      onChange={(e) => handleFormChange("firstName", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      value={form.lastName}
                      onChange={(e) => handleFormChange("lastName", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => handleFormChange("role", e.target.value as UpdateUserBodyRole)}
                    className={inputClass}
                  >
                    <option value="client">Client — server access only</option>
                    <option value="admin">Admin — full panel access</option>
                    <option value="super_admin">Super Admin — unrestricted</option>
                  </select>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!formDirty || updateUser.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updateUser.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Account details */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <SectionHeader icon={Shield} title="Account Details" subtitle="Read-only metadata" />
              <dl className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <dt className="text-xs text-muted-foreground w-24 shrink-0">Username</dt>
                  <dd className="text-sm font-medium text-foreground font-mono">{user.username}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <dt className="text-xs text-muted-foreground w-24 shrink-0">Status</dt>
                  <dd>
                    <StatusBadge status={user.isActive ? "online" : "offline"} />
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <dt className="text-xs text-muted-foreground w-24 shrink-0">Joined</dt>
                  <dd className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <ServerIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <dt className="text-xs text-muted-foreground w-24 shrink-0">Servers</dt>
                  <dd className="text-sm font-medium text-foreground">{userServers.length}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-destructive/40 bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Danger Zone</h3>
                <p className="text-xs text-muted-foreground">Irreversible actions — proceed with care</p>
              </div>
            </div>

            {!deleteConfirm ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete this user</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently removes the account and all associated data.</p>
                </div>
                <button
                  type="button"
                  onClick={openDeleteConfirm}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  data-testid="button-open-delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete User
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Are you sure you want to delete <span className="font-semibold">{user.firstName} {user.lastName}</span>?</p>
                  <p className="text-xs text-muted-foreground mt-1">This action cannot be undone. The user account will be permanently removed.</p>
                </div>

                {userServers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      What should happen to their {userServers.length} server{userServers.length !== 1 ? "s" : ""}?
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setDeleteAction("delete")}
                        data-testid="button-action-delete-servers"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                          deleteAction === "delete"
                            ? "border-destructive/70 bg-destructive/10 text-foreground"
                            : "border-border/60 hover:border-destructive/40 hover:bg-white/5 text-muted-foreground",
                        )}
                      >
                        <Trash2 className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                        <div>
                          <p className="text-sm font-medium leading-tight">Delete all servers</p>
                          <p className="text-xs mt-0.5 text-muted-foreground">Permanently remove all {userServers.length} server{userServers.length !== 1 ? "s" : ""}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteAction("reassign")}
                        data-testid="button-action-reassign-servers"
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                          deleteAction === "reassign"
                            ? "border-primary/70 bg-primary/10 text-foreground"
                            : "border-border/60 hover:border-primary/40 hover:bg-white/5 text-muted-foreground",
                        )}
                      >
                        <Users className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-sm font-medium leading-tight">Reassign to another user</p>
                          <p className="text-xs mt-0.5 text-muted-foreground">Transfer ownership before deleting</p>
                        </div>
                      </button>
                    </div>

                    {deleteAction === "reassign" && (
                      <div className="pt-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Transfer servers to</label>
                        <select
                          value={reassignToId}
                          onChange={(e) => setReassignToId(e.target.value ? Number(e.target.value) : "")}
                          data-testid="select-reassign-target"
                          className="w-full rounded-lg border border-border/60 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors"
                        >
                          <option value="">— Select a user —</option>
                          {otherUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {deleteAction === "none" && (
                      <p className="text-xs text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Choose what to do with their servers to continue.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={
                      deleteUser.isPending ||
                      (userServers.length > 0 && deleteAction === "none") ||
                      (userServers.length > 0 && deleteAction === "reassign" && !reassignToId)
                    }
                    data-testid="button-confirm-delete"
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteUser.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> Yes, Delete User</>}
                  </button>
                  <button
                    type="button"
                    onClick={cancelDeleteConfirm}
                    disabled={deleteUser.isPending}
                    data-testid="button-cancel-delete"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        {/* Servers tab */}
        {tab === "servers" && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <SectionHeader icon={ServerIcon} title="Servers" subtitle={`${userServers.length} server${userServers.length !== 1 ? "s" : ""} assigned to this user`} />
            </div>
            {userServers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ServerIcon className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No servers</p>
                <p className="text-xs text-muted-foreground mt-1">This user has no servers assigned.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-white/3">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Server</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Resources</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Node</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {userServers.map((server) => (
                    <tr key={server.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <ServerIcon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/admin/servers/${server.id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate block">
                              {server.name}
                            </Link>
                            <div className="text-xs text-muted-foreground truncate">{server.description || "No description"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap"><StatusBadge status={server.status} /></td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MemoryStick className="h-3 w-3 shrink-0" />{formatMB(server.memoryLimit)} RAM
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <HardDrive className="h-3 w-3 shrink-0" />{formatMB(server.diskLimit)} Disk
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{server.nodeName || `Node #${server.nodeId}`}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
