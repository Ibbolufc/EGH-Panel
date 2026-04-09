import { useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNests, useCreateNest, useListEggs, useImportEgg } from "@workspace/api-client-react";
import { Plus, Egg, FolderOpen, Upload, ChevronDown, ChevronRight, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminEggs() {
  const [showImport, setShowImport] = useState(false);
  const [showCreateNest, setShowCreateNest] = useState(false);
  const [expandedNest, setExpandedNest] = useState<number | null>(null);
  const { data: nestsData, isLoading: nestsLoading, refetch: refetchNests } = useListNests({ page: 1, limit: 100 });
  const { data: eggsData, isLoading: eggsLoading, refetch: refetchEggs } = useListEggs({ page: 1, limit: 100 });

  const nests = nestsData?.data ?? [];
  const eggs = eggsData?.data ?? [];

  function eggsForNest(nestId: number) {
    return eggs.filter((e: any) => e.nestId === nestId);
  }

  return (
    <AdminLayout title="Eggs & Nests">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Eggs & Nests</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage game templates and Pterodactyl egg configurations</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateNest(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              New Nest
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              data-testid="button-import-egg"
            >
              <Upload className="h-4 w-4" />
              Import Egg
            </button>
          </div>
        </div>

        {/* Nests & Eggs accordion */}
        <div className="space-y-2">
          {nestsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : nests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No nests found. Create one to get started.</div>
          ) : (
            nests.map((nest: any) => {
              const nestEggs = eggsForNest(nest.id);
              const isExpanded = expandedNest === nest.id;
              return (
                <div key={nest.id} className="rounded-lg border border-border bg-card overflow-hidden" data-testid={`card-nest-${nest.id}`}>
                  <button
                    onClick={() => setExpandedNest(isExpanded ? null : nest.id)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{nest.name}</div>
                      <div className="text-xs text-muted-foreground">{nest.description || "No description"}</div>
                    </div>
                    <span className="text-xs text-muted-foreground bg-white/10 rounded px-2 py-0.5">
                      {nestEggs.length} egg{nestEggs.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border">
                      {nestEggs.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No eggs in this nest. Import a Pterodactyl egg to get started.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {nestEggs.map((egg: any) => (
                            <div key={egg.id} className="flex items-center gap-3 px-6 py-3 hover:bg-white/5 transition-colors" data-testid={`row-egg-${egg.id}`}>
                              <Egg className="h-4 w-4 text-orange-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground">{egg.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{egg.description || "No description"}</div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <code className="text-xs bg-white/5 border border-border rounded px-2 py-0.5 text-muted-foreground truncate max-w-40">
                                  {egg.dockerImage}
                                </code>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {showImport && (
          <ImportEggModal
            nests={nests}
            onClose={() => setShowImport(false)}
            onSuccess={() => { setShowImport(false); refetchEggs(); }}
          />
        )}

        {showCreateNest && (
          <CreateNestModal
            onClose={() => setShowCreateNest(false)}
            onSuccess={() => { setShowCreateNest(false); refetchNests(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function ImportEggModal({ nests, onClose, onSuccess }: { nests: any[]; onClose: () => void; onSuccess: () => void }) {
  const [nestId, setNestId] = useState(nests[0]?.id ?? 1);
  const [jsonContent, setJsonContent] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importEgg = useImportEgg();
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setJsonContent(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!jsonContent) { toast({ title: "Please select a JSON egg file", variant: "destructive" }); return; }
    try {
      const parsed = JSON.parse(jsonContent);
      await importEgg.mutateAsync({ data: { nestId, eggJson: parsed } });
      toast({ title: "Egg imported successfully!" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message ?? "Invalid egg file", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-1">Import Pterodactyl Egg</h3>
        <p className="text-sm text-muted-foreground mb-4">Upload a Pterodactyl-compatible egg.json file to import a game template.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Target Nest</label>
            <select value={nestId} onChange={(e) => setNestId(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {nests.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-white/5 p-8 cursor-pointer hover:bg-white/10 transition-colors",
              jsonContent && "border-primary/50 bg-primary/5"
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            {fileName ? (
              <div className="text-sm text-foreground font-medium">{fileName}</div>
            ) : (
              <>
                <div className="text-sm text-foreground font-medium">Click to upload egg.json</div>
                <div className="text-xs text-muted-foreground mt-1">Pterodactyl-compatible JSON format</div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </div>
          {jsonContent && (
            <div className="rounded-md bg-black/40 p-3 max-h-32 overflow-y-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{jsonContent.slice(0, 500)}{jsonContent.length > 500 ? "\n..." : ""}</pre>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button onClick={handleImport} disabled={importEgg.isPending || !jsonContent}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-confirm-import">
              {importEgg.isPending ? "Importing..." : "Import Egg"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateNestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const createNest = useCreateNest();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createNest.mutateAsync({ data: form });
      toast({ title: "Nest created" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create nest", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">Create Nest</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Nest Name (e.g. Minecraft)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNest.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNest.isPending ? "Creating..." : "Create Nest"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
