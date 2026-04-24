import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetEgg, useUpdateEgg, useCreateEggVariable, useDeleteEggVariable } from "@workspace/api-client-react";
import type { EggDetail, EggVariable } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronRight, Egg, Settings, List,
  Terminal, FileCode, Tag, Eye, EyeOff, Pencil,
  Save, Loader2, X, Check, Plus, Trash2,
} from "lucide-react";

const inputClass = "w-full rounded-lg border border-border/60 bg-white/5 px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5";

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <dt className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground min-w-0 flex-1">{value ?? "—"}</dd>
    </div>
  );
}

type TabId = "details" | "variables";
const VALID_TABS: TabId[] = ["details", "variables"];

function getTabFromSearch(): TabId {
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return VALID_TABS.includes(t as TabId) ? (t as TabId) : "details";
}

const emptyAddForm = {
  name: "", envVariable: "", description: "", defaultValue: "",
  userViewable: true, userEditable: false, rules: "",
};

export default function AdminEggDetail() {
  const { id } = useParams<{ id: string }>();
  const eggId = Number(id);
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabId>(getTabFromSearch);
  const { toast } = useToast();

  const { data: egg, isLoading, refetch } = useGetEgg(eggId) as {
    data: EggDetail | undefined; isLoading: boolean; refetch: () => void;
  };
  const updateEgg = useUpdateEgg();
  const createEggVariable = useCreateEggVariable();
  const deleteEggVariable = useDeleteEggVariable();

  useEffect(() => {
    function onPop() { setTab(getTabFromSearch()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function handleTabChange(newTab: TabId) {
    setTab(newTab);
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", newTab);
    navigate(`${window.location.pathname}?${sp.toString()}`);
  }

  // ── Details edit state ────────────────────────────────────────────────────
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    name: "", description: "", dockerImage: "", startup: "", installScript: "",
  });

  function openDetailsEdit() {
    if (!egg) return;
    setDetailsForm({
      name: egg.name ?? "",
      description: egg.description ?? "",
      dockerImage: egg.dockerImage ?? "",
      startup: egg.startup ?? "",
      installScript: egg.installScript ?? "",
    });
    setDetailsEditing(true);
  }

  async function handleDetailsSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateEgg.mutateAsync({
        id: eggId,
        data: {
          name: detailsForm.name || undefined,
          description: detailsForm.description,
          dockerImage: detailsForm.dockerImage || undefined,
          startup: detailsForm.startup || undefined,
          installScript: detailsForm.installScript,
        },
      });
      refetch();
      setDetailsEditing(false);
      toast({ title: "Egg settings saved" });
    } catch {
      toast({ title: "Failed to save egg settings", variant: "destructive" });
    }
  }

  // ── Variable edit state ───────────────────────────────────────────────────
  const [editingVarId, setEditingVarId] = useState<number | null>(null);
  const [varForm, setVarForm] = useState({
    name: "", defaultValue: "", userViewable: true, userEditable: false, rules: "",
  });

  function openVarEdit(v: EggVariable) {
    setEditingVarId(v.id);
    setAddingVar(false);
    setVarForm({
      name: v.name ?? "",
      defaultValue: v.defaultValue ?? "",
      userViewable: Boolean(v.userViewable),
      userEditable: Boolean(v.userEditable),
      rules: v.rules ?? "",
    });
  }

  async function handleVarSave(varId: number) {
    try {
      await updateEgg.mutateAsync({
        id: eggId,
        data: {
          variables: [{
            id: varId,
            name: varForm.name || undefined,
            defaultValue: varForm.defaultValue,
            userViewable: varForm.userViewable,
            userEditable: varForm.userEditable,
            rules: varForm.rules,
          }],
        },
      });
      refetch();
      setEditingVarId(null);
      toast({ title: "Variable saved" });
    } catch {
      toast({ title: "Failed to save variable", variant: "destructive" });
    }
  }

  // ── Add variable state ────────────────────────────────────────────────────
  const [addingVar, setAddingVar] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);

  function openAddVar() {
    setAddForm(emptyAddForm);
    setEditingVarId(null);
    setAddingVar(true);
  }

  async function handleAddVarSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createEggVariable.mutateAsync({
        id: eggId,
        data: {
          name: addForm.name,
          envVariable: addForm.envVariable,
          description: addForm.description || undefined,
          defaultValue: addForm.defaultValue,
          userViewable: addForm.userViewable,
          userEditable: addForm.userEditable,
          rules: addForm.rules,
        },
      });
      refetch();
      setAddingVar(false);
      toast({ title: "Variable added" });
    } catch {
      toast({ title: "Failed to add variable", variant: "destructive" });
    }
  }

  // ── Delete variable ───────────────────────────────────────────────────────
  const [deletingVarId, setDeletingVarId] = useState<number | null>(null);

  async function handleVarDelete(varId: number) {
    if (!window.confirm("Delete this variable? This cannot be undone.")) return;
    setDeletingVarId(varId);
    try {
      await deleteEggVariable.mutateAsync({ id: eggId, varId });
      refetch();
      toast({ title: "Variable deleted" });
    } catch {
      toast({ title: "Failed to delete variable", variant: "destructive" });
    } finally {
      setDeletingVarId(null);
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="Egg">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/eggs" className="hover:text-foreground transition-colors">Eggs &amp; Nests</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!egg) {
    return (
      <AdminLayout title="Egg">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Egg className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Egg not found</p>
          <Link href="/admin/eggs" className="mt-3 text-xs text-primary hover:underline">Back to eggs &amp; nests</Link>
        </div>
      </AdminLayout>
    );
  }

  const variables: EggVariable[] = egg.variables ?? [];

  return (
    <AdminLayout title={egg.name}>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/eggs" className="hover:text-foreground transition-colors">Eggs &amp; Nests</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{egg.nestName}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{egg.name}</span>
        </nav>

        {/* Header card */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              <Egg className="h-6 w-6 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{egg.name}</h1>
              <p className="text-sm text-muted-foreground">{egg.description || "No description"}</p>
            </div>
            <div className="shrink-0 rounded-md bg-white/5 border border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
              {egg.nestName}
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-t border-border/40 px-4 py-2 flex items-center gap-1">
            <TabBtn active={tab === "details"} onClick={() => handleTabChange("details")} icon={Settings} label="Details" />
            <TabBtn
              active={tab === "variables"}
              onClick={() => handleTabChange("variables")}
              icon={List}
              label={`Variables${variables.length > 0 ? ` (${variables.length})` : ""}`}
            />
          </div>
        </div>

        {/* ── DETAILS TAB ──────────────────────────────────────────────────── */}
        {tab === "details" && (
          <div className="space-y-5">
            {/* Docker & Runtime — editable */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={Settings} title="Docker &amp; Runtime" subtitle="Image and startup configuration" />
                {!detailsEditing && (
                  <button
                    type="button"
                    onClick={openDetailsEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    data-testid="button-edit-egg-details"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {detailsEditing ? (
                <form onSubmit={handleDetailsSave} className="space-y-4">
                  <div>
                    <label className={labelClass}>Egg Name</label>
                    <input
                      className={inputClass}
                      value={detailsForm.name}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Minecraft Java"
                      required
                      data-testid="input-egg-name"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      className={cn(inputClass, "resize-none min-h-[64px]")}
                      value={detailsForm.description}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Optional description"
                      data-testid="input-egg-description"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Docker Image</label>
                    <input
                      className={inputClass}
                      value={detailsForm.dockerImage}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, dockerImage: e.target.value }))}
                      placeholder="e.g. ghcr.io/pterodactyl/yolks:java_21"
                      required
                      data-testid="input-egg-docker-image"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Startup Command</label>
                    <input
                      className={inputClass}
                      value={detailsForm.startup}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, startup: e.target.value }))}
                      placeholder="e.g. java -jar server.jar"
                      required
                      data-testid="input-egg-startup"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Install Script <span className="font-normal text-muted-foreground/50 normal-case">(bash, optional)</span></label>
                    <textarea
                      className={cn(inputClass, "font-mono text-xs min-h-[120px] resize-y")}
                      value={detailsForm.installScript}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, installScript: e.target.value }))}
                      placeholder="#!/bin/bash&#10;# install script…"
                      data-testid="input-egg-install-script"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={updateEgg.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                      data-testid="button-save-egg-details"
                    >
                      {updateEgg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {updateEgg.isPending ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsEditing(false)}
                      disabled={updateEgg.isPending}
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-0">
                  <InfoRow label="Docker Image" value={
                    <code className="text-xs font-mono break-all text-foreground">{egg.dockerImage}</code>
                  } />
                  <InfoRow label="Startup Command" value={
                    <code className="text-xs font-mono break-all text-emerald-400">{egg.startup}</code>
                  } />
                  {egg.dockerImages && egg.dockerImages.length > 1 && (
                    <InfoRow label="Alt. Images" value={
                      <div className="space-y-1">
                        {egg.dockerImages.map((img, i) => (
                          <code key={i} className="block text-xs font-mono break-all text-muted-foreground">{img}</code>
                        ))}
                      </div>
                    } />
                  )}
                </dl>
              )}
            </div>

            {/* Metadata (read-only) */}
            {!detailsEditing && (
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <SectionHeader icon={Tag} title="Metadata" />
                <dl className="space-y-0">
                  <InfoRow label="Egg ID" value={<code className="text-xs font-mono">{egg.id}</code>} />
                  <InfoRow label="Nest" value={egg.nestName} />
                  <InfoRow label="Variables" value={`${variables.length} variable${variables.length !== 1 ? "s" : ""}`} />
                  <InfoRow label="Created" value={new Date(egg.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
                </dl>
              </div>
            )}

            {/* Install Script (read-only display) */}
            {!detailsEditing && egg.installScript && (
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <SectionHeader icon={FileCode} title="Install Script" subtitle="Runs during server installation" />
                <div className="overflow-hidden rounded-lg border border-border/40 bg-black/40">
                  <div className="px-3 py-1.5 border-b border-border/40 flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">bash</span>
                  </div>
                  <pre className="p-4 text-[11px] text-emerald-400 font-mono overflow-auto leading-relaxed max-h-64">
                    {egg.installScript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VARIABLES TAB ────────────────────────────────────────────────── */}
        {tab === "variables" && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <SectionHeader
                icon={List}
                title="Variables"
                subtitle={`${variables.length} environment variable${variables.length !== 1 ? "s" : ""} for this egg`}
              />
              {!addingVar && (
                <button
                  type="button"
                  onClick={openAddVar}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  data-testid="button-add-variable"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Variable
                </button>
              )}
            </div>

            {/* Add variable inline form */}
            {addingVar && (
              <div className="px-5 py-4 border-b border-border/40 bg-primary/5">
                <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wider">New Variable</p>
                <form onSubmit={handleAddVarSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Variable Name</label>
                      <input
                        className={inputClass}
                        value={addForm.name}
                        onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Server Port"
                        required
                        data-testid="input-new-var-name"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Environment Variable</label>
                      <input
                        className={inputClass}
                        value={addForm.envVariable}
                        onChange={(e) => setAddForm((p) => ({ ...p, envVariable: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                        placeholder="e.g. SERVER_PORT"
                        required
                        data-testid="input-new-var-env"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Default Value</label>
                      <input
                        className={inputClass}
                        value={addForm.defaultValue}
                        onChange={(e) => setAddForm((p) => ({ ...p, defaultValue: e.target.value }))}
                        placeholder="Leave blank for none"
                        data-testid="input-new-var-default"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Validation Rules</label>
                      <input
                        className={inputClass}
                        value={addForm.rules}
                        onChange={(e) => setAddForm((p) => ({ ...p, rules: e.target.value }))}
                        placeholder="e.g. required|numeric|min:1"
                        data-testid="input-new-var-rules"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></label>
                    <input
                      className={inputClass}
                      value={addForm.description}
                      onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Brief description of this variable"
                      data-testid="input-new-var-description"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.userViewable}
                        onChange={(e) => setAddForm((p) => ({ ...p, userViewable: e.target.checked }))}
                        className="h-4 w-4 rounded border-border/60 bg-white/5 accent-primary"
                        data-testid="checkbox-new-var-viewable"
                      />
                      <span className="text-xs text-muted-foreground">User viewable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.userEditable}
                        onChange={(e) => setAddForm((p) => ({ ...p, userEditable: e.target.checked }))}
                        className="h-4 w-4 rounded border-border/60 bg-white/5 accent-primary"
                        data-testid="checkbox-new-var-editable"
                      />
                      <span className="text-xs text-muted-foreground">User editable</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={createEggVariable.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                      data-testid="button-save-new-variable"
                    >
                      {createEggVariable.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      {createEggVariable.isPending ? "Adding…" : "Add Variable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingVar(false)}
                      disabled={createEggVariable.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {variables.length === 0 && !addingVar ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <List className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No variables</p>
                <p className="text-xs text-muted-foreground mt-1">This egg has no environment variables defined.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {variables.map((v) => {
                  const isEditing = editingVarId === v.id;
                  const isDeleting = deletingVarId === v.id;
                  return (
                    <div key={v.id} className="px-5 py-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <code className="text-[10px] font-mono bg-black/30 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground">
                              {v.envVariable}
                            </code>
                          </div>
                          <div>
                            <label className={labelClass}>Variable Name</label>
                            <input
                              className={inputClass}
                              value={varForm.name}
                              onChange={(e) => setVarForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Display name"
                              required
                              data-testid={`input-var-name-${v.id}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Default Value</label>
                            <input
                              className={inputClass}
                              value={varForm.defaultValue}
                              onChange={(e) => setVarForm((p) => ({ ...p, defaultValue: e.target.value }))}
                              placeholder="Leave blank for no default"
                              data-testid={`input-var-default-${v.id}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Validation Rules</label>
                            <input
                              className={inputClass}
                              value={varForm.rules}
                              onChange={(e) => setVarForm((p) => ({ ...p, rules: e.target.value }))}
                              placeholder="e.g. required|string|between:1,100"
                              data-testid={`input-var-rules-${v.id}`}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={varForm.userViewable}
                                onChange={(e) => setVarForm((p) => ({ ...p, userViewable: e.target.checked }))}
                                className="h-4 w-4 rounded border-border/60 bg-white/5 accent-primary"
                                data-testid={`checkbox-var-viewable-${v.id}`}
                              />
                              <span className="text-xs text-muted-foreground">User viewable</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={varForm.userEditable}
                                onChange={(e) => setVarForm((p) => ({ ...p, userEditable: e.target.checked }))}
                                className="h-4 w-4 rounded border-border/60 bg-white/5 accent-primary"
                                data-testid={`checkbox-var-editable-${v.id}`}
                              />
                              <span className="text-xs text-muted-foreground">User editable</span>
                            </label>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleVarSave(v.id)}
                              disabled={updateEgg.isPending}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                              data-testid={`button-save-var-${v.id}`}
                            >
                              {updateEgg.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              {updateEgg.isPending ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVarId(null)}
                              disabled={updateEgg.isPending}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{v.name}</span>
                              <code className="text-[10px] font-mono bg-black/30 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground">
                                {v.envVariable}
                              </code>
                            </div>
                            {v.description && (
                              <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                Default: <code className="font-mono text-foreground/70">{v.defaultValue || "none"}</code>
                              </span>
                              {v.rules && (
                                <span className="text-xs text-muted-foreground">
                                  Rules: <code className="font-mono text-foreground/70">{v.rules}</code>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                              v.userViewable ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-muted-foreground"
                            )}>
                              {v.userViewable ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                              {v.userViewable ? "Viewable" : "Hidden"}
                            </span>
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                              v.userEditable ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted-foreground"
                            )}>
                              <Pencil className="h-3 w-3" />
                              {v.userEditable ? "Editable" : "Locked"}
                            </span>
                            <button
                              type="button"
                              onClick={() => openVarEdit(v)}
                              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-white/3 px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/8 hover:text-foreground transition-colors"
                              data-testid={`button-edit-var-${v.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVarDelete(v.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors disabled:opacity-50"
                              data-testid={`button-delete-var-${v.id}`}
                            >
                              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
