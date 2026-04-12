import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Server, Terminal, FolderOpen, Play, HardDrive, Clock, User, Home,
  LogOut, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import EghLogo from "@/components/ui/logo";
import { useListServers } from "@workspace/api-client-react";

const mainNav = [
  { href: "/client",         icon: Home, label: "My Servers" },
  { href: "/client/account", icon: User, label: "Account" },
];

const serverNav = [
  { segment: "",           icon: Server,      label: "Overview" },
  { segment: "/console",   icon: Terminal,    label: "Console" },
  { segment: "/files",     icon: FolderOpen,  label: "Files" },
  { segment: "/startup",   icon: Play,        label: "Startup" },
  { segment: "/backups",   icon: HardDrive,   label: "Backups" },
  { segment: "/schedules", icon: Clock,       label: "Schedules" },
];

const statusDotClass: Record<string, string> = {
  running:    "bg-emerald-400 status-pulse",
  online:     "bg-emerald-400 status-pulse",
  starting:   "bg-sky-400 status-pulse",
  stopping:   "bg-amber-400 status-pulse",
  installing: "bg-yellow-400 status-pulse",
  offline:    "bg-slate-500",
  suspended:  "bg-red-400",
  failed:     "bg-red-400",
};

interface ClientLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function ClientLayout({ children, title }: ClientLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: serversData } = useListServers();
  const servers = serversData?.data ?? [];

  const serverMatch = location.match(/^\/client\/servers\/(\d+)(.*)?$/);
  const currentServerId = serverMatch ? serverMatch[1] : null;
  const currentServer = servers.find((s) => String(s.id) === currentServerId);

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border/60 bg-[hsl(225,23%,6%)] transition-transform duration-200 lg:relative lg:flex lg:translate-x-0",
          sidebarOpen ? "flex translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/40 px-4">
          <EghLogo variant="compact" subtitle="Client" />
          <button
            className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Main nav */}
          <div className="px-2">
            <p className="section-label px-3 pb-2 pt-1">Menu</p>
            <ul className="space-y-0.5">
              {mainNav.map((item) => {
                const isActive = item.href === "/client"
                  ? location === "/client"
                  : location.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <a className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                      )}>
                        {isActive && (
                          <span className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-primary" />
                        )}
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        {item.label}
                      </a>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Server sub-nav when on a server page */}
          {currentServerId && currentServer && (
            <div className="px-2">
              <div className="px-3 pb-2">
                <p className="section-label pb-1">Current Server</p>
                <p className="text-xs font-semibold text-foreground truncate">{currentServer.name}</p>
              </div>
              <ul className="space-y-0.5">
                {serverNav.map((item) => {
                  const href = `/client/servers/${currentServerId}${item.segment}`;
                  const isActive = item.segment === ""
                    ? location === href
                    : location.startsWith(href);
                  return (
                    <li key={item.segment}>
                      <Link href={href}>
                        <a className={cn(
                          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                        )}>
                          {isActive && (
                            <span className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-primary" />
                          )}
                          <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          {item.label}
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Server list */}
          {servers.length > 0 && (
            <div className="px-2">
              <p className="section-label px-3 pb-2">Your Servers</p>
              <ul className="space-y-0.5">
                {servers.slice(0, 8).map((server) => {
                  const dotClass = statusDotClass[server.status] ?? "bg-slate-500";
                  const isSelected = currentServerId === String(server.id);
                  return (
                    <li key={server.id}>
                      <Link href={`/client/servers/${server.id}`}>
                        <a className={cn(
                          "group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all duration-150",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                        )}>
                          {isSelected && (
                            <span className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-primary" />
                          )}
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
                          <span className="truncate">{server.name}</span>
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-border/40 p-3 space-y-1">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold ring-1 ring-primary/30">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground leading-tight">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="truncate text-[11px] text-muted-foreground leading-tight">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/60 bg-background/95 px-5 backdrop-blur-sm">
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
