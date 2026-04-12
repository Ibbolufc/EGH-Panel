import { cn } from "@/lib/utils";

type ServerStatus = "running" | "offline" | "installing" | "install_failed" | "stopping" | "starting" | "suspended";
type NodeStatus = "online" | "offline" | "maintenance";
type BackupStatus = "created" | "in_progress" | "completed" | "failed" | "deleted";

interface StatusConfig {
  label: string;
  dotClass: string;
  badgeClass: string;
  pulse?: boolean;
}

const statusConfig: Record<string, StatusConfig> = {
  running:       { label: "Running",       dotClass: "bg-emerald-400",   badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", pulse: true },
  online:        { label: "Online",        dotClass: "bg-emerald-400",   badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", pulse: true },
  starting:      { label: "Starting",      dotClass: "bg-sky-400",       badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20", pulse: true },
  stopping:      { label: "Stopping",      dotClass: "bg-amber-400",     badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20", pulse: true },
  installing:    { label: "Installing",    dotClass: "bg-yellow-400",    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", pulse: true },
  in_progress:   { label: "In Progress",   dotClass: "bg-sky-400",       badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20", pulse: true },
  offline:       { label: "Offline",       dotClass: "bg-slate-500",     badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  suspended:     { label: "Suspended",     dotClass: "bg-red-400",       badgeClass: "bg-red-500/10 text-red-400 border-red-500/20" },
  install_failed:{ label: "Failed",        dotClass: "bg-red-400",       badgeClass: "bg-red-500/10 text-red-400 border-red-500/20" },
  failed:        { label: "Failed",        dotClass: "bg-red-400",       badgeClass: "bg-red-500/10 text-red-400 border-red-500/20" },
  maintenance:   { label: "Maintenance",   dotClass: "bg-orange-400",    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  pending:       { label: "Pending",       dotClass: "bg-amber-400",     badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20", pulse: true },
  completed:     { label: "Completed",     dotClass: "bg-emerald-400",   badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  created:       { label: "Created",       dotClass: "bg-slate-400",     badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  deleted:       { label: "Deleted",       dotClass: "bg-slate-500",     badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  admin:         { label: "Admin",         dotClass: "bg-sky-400",       badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  super_admin:   { label: "Super Admin",   dotClass: "bg-violet-400",    badgeClass: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  client:        { label: "Client",        dotClass: "bg-slate-400",     badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    dotClass: "bg-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide",
        config.badgeClass,
        className
      )}
      data-testid={`status-badge-${status}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          config.dotClass,
          config.pulse && "status-pulse"
        )}
      />
      {config.label}
    </span>
  );
}
