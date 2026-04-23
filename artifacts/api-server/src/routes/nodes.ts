import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, nodesTable, allocationsTable, serversTable } from "@workspace/db";
import { CreateNodeBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router: Router = Router();

function generateRegistrationToken(): string {
  return "reg_" + randomBytes(24).toString("hex");
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

router.get("/nodes", requireAdmin, async (req, res): Promise<void> => {
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
      notes: nodesTable.notes,
      createdAt: nodesTable.createdAt,
    })
    .from(nodesTable);

  const results = await Promise.all(
    nodes.map(async (node) => {
      const [serverCount] = await db.select({ count: count() }).from(serversTable).where(eq(serversTable.nodeId, node.id));
      const [allocCount] = await db.select({ count: count() }).from(allocationsTable).where(eq(allocationsTable.nodeId, node.id));
      return nodeWithMeta(node, Number(serverCount?.count ?? 0), Number(allocCount?.count ?? 0));
    })
  );

  res.json(results);
});

router.post("/nodes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Accept extra fields not in generated zod schema
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

  const [serverCount] = await db.select({ count: count() }).from(serversTable).where(eq(serversTable.nodeId, id));

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

  // Partial update — accept name, location, notes, fqdn, daemonPort, scheme, etc.
  const allowedFields = ["name", "fqdn", "scheme", "daemonPort", "isPublic", "memoryTotal",
    "memoryOverallocate", "diskTotal", "diskOverallocate", "status", "location", "notes"];
  const patch: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) patch[key] = req.body[key];
  }

  const [node] = await db.update(nodesTable).set(patch).where(eq(nodesTable.id, id)).returning();
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(nodeWithMeta(node));
});

// Regenerate registration token — invalidates any pending install command
router.post("/nodes/:id/regen-token", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const newToken = generateRegistrationToken();

  const [node] = await db
    .update(nodesTable)
    .set({ registrationToken: newToken, status: "pending" })
    .where(eq(nodesTable.id, id))
    .returning();

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.json({ registrationToken: newToken, status: node.status });
});

// Test connection — admin triggers a live reachability check against the daemon
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

  // Daemon is reachable — optimistically mark it online
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

// Heartbeat — called by the EGH Node agent; no admin session required
// Auth: Bearer <registrationToken> in Authorization header
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

  if (!node.registrationToken || node.registrationToken !== token) {
    res.status(403).json({ error: "Invalid registration token" });
    return;
  }

  const now = new Date();
  await db
    .update(nodesTable)
    .set({ status: "online", lastHeartbeatAt: now, updatedAt: now })
    .where(eq(nodesTable.id, id));

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

// Allocations
router.get("/nodes/:nodeId/allocations", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
  const nodeId = parseInt(rawId, 10);

  const allocations = await db.select().from(allocationsTable).where(eq(allocationsTable.nodeId, nodeId));
  res.json(allocations.map((a) => ({ ...a, isAssigned: a.serverId != null, serverName: null })));
});

router.post("/nodes/:nodeId/allocations", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
  const nodeId = parseInt(rawId, 10);

  const { ip, ports, alias } = req.body as { ip: string; ports: number[]; alias?: string };
  if (!ip || !Array.isArray(ports) || ports.length === 0) {
    res.status(400).json({ error: "ip and ports are required" });
    return;
  }

  const inserted = await db.insert(allocationsTable).values(
    ports.map((port) => ({ nodeId, ip, port, alias: alias ?? null }))
  ).returning();

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

router.get("/download/egh-node", (_req, res): void => {
  const arch = ((_req.query.arch as string) || "amd64").replace(/[^a-z0-9_]/g, "");
  const segments = ["pterodactyl", "wings", `releases/latest/download/wings_linux_${arch}`];
  res.redirect(302, `https://github.com/${segments[0]}/${segments[1]}/${segments[2]}`);
});

export default router;
