import { Router } from "express";
import { eq, count, isNull, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, nodesTable, allocationsTable, serversTable } from "@workspace/db";
import { CreateNodeBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { installScriptLimiter, regenTokenLimiter } from "../middleware/rateLimiter";

const router: Router = Router();

function generateRegistrationToken(): string {
  return "reg_" + randomBytes(24).toString("hex");
}

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function tokenExpiresAt(): Date {
  return new Date(Date.now() + TOKEN_TTL_MS);
}

function nodeWithMeta(node: any, serverCount = 0, allocationCount = 0) {
  return {
    ...node,
    locationId: null,
    locationName: null,
    serverCount,
    allocationCount,
  };
}

router.get("/nodes", requireAdmin, async (_req, res): Promise<void> => {
  const nodes = await db
    .select({
      id: nodesTable.id,
      name: nodesTable.name,
      location: nodesTable.location,
      fqdn: nodesTable.fqdn,
      scheme: nodesTable.scheme,
      daemonPort: nodesTable.daemonPort,
      isPublic: nodesTable.isPublic,
      memoryTotal: nodesTable.memoryTotal,
      memoryOverallocate: nodesTable.memoryOverallocate,
      diskTotal: nodesTable.diskTotal,
      diskOverallocate: nodesTable.diskOverallocate,
      status: nodesTable.status,
      registrationToken: nodesTable.registrationToken,
      registrationTokenExpiresAt: nodesTable.registrationTokenExpiresAt,
      notes: nodesTable.notes,
      createdAt: nodesTable.createdAt,
    })
    .from(nodesTable);

  const results = await Promise.all(
    nodes.map(async (node) => {
      const [serverCount] = await db
        .select({ count: count() })
        .from(serversTable)
        .where(eq(serversTable.nodeId, node.id));

      const [allocCount] = await db
        .select({ count: count() })
        .from(allocationsTable)
        .where(eq(allocationsTable.nodeId, node.id));

      return nodeWithMeta(
        node,
        Number(serverCount?.count ?? 0),
        Number(allocCount?.count ?? 0),
      );
    }),
  );

  res.json(results);
});

router.post("/nodes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const extra: Record<string, any> = {};
  if (req.body.location) extra.location = String(req.body.location);
  if (req.body.notes) extra.notes = String(req.body.notes);

  const registrationToken = generateRegistrationToken();

  const [node] = await db
    .insert(nodesTable)
    .values({
      ...parsed.data,
      ...extra,
      status: "pending",
      registrationToken,
      registrationTokenExpiresAt: tokenExpiresAt(),
    })
    .returning();

  res.status(201).json(nodeWithMeta(node));
});

router.get("/nodes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const allocations = await db
    .select({
      id: allocationsTable.id,
      nodeId: allocationsTable.nodeId,
      ip: allocationsTable.ip,
      port: allocationsTable.port,
      alias: allocationsTable.alias,
      serverId: allocationsTable.serverId,
      isAssigned: allocationsTable.serverId,
    })
    .from(allocationsTable)
    .where(eq(allocationsTable.nodeId, id));

  const [serverCount] = await db
    .select({ count: count() })
    .from(serversTable)
    .where(eq(serversTable.nodeId, id));

  res.json({
    ...node,
    locationId: null,
    locationName: null,
    serverCount: Number(serverCount?.count ?? 0),
    allocationCount: allocations.length,
    allocations: allocations.map((a) => ({
      ...a,
      isAssigned: a.serverId != null,
      serverName: null,
    })),
  });
});

router.patch("/nodes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const allowedFields = [
    "name",
    "fqdn",
    "scheme",
    "daemonPort",
    "isPublic",
    "memoryTotal",
    "memoryOverallocate",
    "diskTotal",
    "diskOverallocate",
    "status",
    "location",
    "notes",
  ];

  const patch: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) patch[key] = req.body[key];
  }

  const [node] = await db
    .update(nodesTable)
    .set(patch)
    .where(eq(nodesTable.id, id))
    .returning();

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.json(nodeWithMeta(node));
});

router.get("/nodes/:id/install.sh", installScriptLimiter, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) {
    res
      .status(401)
      .setHeader("Content-Type", "text/x-shellscript")
      .send("#!/usr/bin/env bash\n# Error: missing ?token query parameter\necho 'Error: missing token' >&2\nexit 1\n");
    return;
  }

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));

  if (!node) {
    res
      .status(404)
      .setHeader("Content-Type", "text/x-shellscript")
      .send("#!/usr/bin/env bash\n# Error: node not found\necho 'Error: node not found' >&2\nexit 1\n");
    return;
  }

  if (!node.registrationToken || node.registrationToken !== token) {
    res
      .status(403)
      .setHeader("Content-Type", "text/x-shellscript")
      .send("#!/usr/bin/env bash\n# Error: invalid token\necho 'Error: invalid token — regenerate it from the EGH Panel' >&2\nexit 1\n");
    return;
  }

  if (node.registrationTokenExpiresAt && node.registrationTokenExpiresAt < new Date()) {
    res
      .status(403)
      .setHeader("Content-Type", "text/x-shellscript")
      .send("#!/usr/bin/env bash\n# Error: token expired\necho 'Error: install token has expired — regenerate it from the EGH Panel' >&2\nexit 1\n");
    return;
  }

  const configuredPanelUrl = (
    process.env["FRONTEND_URL"] ||
    process.env["CORS_ORIGIN"] ||
    "https://egh.valyria.win"
  )
    .trim()
    .replace(/\/+$/, "");

  const forwardedProto = (req.get("x-forwarded-proto") || req.protocol || "http")
    .split(",")[0]
    .trim();

  const forwardedHost = (req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim();

  const panelUrl = configuredPanelUrl || `${forwardedProto}://${forwardedHost}`;

  const { name: nodeName, fqdn: nodeFqdn, daemonPort, registrationToken } = node;

  const script = `#!/usr/bin/env bash
# ============================================================
#  EGH Panel — EGH Node auto-install
#  Node: ${nodeName} (ID: ${id})
#  Run as root on the target machine. Do NOT run on your panel.
# ============================================================
set -euo pipefail

EGH_PANEL_URL="${panelUrl}"
EGH_NODE_TOKEN="${registrationToken}"
EGH_NODE_ID="${id}"
EGH_NODE_FQDN="${nodeFqdn}"
EGH_NODE_PORT="${daemonPort}"
EGH_CONFIG_DIR="/etc/egh-node"
EGH_DATA_DIR="/var/lib/egh-node/volumes"
EGH_AGENT_URL="${panelUrl}/api/download/egh-node"

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this script must be run as root." >&2
  exit 1
fi

echo "[1/5] Checking system..."
apt-get update -q

echo "[2/5] Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker Engine..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
  echo "  Docker installed."
else
  echo "  Docker already present."
fi

echo "[3/5] Downloading EGH Node agent..."
mkdir -p "\${EGH_CONFIG_DIR}" /var/log/egh-node
curl -fsSL "\${EGH_AGENT_URL}" -o /usr/local/bin/egh-node
chmod +x /usr/local/bin/egh-node

echo "[4/5] Writing EGH Node configuration..."
mkdir -p "\${EGH_DATA_DIR}"
cat > "\${EGH_CONFIG_DIR}/config.yml" << NODECONF
debug: false
node_id: \${EGH_NODE_ID}

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

echo "[5/5] Installing EGH Node service..."
cat > /etc/systemd/system/egh-node.service << SVCEOF
[Unit]
Description=EGH Node Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=\${EGH_CONFIG_DIR}
ExecStart=/usr/local/bin/egh-node --config \${EGH_CONFIG_DIR}/config.yml
Restart=always
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now egh-node

echo ""
echo "============================================================"
echo " EGH Node installed and started."
echo " Node ${nodeName} should appear online in EGH Panel shortly."
echo "============================================================"
`;

  res
    .status(200)
    .setHeader("Content-Type", "text/x-shellscript")
    .setHeader("Content-Disposition", `attachment; filename="install-egh-node-${id}.sh"`)
    .send(script);
});

router.post("/nodes/:id/regen-token", requireAdmin, regenTokenLimiter, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const newToken = generateRegistrationToken();
  const expiresAt = tokenExpiresAt();

  const [node] = await db
    .update(nodesTable)
    .set({
      registrationToken: newToken,
      registrationTokenExpiresAt: expiresAt,
      status: "pending",
    })
    .where(eq(nodesTable.id, id))
    .returning();

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.json({
    registrationToken: newToken,
    registrationTokenExpiresAt: expiresAt,
    status: node.status,
  });
});

router.post("/nodes/:id/test-connection", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const url = `${node.scheme}://${node.fqdn}:${node.daemonPort}/api/system`;

  let sysData: Record<string, unknown>;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      res.json({
        reachable: false,
        error: `Daemon returned HTTP ${response.status}`,
      });
      return;
    }

    sysData = (await response.json()) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    res.json({
      reachable: false,
      error: isTimeout ? "Connection timed out (12 s)" : msg,
    });
    return;
  }

  const now = new Date();
  await db
    .update(nodesTable)
    .set({ status: "online", lastHeartbeatAt: now, updatedAt: now })
    .where(eq(nodesTable.id, id));

  res.json({
    reachable: true,
    version: sysData["version"] ?? "unknown",
    architecture: sysData["architecture"] ?? "unknown",
    os: sysData["os"] ?? "unknown",
    cpuCount: sysData["cpu_count"] ?? 0,
    kernelVersion: sysData["kernel_version"] ?? "unknown",
    memoryTotal: sysData["memory_total"] ?? 0,
  });
});

router.post("/nodes/:id/heartbeat", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ error: "Missing Bearer token" });
    return;
  }

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const matchesRegistration = node.registrationToken && node.registrationToken === token;
  const matchesDaemon = node.daemonToken && node.daemonToken === token;

  if (!matchesRegistration && !matchesDaemon) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }

  const now = new Date();

  if (!node.daemonToken) {
    const candidate = "daemon_" + randomBytes(32).toString("hex");
    const [updated] = await db
      .update(nodesTable)
      .set({
        status: "online",
        daemonToken: candidate,
        lastHeartbeatAt: now,
        updatedAt: now,
      })
      .where(and(eq(nodesTable.id, id), isNull(nodesTable.daemonToken)))
      .returning({ daemonToken: nodesTable.daemonToken });

    const daemonToken =
      updated?.daemonToken ??
      (
        await db
          .select({ daemonToken: nodesTable.daemonToken })
          .from(nodesTable)
          .where(eq(nodesTable.id, id))
          .limit(1)
      )[0]?.daemonToken ??
      candidate;

    res.json({ ok: true, status: "online", daemonToken });
    return;
  }

  await db
    .update(nodesTable)
    .set({ status: "online", lastHeartbeatAt: now, updatedAt: now })
    .where(eq(nodesTable.id, id));

  if (matchesRegistration) {
    res.json({ ok: true, status: "online", daemonToken: node.daemonToken });
    return;
  }

  res.json({ ok: true, status: "online" });
});

router.delete("/nodes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [node] = await db.delete(nodesTable).where(eq(nodesTable.id, id)).returning();
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/nodes/:nodeId/allocations", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
  const nodeId = parseInt(rawId, 10);

  const allocations = await db
    .select()
    .from(allocationsTable)
    .where(eq(allocationsTable.nodeId, nodeId));

  res.json(
    allocations.map((a) => ({
      ...a,
      isAssigned: a.serverId != null,
      serverName: null,
    })),
  );
});

router.post("/nodes/:nodeId/allocations", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
  const nodeId = parseInt(rawId, 10);

  const { ip, ports, alias } = req.body as {
    ip: string;
    ports: number[];
    alias?: string;
  };

  if (!ip || !Array.isArray(ports) || ports.length === 0) {
    res.status(400).json({ error: "ip and ports are required" });
    return;
  }

  const inserted = await db
    .insert(allocationsTable)
    .values(ports.map((port) => ({ nodeId, ip, port, alias: alias ?? null })))
    .returning();

  const first = inserted[0];
  res.status(201).json({ ...first, isAssigned: false, serverName: null });
});

router.delete("/allocations/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [alloc] = await db.delete(allocationsTable).where(eq(allocationsTable.id, id)).returning();
  if (!alloc) {
    res.status(404).json({ error: "Allocation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
