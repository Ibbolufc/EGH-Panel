import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, panelSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";

const router: Router = Router();

const VERSION_KEY = "egh_node_version";
const VERSION_RE = /^(latest|v\d+\.\d+\.\d+[\w.-]*)$/;

router.get("/settings/egh-node-version", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(panelSettingsTable)
    .where(eq(panelSettingsTable.key, VERSION_KEY))
    .limit(1);

  const version = rows[0]?.value ?? "latest";
  res.json({ version });
});

router.put("/settings/egh-node-version", requireAdmin, async (req, res): Promise<void> => {
  const { version } = req.body as { version?: unknown };

  if (typeof version !== "string" || !VERSION_RE.test(version.trim())) {
    res.status(400).json({
      error: 'version must be "latest" or a semver tag like "v1.11.14"',
    });
    return;
  }

  const trimmed = version.trim();

  await db
    .insert(panelSettingsTable)
    .values({ key: VERSION_KEY, value: trimmed })
    .onConflictDoUpdate({
      target: panelSettingsTable.key,
      set: { value: trimmed },
    });

  res.json({ version: trimmed });
});

export default router;
