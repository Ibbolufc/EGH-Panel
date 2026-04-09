import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, serversTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: Router = Router();

// Mock file system for demo purposes — in production this would
// proxy to the node daemon or mount a real filesystem path

const mockFiles: Record<string, { name: string; isDirectory: boolean; size: number; content?: string }[]> = {};

function getServerFiles(serverId: number, path: string) {
  const key = `${serverId}:${path}`;
  if (!mockFiles[key]) {
    // Generate some default mock files for root
    if (path === "/" || path === "") {
      mockFiles[key] = [
        { name: "server.jar", isDirectory: false, size: 45678900 },
        { name: "server.properties", isDirectory: false, size: 2048 },
        { name: "ops.json", isDirectory: false, size: 256 },
        { name: "plugins", isDirectory: true, size: 0 },
        { name: "world", isDirectory: true, size: 0 },
        { name: "logs", isDirectory: true, size: 0 },
      ];
    } else {
      mockFiles[key] = [];
    }
  }
  return mockFiles[key];
}

router.get("/servers/:id/files", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const path = typeof req.query.path === "string" ? req.query.path : "/";

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const files = getServerFiles(id, path);
  const now = new Date().toISOString();

  res.json(files.map((f) => ({
    name: f.name,
    path: path === "/" ? `/${f.name}` : `${path}/${f.name}`,
    size: f.size,
    isDirectory: f.isDirectory,
    isFile: !f.isDirectory,
    modifiedAt: now,
  })));
});

router.get("/servers/:id/files/content", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const path = typeof req.query.path === "string" ? req.query.path : "";

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const contentMap: Record<string, string> = {
    "/server.properties": `# Minecraft server properties
server-port=25565
max-players=20
gamemode=survival
difficulty=normal
spawn-protection=16
motd=A Minecraft Server hosted on EGH Panel`,
    "/ops.json": `[]`,
  };

  const content = contentMap[path] ?? `# File content for ${path}\n# Edit and save below\n`;
  res.json({ path, content });
});

router.put("/servers/:id/files/content", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ message: "File saved successfully" });
});

router.post("/servers/:id/files/delete", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ message: "File deleted successfully" });
});

router.post("/servers/:id/files/rename", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ message: "File renamed successfully" });
});

router.post("/servers/:id/files/mkdir", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ message: "Directory created successfully" });
});

export default router;
