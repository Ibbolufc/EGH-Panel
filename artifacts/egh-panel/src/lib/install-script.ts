export interface InstallScriptOpts {
  panelUrl: string;
  nodeId: number;
  nodeName: string;
  nodeFqdn: string;
  daemonPort: number;
  scheme: string;
  registrationToken: string;
}

export function generateInstallScript(opts: InstallScriptOpts): string {
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
