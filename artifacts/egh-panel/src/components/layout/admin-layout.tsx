import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard, Users, Server, Cpu, Egg, Activity, Settings,
  LogOut, Menu, X, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import EghLogo from "@/components/ui/logo";

const navItems = [
  { href: "/admin",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users",    icon: Users,            label: "Users" },
  { href: "/admin/servers",  icon: Server,           label: "Servers" },
  { href: "/admin/nodes",    icon: Cpu,              label: "Nodes" },
  { href: "/admin/eggs",     icon: Egg,              label: "Eggs & Nests" },
  { href: "/admin/activity", icon: Activity,         label: "Activity" },
  { href: "/admin/settings", icon: Settings,         label: "Settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

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
          <EghLogo variant="compact" subtitle="Admin" />
          <button
            className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="px-2">
            <p className="section-label px-3 pb-2 pt-1">Navigation</p>
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = item.href === "/admin"
                  ? location === "/admin"
                  : location.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <a
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                        )}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
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
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/60 bg-background/95 px-5 backdrop-blur-sm">
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Globe className="h-4 w-4 text-muted-foreground/40" />
            <span className="rounded-md border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">
              {user?.role?.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
