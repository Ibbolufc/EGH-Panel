import { cn } from "@/lib/utils";

type ServerStatus = "running" | "offline" | "installing" | "install_failed" | "stopping" | "starting" | "suspended";
type NodeStatus = "online" | "offline" | "maintenance";
type BackupStatus = "created" | "in_progress" | "completed" | "failed" | "deleted";

const statusConfig: Record<string, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  online: { label: "Online", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  offline: { label: "Offline", className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
  installing: { label: "Installing", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  install_failed: { label: "Failed", className: "bg-red-500/15 text-red-400 border-red-500/20" },
  stopping: { label: "Stopping", className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  starting: { label: "Starting", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  suspended: { label: "Suspended", className: "bg-red-500/15 text-red-400 border-red-500/20" },
  maintenance: { label: "Maintenance", className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  completed: { label: "Completed", className: "bg-green-500/15 text-green-400 border-green-500/20" },
  in_progress: { label: "In Progress", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-400 border-red-500/20" },
  created: { label: "Created", className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
  deleted: { label: "Deleted", className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
  admin: { label: "Admin", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  super_admin: { label: "Super Admin", className: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  client: { label: "Client", className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-500/15 text-gray-400 border-gray-500/20" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
      data-testid={`status-badge-${status}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}
