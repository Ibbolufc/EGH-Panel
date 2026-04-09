import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, nodesTable, allocationsTable, serversTable } from "@workspace/db";
import { CreateNodeBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";

const router: Router = Router();

router.get("/nodes", requireAdmin, async (req, res): Promise<void> => {
  const nodes = await db
    .select({
      id: nodesTable.id,
      name: nodesTable.name,
      fqdn: nodesTable.fqdn,
      scheme: nodesTable.scheme,
      daemonPort: nodesTable.daemonPort,
      isPublic: nodesTable.isPublic,
      memoryTotal: nodesTable.memoryTotal,
      memoryOverallocate: nodesTable.memoryOverallocate,
      diskTotal: nodesTable.diskTotal,
      diskOverallocate: nodesTable.diskOverallocate,
      status: nodesTable.status,
      createdAt: nodesTable.createdAt,
    })
    .from(nodesTable);

  // Get counts
  const results = await Promise.all(
    nodes.map(async (node) => {
      const [serverCount] = await db.select({ count: count() }).from(serversTable).where(eq(serversTable.nodeId, node.id));
      const [allocCount] = await db.select({ count: count() }).from(allocationsTable).where(eq(allocationsTable.nodeId, node.id));
      return {
        ...node,
        locationId: null,
        locationName: null,
        serverCount: Number(serverCount?.count ?? 0),
        allocationCount: Number(allocCount?.count ?? 0),
      };
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

  const [node] = await db.insert(nodesTable).values(parsed.data).returning();
  res.status(201).json({
    ...node,
    locationId: null,
    locationName: null,
    serverCount: 0,
    allocationCount: 0,
  });
});

router.get("/nodes/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, id));
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const allocations = await db.select({
    id: allocationsTable.id,
    nodeId: allocationsTable.nodeId,
    ip: allocationsTable.ip,
    port: allocationsTable.port,
    alias: allocationsTable.alias,
    serverId: allocationsTable.serverId,
    isAssigned: allocationsTable.serverId,
  }).from(allocationsTable).where(eq(allocationsTable.nodeId, id));

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

  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [node] = await db.update(nodesTable).set(parsed.data).where(eq(nodesTable.id, id)).returning();
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json({ ...node, locationId: null, locationName: null, serverCount: 0, allocationCount: 0 });
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
  res.json(allocations.map((a) => ({
    ...a,
    isAssigned: a.serverId != null,
    serverName: null,
  })));
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

  // Return the first one for simplicity
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
