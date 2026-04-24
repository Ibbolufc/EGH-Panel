import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListUsers, useCreateUser, useDeleteUser } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Search, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

const ROLE_FILTERS = [
  { label: "All",        value: "" },
  { label: "Client",     value: "client" },
  { label: "Admin",      value: "admin" },
  { label: "Super Admin", value: "super_admin" },
];

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data, isLoading, refetch } = useListUsers({ page: 1, limit: 100 });
  const deleteUser = useDeleteUser();
  const { toast } = useToast();

  const users = data?.data ?? [];

  const filtered = users.filter((u: any) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  async function handleDelete(id: number) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteUser.mutateAsync({ id });
      toast({ title: "User deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete user", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminLayout title="Users">
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Users</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${users.length} account${users.length !== 1 ? "s" : ""}${filtered.length !== users.length ? ` · ${filtered.length} shown` : ""}`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-user"
          >
            <Plus className="h-4 w-4" />
            New User
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search by name, email or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9")}
              data-testid="input-search-users"
            />
          </div>
          {/* Role filter pills */}
          <div className="flex gap-1.5 shrink-0 flex-wrap">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  roleFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {f.label}
                {f.value && !isLoading && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {users.filter((u: any) => u.role === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-white/3">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Username</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-28 rounded" />
                          <Skeleton className="h-2.5 w-36 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-3 w-20 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-md" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-3 w-20 rounded" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-14 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                        <Users className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {search || roleFilter ? "No users match these filters" : "No users yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {search || roleFilter ? "Try clearing the search or role filter" : "Create the first user account to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((user: any) => (
                  <tr key={user.id} className="hover:bg-white/3 transition-colors" data-testid={`row-user-${user.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold ring-1 ring-primary/20">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <code className="text-xs text-muted-foreground">{user.username}</code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={user.role} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Link href={`/admin/users/${user.id}`}>
                          <a
                            className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-white/8 hover:text-foreground transition-colors inline-flex items-center"
                            title="View user detail"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </a>
                        </Link>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                          className="rounded-md p-1.5 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                          data-testid={`button-delete-user-${user.id}`}
                          title="Delete user"
                        >
                          {deletingId === user.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showCreate && (
          <CreateUserModal
            onClose={() => setShowCreate(false)}
            onSuccess={() => { setShowCreate(false); refetch(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, pending, submitLabel, destructive }: { onClose: () => void; pending: boolean; submitLabel: string; destructive?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border/40">
      <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
        Cancel
      </button>
      <button type="submit" disabled={pending} className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50",
        destructive ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"
      )}>
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : submitLabel}
      </button>
    </div>
  );
}

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: "", username: "", firstName: "", lastName: "", password: "", role: "client" });
  const createUser = useCreateUser();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ data: form });
      toast({ title: "User created", description: `${form.firstName} ${form.lastName} can now sign in.` });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message ?? "Failed to create user", variant: "destructive" });
    }
  }

  return (
    <Modal title="Create User" subtitle="The user will be able to sign in immediately." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>First Name</label>
            <input placeholder="Jane" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} required data-testid="input-first-name" />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input placeholder="Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} required data-testid="input-last-name" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" placeholder="jane@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} required data-testid="input-email" />
        </div>
        <div>
          <label className={labelClass}>Username</label>
          <input placeholder="janedoe" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} required data-testid="input-username" />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} required minLength={8} data-testid="input-password" />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass} data-testid="select-role">
            <option value="client">Client — server access only</option>
            <option value="admin">Admin — full panel access</option>
            <option value="super_admin">Super Admin — unrestricted</option>
          </select>
        </div>
        <ModalFooter onClose={onClose} pending={createUser.isPending} submitLabel="Create User" />
      </form>
    </Modal>
  );
}

