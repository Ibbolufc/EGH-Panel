import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useChangePassword, customFetch } from "@workspace/api-client-react";
import { Shield, Lock, Server, CheckCircle2, Loader2, Eye, EyeOff, Info, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

function CardHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-3.5 border-b border-border/40">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground leading-none">{title}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value?: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
            {item.label}
          </dt>
          <dd className="text-sm font-medium text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function PasswordInput({ value, onChange, placeholder, testId }: {
  value: string; onChange: (v: string) => void; placeholder: string; testId?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "pr-10")}
        required
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSuccess, setPwSuccess] = useState(false);
  const changePassword = useChangePassword();
  const { toast } = useToast();

  const passwordsMatch = pwForm.confirmPassword.length > 0 && pwForm.newPassword === pwForm.confirmPassword;
  const passwordsMismatch = pwForm.confirmPassword.length > 0 && pwForm.newPassword !== pwForm.confirmPassword;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    try {
      await changePassword.mutateAsync({ data: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword } });
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password updated" });
      setTimeout(() => setPwSuccess(false), 5000);
    } catch {
      toast({ title: "Incorrect current password", variant: "destructive" });
    }
  }

  const [nodeVersion, setNodeVersion] = useState("latest");
  const [nodeVersionInput, setNodeVersionInput] = useState("latest");
  const [versionLoading, setVersionLoading] = useState(true);
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionSaved, setVersionSaved] = useState(false);

  useEffect(() => {
    customFetch<{ version: string }>("/api/settings/egh-node-version")
      .then((data) => {
        setNodeVersion(data.version);
        setNodeVersionInput(data.version);
      })
      .catch(() => {})
      .finally(() => setVersionLoading(false));
  }, []);

  async function handleVersionSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nodeVersionInput.trim();
    if (!trimmed) return;
    setVersionSaving(true);
    try {
      const data = await customFetch<{ version: string }>("/api/settings/egh-node-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: trimmed }),
      });
      setNodeVersion(data.version);
      setNodeVersionInput(data.version);
      setVersionSaved(true);
      toast({ title: "Agent version updated" });
      setTimeout(() => setVersionSaved(false), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save version";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setVersionSaving(false);
    }
  }

  return (
    <AdminLayout title="Settings">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Account details and panel configuration</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <CardHeader icon={Shield} title="Account" desc="Your identity on this panel" />
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/3 border border-border/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold ring-1 ring-primary/30 text-sm">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="ml-auto shrink-0">
                  {user?.role && <StatusBadge status={user.role} />}
                </div>
              </div>
              <InfoGrid items={[
                { label: "Username",  value: user?.username },
                { label: "Email",     value: user?.email },
                { label: "Full Name", value: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() },
                { label: "Role",      value: user?.role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
              ]} />
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <CardHeader icon={Server} title="Panel Information" />
              <InfoGrid items={[
                { label: "Panel Name",        value: "EGH Panel" },
                { label: "Version",           value: "1.0.0" },
                { label: "Egg Compatibility", value: "Pterodactyl JSON v1" },
                { label: "Status",            value: <StatusBadge status="online" /> },
              ]} />
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/40 bg-white/2 p-3 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
                <span>EGH Panel is compatible with Pterodactyl egg JSON files. Import eggs from the Eggs &amp; Nests page.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <CardHeader icon={Lock} title="Change Password" desc="Use a strong password of at least 8 characters" />

              {pwSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 mb-4 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Password updated successfully
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3.5">
                <div>
                  <label className={labelClass}>Current Password</label>
                  <PasswordInput
                    value={pwForm.currentPassword}
                    onChange={(v) => setPwForm({ ...pwForm, currentPassword: v })}
                    placeholder="Your current password"
                    testId="input-current-password"
                  />
                </div>
                <div>
                  <label className={labelClass}>New Password</label>
                  <PasswordInput
                    value={pwForm.newPassword}
                    onChange={(v) => setPwForm({ ...pwForm, newPassword: v })}
                    placeholder="At least 8 characters"
                    testId="input-new-password"
                  />
                </div>
                <div>
                  <label className={cn(labelClass, passwordsMismatch && "text-red-400")}>
                    Confirm New Password
                  </label>
                  <PasswordInput
                    value={pwForm.confirmPassword}
                    onChange={(v) => setPwForm({ ...pwForm, confirmPassword: v })}
                    placeholder="Re-enter new password"
                    testId="input-confirm-password"
                  />
                  {passwordsMismatch && (
                    <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
                  )}
                  {passwordsMatch && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={changePassword.isPending || passwordsMismatch}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                    data-testid="button-change-password"
                  >
                    {changePassword.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                    ) : "Update Password"}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <CardHeader
                icon={Download}
                title="EGH Node Agent Version"
                desc="Version served to new nodes via the install script"
              />

              {versionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <form onSubmit={handleVersionSave} className="space-y-3.5">
                  {versionSaved && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Version updated — new installs will use <strong className="ml-1">{nodeVersion}</strong>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Binary Version</label>
                    <input
                      type="text"
                      value={nodeVersionInput}
                      onChange={(e) => setNodeVersionInput(e.target.value)}
                      placeholder='e.g. latest or v1.11.14'
                      className={inputClass}
                      data-testid="input-node-version"
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-white/2 p-3 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
                    <span>
                      Use <code className="font-mono text-foreground/70">latest</code> to always serve the newest release, or pin to a specific tag like <code className="font-mono text-foreground/70">v1.11.14</code>. Changes take effect immediately — no redeploy needed.
                    </span>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={versionSaving || !nodeVersionInput.trim() || nodeVersionInput.trim() === nodeVersion}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                      data-testid="button-save-node-version"
                    >
                      {versionSaving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                      ) : "Save Version"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
