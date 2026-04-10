import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Server, Terminal, FolderOpen, Play, HardDrive, Clock, User, Home,
  LogOut, Menu, X, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import EghLogo from "@/components/ui/logo";
import { useListServers } from "@workspace/api-client-react";

const mainNav = [
  { href: "/client", icon: Home, label: "My Servers" },
  { href: "/client/account", icon: User, label: "Account" },
];

const serverNav = [
  { segment: "", icon: Server, label: "Overview" },
  { segment: "/console", icon: Terminal, label: "Console" },
  { segment: "/files", icon: FolderOpen, label: "Files" },
  { segment: "/startup", icon: Play, label: "Startup" },
  { segment: "/backups", icon: HardDrive, label: "Backups" },
  { segment: "/schedules", icon: Clock, label: "Schedules" },
];

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

  // Detect if we're on a server page
  const serverMatch = location.match(/^\/client\/servers\/(\d+)(.*)?$/);
  const currentServerId = serverMatch ? serverMatch[1] : null;
  const currentServer = servers.find((s) => String(s.id) === currentServerId);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex-col bg-[hsl(222,20%,8%)] border-r border-border transition-transform duration-200 lg:relative lg:flex lg:translate-x-0",
          sidebarOpen ? "flex translate-x-0" : "-translate-x-full",
          "flex flex-col"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <EghLogo variant="compact" subtitle="Client" />
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {/* Main nav */}
          <ul className="space-y-0.5 px-2 mb-4">
            {mainNav.map((item) => {
              const isActive = item.href === "/client"
                ? location === "/client"
                : location.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <a className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Server nav (when on a server page) */}
          {currentServerId && currentServer && (
            <div className="px-2">
              <div className="px-3 py-1.5 mb-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Server</div>
                <div className="text-sm font-medium text-foreground truncate mt-0.5">{currentServer.name}</div>
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
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {item.label}
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Servers list */}
          {servers.length > 0 && (
            <div className="px-2 mt-4">
              <div className="px-3 py-1.5 mb-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Servers</div>
              </div>
              <ul className="space-y-0.5">
                {servers.slice(0, 5).map((server) => (
                  <li key={server.id}>
                    <Link href={`/client/servers/${server.id}`}>
                      <a className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        currentServerId === String(server.id)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}>
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full flex-shrink-0",
                          server.status === "running" ? "bg-green-500" :
                          server.status === "offline" ? "bg-gray-500" :
                          server.status === "installing" ? "bg-yellow-500" : "bg-red-500"
                        )} />
                        <span className="truncate">{server.name}</span>
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
