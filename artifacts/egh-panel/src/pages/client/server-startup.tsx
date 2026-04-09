import { useState, useEffect } from "react";
import { ClientLayout } from "@/components/layout/client-layout";
import { useGetServer, useGetServerStartup, useUpdateServerStartup } from "@workspace/api-client-react";
import { Play, Save } from "lucide-react";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ServerStartup() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: serverData } = useGetServer({ id });
  const { data, isLoading, refetch } = useGetServerStartup(id);
  const updateVar = useUpdateServerStartup();
  const { toast } = useToast();
  const server = serverData?.data;
  const startup = data?.data;

  const [vars, setVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (startup?.variables) {
      const init: Record<string, string> = {};
      startup.variables.forEach((v: any) => { init[v.envVariable] = v.value ?? v.defaultValue ?? ""; });
      setVars(init);
    }
  }, [startup?.variables]);

  async function handleSave(envVariable: string) {
    try {
      await updateVar.mutateAsync({ id, data: { envVariable, value: vars[envVariable] } });
      toast({ title: "Variable saved" });
      refetch();
    } catch {
      toast({ title: "Failed to save variable", variant: "destructive" });
    }
  }

  return (
    <ClientLayout title={`${server?.name ?? "Server"} — Startup`}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Play className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Startup Variables</h2>
        </div>

        {/* Startup command preview */}
        {startup?.startup && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Startup Command</h3>
            <code className="text-xs font-mono text-green-400 bg-black/40 rounded-md p-3 block break-all">
              {startup.startup}
            </code>
          </div>
        )}

        {/* Variables */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : !startup?.variables?.length ? (
          <div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground">
            No startup variables configured for this server.
          </div>
        ) : (
          <div className="space-y-3">
            {startup.variables.map((v: any) => (
              <div key={v.envVariable} className="rounded-lg border border-border bg-card p-4" data-testid={`card-var-${v.envVariable}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{v.name}</div>
                    {v.description && <div className="text-xs text-muted-foreground">{v.description}</div>}
                  </div>
                  <code className="text-xs bg-white/5 border border-border rounded px-2 py-0.5 text-muted-foreground">
                    {v.envVariable}
                  </code>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vars[v.envVariable] ?? ""}
                    onChange={(e) => setVars({ ...vars, [v.envVariable]: e.target.value })}
                    disabled={!v.userEditable}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    placeholder={v.defaultValue || ""}
                    data-testid={`input-var-${v.envVariable}`}
                  />
                  {v.userEditable && (
                    <button
                      onClick={() => handleSave(v.envVariable)}
                      disabled={updateVar.isPending}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      data-testid={`button-save-var-${v.envVariable}`}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                  )}
                </div>
                {!v.userEditable && (
                  <p className="text-xs text-muted-foreground mt-1">This variable cannot be modified by clients.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
