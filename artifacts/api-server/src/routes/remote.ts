/**
 * Remote API — daemon-to-panel callbacks
 *
 * These routes are called by Wings (or any compatible daemon), not by the
 * browser client.  Authentication is a short-lived HS256 JWT signed with the
 * node's daemonToken (same secret Wings uses in its own config.yml).
 *
 * Endpoints mirror the Pterodactyl remote API so Wings works unmodified:
 *   POST /api/remote/servers/:uuid/install   — install-complete callback
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

/**
 * POST /api/remote/servers/:uuid/install
 *
 * Wings calls this when the install script finishes.
 * Body: { successful: boolean, reinstall?: boolean }
 *
 * On success  → status = "offline"  (ready to start)
 * On failure  → status unchanged    (stays "installing"; admin must reinstall)
 */
router.post(
  "/api/remote/servers/:uuid/install",
  validateBody(InstallCallbackBody),
  asyncHandler(async (req, res) => {
    const { uuid } = req.params as { uuid: string };
    const { successful } = req.body as z.infer<typeof InstallCallbackBody>;

    // Look up the server so we can find the node's signing secret.
    const [server] = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.uuid, uuid));

    if (!server) {
      res.status(404).json({ error: "Server not found" });
      return;
    }

    // Fetch node to get its daemon token (the JWT signing secret).
    const [node] = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.id, server.nodeId));

    const secret = node?.daemonToken ?? node?.registrationToken;
    if (!secret) {
      res.status(403).json({ error: "Node has no configured daemon token" });
      return;
    }

    // Verify the Bearer JWT Wings attached to the request.
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

    // Advance status only if the server is still in "installing" state.
    // If it was already moved (e.g. by a reinstall race), leave it alone.
    if (server.status === "installing") {
      if (successful) {
        await db
          .update(serversTable)
          .set({ status: "offline" })
          .where(eq(serversTable.uuid, uuid));
        req.log.info({ serverId: server.id, uuid }, "[remote] Install completed — status → offline");
      } else {
        req.log.warn({ serverId: server.id, uuid }, "[remote] Install reported as failed — status unchanged");
      }
    }

    res.sendStatus(204);
  }),
);

export default router;
