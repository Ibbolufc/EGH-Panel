/**
 * Remote API — daemon-to-panel callbacks
 *
 * These routes are called by Wings (or any compatible daemon), not by the
 * browser client. Authentication is a short-lived HS256 JWT signed with the
 * node's daemonToken (same secret the daemon uses in its own config).
 *
 * Note: this router is mounted under /api by the main route index, so paths
 * here must be relative (do not prefix them with /api again).
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db, serversTable, nodesTable } from "@workspace/db";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";

const router: Router = Router();

const InstallCallbackBody = z.object({
  successful: z.boolean(),
  reinstall: z.boolean().optional().default(false),
});

router.post(
  "/remote/servers/:uuid/install",
  validateBody(InstallCallbackBody),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params as { uuid: string };
    const { successful } = req.body as z.infer<typeof InstallCallbackBody>;

    const [server] = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.uuid, uuid));

    if (!server) {
      res.status(404).json({ error: "Server not found" });
      return;
    }

    const [node] = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.id, server.nodeId));

    const secret = node?.daemonToken ?? node?.registrationToken;
    if (!secret) {
      res.status(403).json({ error: "Node has no configured daemon token" });
      return;
    }

    const authHeader = req.headers.authorization ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    try {
      jwt.verify(bearer, secret, { algorithms: ["HS256"] });
    } catch {
      res.status(403).json({ error: "Invalid daemon token" });
      return;
    }

    if (server.status === "installing") {
      if (successful) {
        await db
          .update(serversTable)
          .set({ status: "offline" })
          .where(eq(serversTable.uuid, uuid));
        req.log.info({ serverId: server.id, uuid }, "[remote] Install completed — status -> offline");
      } else {
        req.log.warn({ serverId: server.id, uuid }, "[remote] Install reported as failed — status unchanged");
      }
    }

    res.sendStatus(204);
  }),
);

export default router;
