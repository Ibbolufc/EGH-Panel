import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useChangePassword } from "@workspace/api-client-react";
import { Shield, Lock, Server, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider";

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 mb-4 border-b border-border/40">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function PasswordInput({
  value, onChange, placeholder, testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId?: string;
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
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
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    try {
      await changePassword.mutateAsync({
        data: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      });
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setTimeout(() => setPwSuccess(false), 5000);
    } catch {
      toast({ title: "Incorrect current password", description: "Please check your current password and try again.", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl space-y-5">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage your account and view panel information</p>
        </div>

        {/* Account Information */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <SectionHeader icon={Shield} title="Account Information" desc="Your profile details and role" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Full Name" value={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Username" value={user?.username} />
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Role</dt>
              <dd>{user?.role ? <StatusBadge status={user.role} /> : "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Change Password */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <SectionHeader icon={Lock} title="Change Password" desc="Use a strong password of at least 12 characters" />

          {pwSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 mb-4 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated successfully
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className={labelClass}>Current Password</label>
              <PasswordInput
                value={pwForm.currentPassword}
                onChange={(v) => setPwForm({ ...pwForm, currentPassword: v })}
                placeholder="Enter your current password"
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
              <div className="relative">
                <PasswordInput
                  value={pwForm.confirmPassword}
                  onChange={(v) => setPwForm({ ...pwForm, confirmPassword: v })}
                  placeholder="Re-enter new password"
                  testId="input-confirm-password"
                />
              </div>
              {passwordsMismatch && (
                <p className="mt-1.5 text-xs text-red-400">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={changePassword.isPending || passwordsMismatch}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-change-password"
            >
              {changePassword.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>

        {/* Panel Information */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <SectionHeader icon={Server} title="Panel Information" desc="EGH Panel version and compatibility" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Panel Name" value="EGH Panel" />
            <InfoRow label="Version" value="1.0.0" />
            <InfoRow label="Egg Compatibility" value="Pterodactyl JSON v1" />
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Status</dt>
              <dd><StatusBadge status="online" /></dd>
            </div>
          </dl>
        </div>
      </div>
    </AdminLayout>
  );
}
