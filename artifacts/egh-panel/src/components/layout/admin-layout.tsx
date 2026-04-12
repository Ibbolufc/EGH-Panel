import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard, Users, Server, Cpu, Egg, Activity, Settings,
  LogOut, Menu, X, Globe, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import EghLogo from "@/components/ui/logo";

const mainNavItems = [
  { href: "/admin",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/users",    icon: Users,            label: "Users" },
  { href: "/admin/servers",  icon: Server,           label: "Servers" },
  { href: "/admin/nodes",    icon: Cpu,              label: "Nodes" },
  { href: "/admin/eggs",     icon: Egg,              label: "Eggs & Nests" },
  { href: "/admin/activity", icon: Activity,         label: "Activity" },
];

const bottomNavItems = [
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

function NavItem({ item, isActive }: { item: typeof mainNavItems[0]; isActive: boolean }) {
  return (
    <li>
      <Link href={item.href}>
        <a
          className={cn(
            "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
            isActive
              ? "bg-primary/12 font-semibold text-primary"
              : "font-medium text-muted-foreground/80 hover:bg-white/5 hover:text-foreground"
          )}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {isActive && (
            <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary shadow-[0_0_6px] shadow-primary/50" />
          )}
          <item.icon className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
          )} />
          <span className="flex-1 truncate">{item.label}</span>
          {isActive && <ChevronRight className="h-3 w-3 text-primary/40 shrink-0" />}
        </a>
      </Link>
    </li>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  function isActive(href: string) {
    return href === "/admin" ? location === "/admin" : location.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border/50 bg-[hsl(225,24%,5.5%)] transition-transform duration-200 lg:relative lg:flex lg:translate-x-0",
          sidebarOpen ? "flex translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area with subtle top glow */}
        <div className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border/40 px-4 overflow-hidden">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-24 rounded-full bg-primary/20 blur-xl pointer-events-none" />
          <EghLogo variant="compact" subtitle="Admin" />
          <button
            className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col overflow-y-auto py-3">
          {/* Main section */}
          <div className="flex-1 px-2">
            <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Manage
            </p>
            <ul className="space-y-0.5">
              {mainNavItems.map((item) => (
                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
              ))}
            </ul>
          </div>

          {/* Config section at bottom */}
          <div className="px-2 pt-2 mt-2 border-t border-border/30">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Config
            </p>
            <ul className="space-y-0.5">
              {bottomNavItems.map((item) => (
                <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
              ))}
            </ul>
          </div>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-border/40 p-2">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 bg-white/3 border border-border/30">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[11px] font-bold ring-1 ring-primary/30">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground leading-tight">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="truncate text-[10px] text-muted-foreground/70 leading-tight">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/70 hover:bg-red-500/8 hover:text-red-400 transition-colors"
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
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border/50 bg-background/95 px-5 backdrop-blur-sm">
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            {title && (
              <>
                <span className="text-xs text-muted-foreground/50">Admin</span>
                <span className="text-muted-foreground/30">/</span>
                <h1 className="text-xs font-semibold text-foreground truncate">{title}</h1>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground/30" />
            <span className="rounded-md border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary/80 tracking-wide">
              {user?.role?.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
