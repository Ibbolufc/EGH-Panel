import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useListNodes, useCreateNode, useDeleteNode } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Plus, Cpu, HardDrive, MemoryStick, Server as ServerIcon, Trash2, Globe,
  Terminal, ArrowRight, CheckCircle2, Loader2, Copy, Check,
  AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Download,
  MapPin, FileText, Wifi, WifiOff, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-border/60 bg-input/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

// ── Install script generator ─────────────────────────────────────────────────
function generateInstallScript(opts: {
  panelUrl: string;
  nodeId: number;
  nodeName: string;
  nodeFqdn: string;
  daemonPort: number;
  scheme: string;
  registrationToken: string;
}): string {
  const { panelUrl, nodeId, nodeName, nodeFqdn, daemonPort, registrationToken } = opts;

  return `#!/usr/bin/env bash
# ============================================================
#  EGH Panel — EGH Node auto-install
#  Node: ${nodeName} (ID: ${nodeId})
#  Run as root on the target machine. Do NOT run on your panel.
# ============================================================
set -euo pipefail

EGH_PANEL_URL="${panelUrl}"
EGH_NODE_TOKEN="${registrationToken}"
EGH_NODE_FQDN="${nodeFqdn}"
EGH_NODE_PORT="${daemonPort}"
EGH_CONFIG_DIR="/etc/egh-node"
EGH_DATA_DIR="/var/lib/egh-node/volumes"
EGH_AGENT_URL="${panelUrl}/api/download/egh-node"

# ── 1. Root check ──────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this script must be run as root (sudo -i)." >&2
  exit 1
fi

echo "[1/5] Checking system..."
apt-get update -q

# ── 2. Install Docker if missing ───────────────────────────
echo "[2/5] Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker Engine..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
  echo "  Docker installed."
else
  echo "  Docker already present."
fi

# ── 3. Download EGH Node agent ─────────────────────────────
echo "[3/5] Downloading EGH Node agent..."
mkdir -p "\${EGH_CONFIG_DIR}" /var/log/egh-node
curl -fsSL "\${EGH_AGENT_URL}" -o /usr/local/bin/egh-node
chmod +x /usr/local/bin/egh-node

# ── 4. Write EGH Node config ───────────────────────────────
echo "[4/5] Writing EGH Node configuration..."
mkdir -p "\${EGH_DATA_DIR}"
cat > "\${EGH_CONFIG_DIR}/config.yml" << NODECONF
debug: false
api:
  host: "0.0.0.0"
  port: \${EGH_NODE_PORT}
  ssl:
    enabled: false
  upload_limit: 100
system:
  data: "\${EGH_DATA_DIR}"
  sftp:
    bind_port: 2022
remote: "\${EGH_PANEL_URL}"
token: "\${EGH_NODE_TOKEN}"
allowed_origins:
  - "\${EGH_PANEL_URL}"
NODECONF

# ── 5. Install & start EGH Node service ───────────────────
echo "[5/5] Installing EGH Node service..."
cat > /etc/systemd/system/egh-node.service << SVCEOF
[Unit]
Description=EGH Node Agent
After=docker.service
Requires=docker.service

[Service]
User=root
WorkingDirectory=\${EGH_CONFIG_DIR}
LimitNOFILE=4096
PIDFile=/var/run/egh-node/daemon.pid
ExecStart=/usr/local/bin/egh-node --config \${EGH_CONFIG_DIR}/config.yml
Restart=on-failure
StartLimitInterval=600
StandardOutput=journal
StandardError=journal
SyslogIdentifier=egh-node

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now egh-node

echo ""
echo "============================================================"
echo " EGH Node installed and started."
echo " Node ${nodeName} will appear Online in EGH Panel once it"
echo " connects to: \${EGH_PANEL_URL}"
echo "============================================================"
`;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "xs" | "sm" }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/60 font-medium transition-colors",
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
        size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Install command modal ─────────────────────────────────────────────────────
function InstallCommandModal({
  node,
  onClose,
  onRegenToken,
}: {
  node: any;
  onClose: () => void;
  onRegenToken: (nodeId: number) => Promise<void>;
}) {
  const [showManual, setShowManual] = useState(false);
  const [showTrouble, setShowTrouble] = useState(false);
  const [regenPending, setRegenPending] = useState(false);
  const { toast } = useToast();

  const panelUrl = window.location.origin;
  const script = generateInstallScript({
    panelUrl,
    nodeId: node.id,
    nodeName: node.name,
    nodeFqdn: node.fqdn,
    daemonPort: node.daemonPort,
    scheme: node.scheme,
    registrationToken: node.registrationToken ?? "",
  });

  // One-liner that downloads and runs the full script (post-deploy ready)
  const oneLiner = `curl -fsSL "${panelUrl}/api/nodes/${node.id}/install.sh?token=${node.registrationToken}" | sudo bash`;

  async function handleRegen() {
    setRegenPending(true);
    try {
      await onRegenToken(node.id);
      toast({ title: "Token regenerated", description: "The previous install command is now invalid." });
    } catch {
      toast({ title: "Failed to regenerate token", variant: "destructive" });
    } finally {
      setRegenPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-border/60 bg-card shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/40 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">EGH Node Install</h3>
              <p className="text-xs text-muted-foreground">{node.name} · {node.fqdn}</p>
            </div>
          </div>
          <StatusBadge status={node.status} />
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/80">
              <span className="font-semibold text-amber-300">Run this on your node machine — not on the panel server.</span>
              {" "}SSH into the target machine first, then execute the script as root.
            </div>
          </div>

          {/* Quick Install section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Quick Install Script</p>
              <CopyButton text={script} label="Copy full script" />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste and run this complete script as root on your node. It installs Docker (if missing), downloads EGH Node, writes the configuration, and starts the agent service.
            </p>
            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-[hsl(225,20%,4%)]">
              <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">install-egh-node.sh</span>
                </div>
                <CopyButton text={script} size="xs" />
              </div>
              <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed font-mono text-emerald-300/90 max-h-56">
                <code>{script}</code>
              </pre>
            </div>
          </div>

          {/* Manual Setup toggle */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setShowManual(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-white/3 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground/60" />
                Manual Setup Steps
              </span>
              {showManual ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showManual && (
              <div className="border-t border-border/40 px-4 py-4 space-y-4 bg-white/2">
                {[
                  {
                    n: "1", title: "Install Docker",
                    code: "curl -fsSL https://get.docker.com | bash && systemctl enable --now docker",
                  },
                  {
                    n: "2", title: "Download EGH Node agent",
                    code: `mkdir -p "$EGH_CONFIG_DIR"\ncurl -fsSL "$EGH_AGENT_URL" -o /usr/local/bin/egh-node\nchmod +x /usr/local/bin/egh-node`,
                    note: "Set EGH_CONFIG_DIR and EGH_AGENT_URL from the auto-install script variables above.",
                  },
                  {
                    n: "3", title: "Write EGH Node config",
                    note: `Create the EGH Node configuration file at $EGH_CONFIG_DIR/config.yml with remote: "${panelUrl}" and token: "${node.registrationToken}".`,
                  },
                  {
                    n: "4", title: "Start EGH Node",
                    code: "systemctl enable --now egh-node",
                  },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">
                      {step.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      {step.note && <p className="mt-1 text-xs text-muted-foreground">{step.note}</p>}
                      {step.code && (
                        <div className="mt-1.5 flex items-start justify-between gap-2 rounded-md border border-border/40 bg-black/30 px-3 py-2">
                          <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap flex-1">{step.code}</pre>
                          <CopyButton text={step.code} size="xs" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Node connection details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-white/2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Panel URL</p>
              <code className="text-xs text-foreground break-all">{panelUrl}</code>
            </div>
            <div className="rounded-lg border border-border/50 bg-white/2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Registration Token</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-foreground truncate flex-1">{node.registrationToken ?? "—"}</code>
                {node.registrationToken && <CopyButton text={node.registrationToken} size="xs" />}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-white/2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Node FQDN</p>
              <code className="text-xs text-foreground">{node.fqdn}</code>
            </div>
            <div className="rounded-lg border border-border/50 bg-white/2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Daemon Port</p>
              <code className="text-xs text-foreground">{node.daemonPort}</code>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setShowTrouble(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-white/3 transition-colors"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400/60" />
                Troubleshooting
              </span>
              {showTrouble ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showTrouble && (
              <div className="border-t border-border/40 px-4 py-4 space-y-3 bg-white/2">
                {[
                  { q: "EGH Node is running but the node stays Offline", a: "Ensure port " + node.daemonPort + " is open in your firewall (ufw allow " + node.daemonPort + "/tcp). Check agent logs: journalctl -u egh-node -f" },
                  { q: "Certificate errors with HTTPS", a: "Your FQDN must have a valid SSL certificate. Use Let's Encrypt: certbot certonly --standalone -d " + node.fqdn },
                  { q: "EGH Node crashes on start", a: "Check logs with: journalctl -u egh-node --no-pager -n 50. Common cause is Docker not running (systemctl start docker)." },
                  { q: "Need to change the token", a: "Click 'Regenerate Token' below and re-run the install script on the node. The old token will no longer work." },
                ].map(item => (
                  <div key={item.q}>
                    <p className="text-xs font-semibold text-foreground">{item.q}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3.5 gap-3">
          <button
            onClick={handleRegen}
            disabled={regenPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-50"
          >
            {regenPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate Token
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Two-step Add Node modal ───────────────────────────────────────────────────
function AddNodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"form" | "install">(  "form");
  const [createdNode, setCreatedNode] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", location: "", fqdn: "", scheme: "https", daemonPort: 8080,
    isPublic: true, memoryTotal: 4096, diskTotal: 50000, notes: "",
  });
  const createNode = useCreateNode();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const node = await createNode.mutateAsync({ data: form as any });
      setCreatedNode(node);
      setStep("install");
      onSuccess();
    } catch {
      toast({ title: "Failed to add node", variant: "destructive" });
    }
  }

  if (step === "install" && createdNode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="w-full max-w-2xl rounded-xl border border-border/60 bg-card shadow-2xl my-6">
          {/* Success header */}
          <div className="flex items-center gap-3 border-b border-border/40 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Node registered — install EGH Node to connect it</h3>
              <p className="text-xs text-muted-foreground">{createdNode.name} · Status: <span className="text-amber-400">Pending</span></p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              {[
                { label: "Node registered",      done: true },
                { label: "Install EGH Node",   done: false, active: true },
                { label: "Node online",          done: false },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    s.done ? "bg-emerald-500/20 text-emerald-400" : s.active ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-white/5 text-muted-foreground/50"
                  )}>
                    {s.done ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-xs font-medium truncate",
                    s.done ? "text-emerald-400" : s.active ? "text-foreground" : "text-muted-foreground/50"
                  )}>
                    {s.label}
                  </span>
                  {i < 2 && <div className="h-px flex-1 bg-border/40" />}
                </div>
              ))}
            </div>

            <InstallCommandContent node={createdNode} />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3.5">
            <button onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-2xl my-6">
        <div className="border-b border-border/40 p-5">
          <h3 className="text-base font-semibold text-foreground">Add Node</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Register a new node. After saving, you'll receive an EGH Node install command.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Node Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="US-East-1" required autoFocus />
            </div>
            <div>
              <label className={labelClass}>Location <span className="text-muted-foreground/40 font-normal">(optional)</span></label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="New York, USA" />
            </div>
          </div>
          <div>
            <label className={labelClass}>FQDN / IP Address</label>
            <input value={form.fqdn} onChange={(e) => setForm({ ...form, fqdn: e.target.value })} className={inputClass} placeholder="node1.yourdomain.com or 192.168.1.10" required />
            <p className="mt-1 text-[11px] text-muted-foreground/60">Must be reachable from clients. Use a domain with SSL for HTTPS.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Scheme</label>
              <select value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value })} className={inputClass}>
                <option value="https">https</option>
                <option value="http">http</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Daemon Port</label>
              <input type="number" value={form.daemonPort} onChange={(e) => setForm({ ...form, daemonPort: Number(e.target.value) })} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Visibility</label>
              <select value={form.isPublic ? "public" : "private"} onChange={(e) => setForm({ ...form, isPublic: e.target.value === "public" })} className={inputClass}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Total Memory (MB)</label>
              <input type="number" value={form.memoryTotal} onChange={(e) => setForm({ ...form, memoryTotal: Number(e.target.value) })} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Total Disk (MB)</label>
              <input type="number" value={form.diskTotal} onChange={(e) => setForm({ ...form, diskTotal: Number(e.target.value) })} className={inputClass} required />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes <span className="text-muted-foreground/40 font-normal">(optional)</span></label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={cn(inputClass, "resize-none")} placeholder="e.g. Hetzner CX42, 4 vCPUs, maintenance window Sundays" />
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
            <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createNode.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createNode.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
                : <><Plus className="h-4 w-4" /> Add Node &amp; Get Install Command</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shared install command content (used in both modal and post-create) ────────
function InstallCommandContent({ node }: { node: any }) {
  const [copied, setCopied] = useState(false);

  const panelUrl = window.location.origin;
  const script = generateInstallScript({
    panelUrl,
    nodeId: node.id,
    nodeName: node.name,
    nodeFqdn: node.fqdn,
    daemonPort: node.daemonPort,
    scheme: node.scheme,
    registrationToken: node.registrationToken ?? "",
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const el = document.createElement("textarea");
      el.value = script;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80">
          <span className="font-semibold text-amber-300">SSH into your node machine and run this as root.</span>{" "}
          Do not run this on the EGH Panel server.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border/40 bg-[hsl(225,20%,4%)]">
        <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500/50" />
              <span className="h-2 w-2 rounded-full bg-amber-500/50" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
            </div>
            <Terminal className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/50 font-mono">install-egh-node.sh — {node.name}</span>
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
              copied
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border/50 bg-white/5 text-muted-foreground hover:text-foreground"
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed font-mono text-emerald-300/90 max-h-52">
          <code>{script}</code>
        </pre>
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        This node will show as <span className="text-emerald-400 font-medium">Online</span> in the panel once EGH Node connects successfully.
      </p>
    </div>
  );
}

// ── Node status icon ──────────────────────────────────────────────────────────
function NodeStatusIcon({ status }: { status: string }) {
  if (status === "online")      return <Wifi className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "pending")     return <Clock className="h-3.5 w-3.5 text-amber-400" />;
  if (status === "maintenance") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
  return <WifiOff className="h-3.5 w-3.5 text-slate-400" />;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminNodes() {
  const [showCreate, setShowCreate] = useState(false);
  const [installNode, setInstallNode] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data, isLoading, refetch } = useListNodes({ query: { refetchInterval: 30_000 } });
  const deleteNode = useDeleteNode();
  const { toast } = useToast();

  const nodes = Array.isArray(data) ? data : [];
  const pendingCount = nodes.filter((n: any) => n.status === "pending").length;

  async function handleDelete(id: number) {
    if (!confirm("Delete this node? All servers and allocations on it will be removed.")) return;
    setDeletingId(id);
    try {
      await deleteNode.mutateAsync({ id });
      toast({ title: "Node deleted" });
      refetch();
    } catch {
      toast({ title: "Failed to delete node", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRegenToken(nodeId: number) {
    const res = await fetch(`/api/nodes/${nodeId}/regen-token`, { method: "POST" });
    if (!res.ok) throw new Error("Failed");
    refetch();
  }

  return (
    <AdminLayout title="Nodes">
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Nodes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? "Loading…" : (
                <>
                  {nodes.length} node{nodes.length !== 1 ? "s" : ""} registered
                  {pendingCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-400 font-medium">
                      <Clock className="h-3 w-3" /> {pendingCount} pending EGH Node install
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            data-testid="button-create-node"
          >
            <Plus className="h-4 w-4" />
            Add Node
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(j => <Skeleton key={j} className="h-14 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          /* Empty state — setup guide */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/40">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No nodes configured</p>
                  <p className="text-xs text-muted-foreground">Follow these steps to connect your first node</p>
                </div>
              </div>
              <ol className="space-y-4">
                {[
                  { n: "1", title: "Provision a Linux server", desc: "Any VPS or dedicated machine. Ubuntu 22.04+ with 2+ vCPUs and 2+ GB RAM recommended." },
                  { n: "2", title: "Click \"Add Node\" above", desc: "Enter the name, FQDN or IP, and resource limits. EGH Panel will generate an EGH Node install command for you." },
                  { n: "3", title: "Run the install command on your node", desc: "SSH into the machine and paste the generated script as root. It installs Docker, EGH Node, and links the node to this panel." },
                  { n: "4", title: "Node goes Online automatically", desc: "Once EGH Node connects back to the panel, the node status will change from Pending to Online." },
                ].map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white/5 text-xs font-bold text-muted-foreground mt-0.5">
                      {step.n}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 pt-4 border-t border-border/40">
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add First Node
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">What is a node?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A node is a physical or virtual server running the EGH Node agent. EGH Panel connects to EGH Node to deploy and manage game server containers on that machine.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Requirements</p>
                <ul className="space-y-2">
                  {["Linux (Ubuntu 22.04+ recommended)", "2 GB RAM minimum", "Docker Engine", "Ports 443 & 8080 open", "Root or sudo access"].map((req) => (
                    <li key={req} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Node cards */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {nodes.map((node: any) => {
              const isPending = node.status === "pending";
              return (
                <Link
                  key={node.id}
                  href={`/admin/nodes/${node.id}`}
                  className={cn(
                    "block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card/80 cursor-pointer",
                    isPending ? "border-amber-500/25 bg-amber-500/3" : "border-border/60"
                  )}
                  data-testid={`card-node-${node.id}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          isPending ? "bg-amber-500/10" : "bg-primary/10"
                        )}>
                          <NodeStatusIcon status={node.status} />
                        </div>
                        <span
                          className="font-semibold text-foreground text-sm truncate"
                          data-testid={`link-node-${node.id}`}
                        >
                          {node.name}
                        </span>
                        {node.location && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 shrink-0">
                            <MapPin className="h-3 w-3" />{node.location}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate ml-9">
                        {node.scheme}://{node.fqdn}:{node.daemonPort}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={node.status} />
                      <button
                        onClick={(e) => { e.preventDefault(); handleDelete(node.id); }}
                        disabled={deletingId === node.id}
                        className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        data-testid={`button-delete-node-${node.id}`}
                        title="Delete node"
                      >
                        {deletingId === node.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Pending install prompt */}
                  {isPending && node.registrationToken && (
                    <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 flex items-center gap-3">
                      <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-300">Awaiting EGH Node installation</p>
                        <p className="text-[11px] text-amber-400/60">Run the EGH Node install command on this machine to bring it online.</p>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); setInstallNode(node); }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/25 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
                      >
                        <Terminal className="h-3.5 w-3.5" />
                        View Command
                      </button>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: MemoryStick, label: "Memory",  value: formatMB(node.memoryTotal),  color: "text-sky-400",     bg: "bg-sky-500/10" },
                      { icon: HardDrive,   label: "Disk",    value: formatMB(node.diskTotal),    color: "text-emerald-400", bg: "bg-emerald-500/10" },
                      { icon: ServerIcon,  label: "Servers", value: node.serverCount ?? 0,       color: "text-violet-400",  bg: "bg-violet-500/10" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-border/40 bg-white/3 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={cn("flex h-5 w-5 items-center justify-center rounded", stat.bg)}>
                            <stat.icon className={cn("h-3 w-3", stat.color)} />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">{stat.label}</span>
                        </div>
                        <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  {node.notes && (
                    <p className="mt-2.5 text-[11px] text-muted-foreground/60 flex items-start gap-1.5">
                      <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                      {node.notes}
                    </p>
                  )}

                  {/* Footer actions */}
                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-primary/70">
                      <ArrowRight className="h-3.5 w-3.5" />
                      View Details
                    </div>
                    {node.registrationToken && (
                      <button
                        onClick={(e) => { e.preventDefault(); setInstallNode(node); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-white/3 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/8 hover:text-foreground transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Install Command
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <AddNodeModal
          onClose={() => { setShowCreate(false); refetch(); }}
          onSuccess={() => { refetch(); }}
        />
      )}

      {installNode && (
        <InstallCommandModal
          node={installNode}
          onClose={() => { setInstallNode(null); refetch(); }}
          onRegenToken={handleRegenToken}
        />
      )}
    </AdminLayout>
  );
}
