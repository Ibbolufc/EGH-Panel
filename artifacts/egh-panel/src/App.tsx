import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Landing from "@/pages/landing";
import Setup from "@/pages/setup";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminServers from "@/pages/admin/servers";
import AdminNodes from "@/pages/admin/nodes";
import AdminEggs from "@/pages/admin/eggs";
import AdminActivity from "@/pages/admin/activity";
import AdminSettings from "@/pages/admin/settings";

import ClientDashboard from "@/pages/client/dashboard";
import ServerOverview from "@/pages/client/server-overview";
import ServerConsole from "@/pages/client/server-console";
import ServerFiles from "@/pages/client/server-files";
import ServerStartup from "@/pages/client/server-startup";
import ServerBackups from "@/pages/client/server-backups";
import ServerSchedules from "@/pages/client/server-schedules";
import Account from "@/pages/client/account";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchSetupStatus(): Promise<{ setupRequired: boolean }> {
  const res = await fetch(`${API_BASE}/api/setup/status`);
  if (!res.ok) throw new Error("Could not fetch setup status");
  return res.json() as Promise<{ setupRequired: boolean }>;
}

/**
 * SetupGuard — sits inside the Router so useLocation is available.
 *
 * Rules:
 *  • setupRequired=true  + not on /setup → redirect to /setup
 *  • setupRequired=false + on /setup     → redirect to /login
 *  • While loading: show a full-screen spinner (same style as ProtectedRoute)
 *  • On error: let through so the app can show a useful page instead of freezing
 */
function SetupGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: fetchSetupStatus,
    staleTime: Infinity,
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (data?.setupRequired && location !== "/setup") {
    return <Redirect to="/setup" />;
  }

  if (data && !data.setupRequired && location === "/setup") {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component, allowedRoles, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "client" ? "/client" : "/admin"} />;
  }

  return <Component {...rest} />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return <ProtectedRoute component={Component} allowedRoles={["admin", "super_admin"]} />;
}

function ClientRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return <ProtectedRoute component={Component} allowedRoles={["client", "admin", "super_admin"]} />;
}

function Router() {
  return (
    <SetupGuard>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/setup" component={Setup} />

        {/* Admin Routes */}
        <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
        <Route path="/admin/users">{() => <AdminRoute component={AdminUsers} />}</Route>
        <Route path="/admin/servers">{() => <AdminRoute component={AdminServers} />}</Route>
        <Route path="/admin/nodes">{() => <AdminRoute component={AdminNodes} />}</Route>
        <Route path="/admin/eggs">{() => <AdminRoute component={AdminEggs} />}</Route>
        <Route path="/admin/activity">{() => <AdminRoute component={AdminActivity} />}</Route>
        <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>

        {/* Client Routes */}
        <Route path="/client">{() => <ClientRoute component={ClientDashboard} />}</Route>
        <Route path="/client/account">{() => <ClientRoute component={Account} />}</Route>
        <Route path="/client/servers/:id">{() => <ClientRoute component={ServerOverview} />}</Route>
        <Route path="/client/servers/:id/console">{() => <ClientRoute component={ServerConsole} />}</Route>
        <Route path="/client/servers/:id/files">{() => <ClientRoute component={ServerFiles} />}</Route>
        <Route path="/client/servers/:id/startup">{() => <ClientRoute component={ServerStartup} />}</Route>
        <Route path="/client/servers/:id/backups">{() => <ClientRoute component={ServerBackups} />}</Route>
        <Route path="/client/servers/:id/schedules">{() => <ClientRoute component={ServerSchedules} />}</Route>

        <Route component={NotFound} />
      </Switch>
    </SetupGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
