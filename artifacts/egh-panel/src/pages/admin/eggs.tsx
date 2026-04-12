import { useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNests, useCreateNest, useListEggs, useImportEgg } from "@workspace/api-client-react";
import {
  Plus, Egg, FolderOpen, Upload, ChevronDown, ChevronRight,
  PackageOpen, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";

export default function AdminEggs() {
  const [showImport, setShowImport] = useState(false);
  const [showCreateNest, setShowCreateNest] = useState(false);
  const [expandedNests, setExpandedNests] = useState<Set<number>>(new Set());
  const { data: nestsData, isLoading: nestsLoading, refetch: refetchNests } = useListNests({ page: 1, limit: 100 });
  const { data: eggsData, isLoading: eggsLoading, refetch: refetchEggs } = useListEggs({ page: 1, limit: 100 });

  const nests = nestsData?.data ?? [];
  const eggs = eggsData?.data ?? [];
  const totalEggs = eggs.length;

  function eggsForNest(nestId: number) {
    return eggs.filter((e: any) => e.nestId === nestId);
  }

  function toggleNest(id: number) {
    setExpandedNests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedNests(new Set(nests.map((n: any) => n.id)));
  }

  const allExpanded = nests.length > 0 && nests.every((n: any) => expandedNests.has(n.id));

  return (
    <AdminLayout title="Eggs & Nests">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Eggs &amp; Nests</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {nestsLoading ? "Loading…" : `${nests.length} nest${nests.length !== 1 ? "s" : ""}, ${totalEggs} egg${totalEggs !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!allExpanded && nests.length > 0 && (
              <button
                onClick={expandAll}
                className="rounded-lg border border-border/60 bg-white/3 px-3 py-2 text-xs text-muted-foreground hover:bg-white/8 hover:text-foreground transition-colors"
              >
                Expand All
              </button>
            )}
            <button
              onClick={() => setShowCreateNest(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/3 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/8 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              New Nest
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              data-testid="button-import-egg"
            >
              <Upload className="h-4 w-4" />
              Import Egg
            </button>
          </div>
        </div>

        {/* Nests accordion */}
        <div className="space-y-2">
          {nestsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
              </div>
            ))
          ) : nests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 mb-4">
                <PackageOpen className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-semibold text-foreground">No nests yet</p>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
                Create a nest to organize your game templates, then import Pterodactyl egg JSON files into it.
              </p>
              <button
                onClick={() => setShowCreateNest(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create First Nest
              </button>
            </div>
          ) : (
            nests.map((nest: any) => {
              const nestEggs = eggsForNest(nest.id);
              const isExpanded = expandedNests.has(nest.id);
              return (
                <div
                  key={nest.id}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
                  data-testid={`card-nest-${nest.id}`}
                >
                  <button
                    onClick={() => toggleNest(nest.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/3 transition-colors"
                  >
                    <span className="text-muted-foreground/60">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <FolderOpen className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{nest.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{nest.description || "No description"}</p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                      nestEggs.length > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-white/5 text-muted-foreground"
                    )}>
                      {nestEggs.length} egg{nestEggs.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/40">
                      {eggsLoading ? (
                        <div className="px-4 py-4 space-y-2">
                          {[1, 2].map(i => (
                            <div key={i} className="flex items-center gap-3">
                              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-32 rounded" />
                                <Skeleton className="h-3 w-48 rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : nestEggs.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                          <Egg className="h-6 w-6 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">No eggs in this nest.</p>
                          <button
                            onClick={() => setShowImport(true)}
                            className="mt-1 text-xs text-primary hover:underline"
                          >
                            Import a Pterodactyl egg &rarr;
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {nestEggs.map((egg: any) => (
                            <div
                              key={egg.id}
                              className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors"
                              data-testid={`row-egg-${egg.id}`}
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/10 mt-0.5">
                                <Egg className="h-3.5 w-3.5 text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{egg.name}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {egg.description || "No description"}
                                </p>
                                {egg.dockerImage && (
                                  <code className="mt-1.5 inline-block rounded border border-border/50 bg-black/30 px-2 py-0.5 text-[11px] font-mono text-muted-foreground max-w-full truncate">
                                    {egg.dockerImage}
                                  </code>
                                )}
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
    if (!jsonContent) {
      toast({ title: "Select an egg JSON file first", variant: "destructive" });
      return;
    }
    try {
      const parsed = JSON.parse(jsonContent);
      await importEgg.mutateAsync({ data: { nestId, eggJson: parsed } });
      toast({ title: "Egg imported successfully" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message ?? "Invalid egg JSON file", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-foreground">Import Pterodactyl Egg</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a Pterodactyl-compatible <code className="text-muted-foreground font-mono">egg.json</code> file to add a game template.
          </p>
        </div>
        <div className="space-y-4">
          {nests.length > 0 && (
            <div>
              <label className={labelClass}>Target Nest</label>
              <select value={nestId} onChange={(e) => setNestId(Number(e.target.value))} className={inputClass}>
                {nests.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Egg JSON File</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
                jsonContent
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 bg-white/3 hover:bg-white/5 hover:border-border"
              )}
            >
              <Upload className={cn("h-7 w-7 mb-2", jsonContent ? "text-primary" : "text-muted-foreground/50")} />
              {fileName ? (
                <div className="text-sm font-medium text-foreground">{fileName}</div>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Click to upload egg.json</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pterodactyl-compatible JSON format</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {jsonContent && (
            <div className="overflow-hidden rounded-lg border border-border/40 bg-black/40 max-h-28">
              <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-muted-foreground font-mono">JSON preview</span>
              </div>
              <pre className="p-3 text-[11px] text-emerald-400 font-mono overflow-auto leading-relaxed">
                {jsonContent.slice(0, 400)}{jsonContent.length > 400 ? "\n…" : ""}
              </pre>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importEgg.isPending || !jsonContent}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-confirm-import"
            >
              {importEgg.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : "Import Egg"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground mb-5">Create Nest</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nest Name</label>
            <input
              placeholder="e.g. Minecraft, Source Engine, Voice Servers"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Description <span className="text-muted-foreground/40 font-normal">(optional)</span></label>
            <textarea
              placeholder="What kind of eggs does this nest contain?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={cn(inputClass, "resize-none")}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNest.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNest.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Nest"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
