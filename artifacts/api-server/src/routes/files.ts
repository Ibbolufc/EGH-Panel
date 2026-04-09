import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, serversTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { parseIntParam, validateBody } from "../middleware/validate";
import { buildProviderServer } from "../services/serverService";
import { getProviderForNode } from "../providers/registry";

const router: Router = Router();

const WriteFileBody = z.object({
  path: z.string().min(1, "path is required"),
  content: z.string(),
});

const DeleteFilesBody = z.object({
  paths: z.array(z.string().min(1)).min(1, "at least one path is required"),
});

const RenameFileBody = z.object({
  from: z.string().min(1, "from is required"),
  to: z.string().min(1, "to is required"),
});

const MkdirBody = z.object({
  path: z.string().min(1, "path is required"),
});

async function getServerOrFail(
  id: number,
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
): Promise<typeof serversTable.$inferSelect | null> {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, id));
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return null;
  }
  if (req.user?.role === "client" && server.userId !== req.user.userId) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return server;
}

router.get("/servers/:id/files", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const path = typeof req.query.path === "string" ? req.query.path : "/";
  const { providerServer } = await buildProviderServer(id);
  const files = await getProviderForNode(providerServer.node).listFiles(providerServer, path);
  res.json(files);
}));

router.get("/servers/:id/files/content", requireAuth, asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!path) {
    res.status(400).json({ error: "path query parameter is required" });
    return;
  }

  const { providerServer } = await buildProviderServer(id);
  const content = await getProviderForNode(providerServer.node).readFile(providerServer, path);
  res.json({ path, content });
}));

router.put("/servers/:id/files/content", requireAuth, validateBody(WriteFileBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const { path, content } = req.body as z.infer<typeof WriteFileBody>;
  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).writeFile(providerServer, path, content);
  res.json({ message: "File saved" });
}));

router.post("/servers/:id/files/delete", requireAuth, validateBody(DeleteFilesBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const { paths } = req.body as z.infer<typeof DeleteFilesBody>;
  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).deleteFiles(providerServer, paths);
  res.json({ message: "File(s) deleted" });
}));

router.post("/servers/:id/files/rename", requireAuth, validateBody(RenameFileBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const { from, to } = req.body as z.infer<typeof RenameFileBody>;
  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).renameFile(providerServer, from, to);
  res.json({ message: "File renamed" });
}));

router.post("/servers/:id/files/mkdir", requireAuth, validateBody(MkdirBody), asyncHandler(async (req, res) => {
  const id = parseIntParam(req, res, "id");
  if (id === null) return;
  if (!(await getServerOrFail(id, req, res))) return;

  const { path } = req.body as z.infer<typeof MkdirBody>;
  const { providerServer } = await buildProviderServer(id);
  await getProviderForNode(providerServer.node).createDirectory(providerServer, path);
  res.json({ message: "Directory created" });
}));

export default router;
