import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useChangePassword } from "@workspace/api-client-react";
import { Shield, Lock, Bell, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const changePassword = useChangePassword();
  const { toast } = useToast();

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    try {
      await changePassword.mutateAsync({ data: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword } });
      toast({ title: "Password updated successfully" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      toast({ title: "Failed to update password. Check current password.", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Settings">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your account and panel configuration</p>
        </div>

        {/* Account Info */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Account Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name", value: `${user?.firstName} ${user?.lastName}` },
              { label: "Email", value: user?.email },
              { label: "Username", value: user?.username },
              { label: "Role", value: user?.role?.replace("_", " ").toUpperCase() },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className="text-sm text-foreground font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input
              type="password"
              placeholder="Current Password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
              data-testid="input-current-password"
            />
            <input
              type="password"
              placeholder="New Password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
              data-testid="input-new-password"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              required
              data-testid="input-confirm-password"
            />
            <button type="submit" disabled={changePassword.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-change-password">
              {changePassword.isPending ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {/* Panel Info */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Panel Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Panel Name", value: "EGH Panel" },
              { label: "Version", value: "1.0.0" },
              { label: "Status", value: "Operational" },
              { label: "Pterodactyl Compatibility", value: "Egg JSON v1" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className="text-sm text-foreground font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
