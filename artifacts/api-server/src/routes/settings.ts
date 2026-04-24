import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { PINNED_VERSION } from "./download";

const router: Router = Router();

/**
 * Returns the active EGH Node binary version.
 * This is always the pinned constant — runtime overrides are not supported.
 * To change the version, update PINNED_VERSION in download.ts and redeploy.
 */
router.get("/settings/egh-node-version", requireAdmin, (_req, res): void => {
  res.json({ version: PINNED_VERSION, pinned: true });
});

export default router;
