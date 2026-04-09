import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard, Users, Server, Cpu, Egg, Activity, Settings,
  LogOut, Menu, X, ChevronDown, Shield, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/servers", icon: Server, label: "Servers" },
  { href: "/admin/nodes", icon: Cpu, label: "Nodes" },
  { href: "/admin/eggs", icon: Egg, label: "Eggs & Nests" },
  { href: "/admin/activity", icon: Activity, label: "Activity" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

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
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground">EGH Panel</span>
            <div className="text-xs text-muted-foreground">Admin</div>
          </div>
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => {
              const isActive = item.href === "/admin"
                ? location === "/admin"
                : location.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <a
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>
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
        {/* Topbar */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">
              {user?.role?.replace("_", " ").toUpperCase()}
            </span>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
