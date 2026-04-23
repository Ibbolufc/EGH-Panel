/**
 * Node Heartbeat Watcher
 *
 * Runs every 60 seconds. Any node whose status is `online` and whose
 * `lastHeartbeatAt` timestamp is either null or older than OFFLINE_GRACE_MS
 * is flipped to `offline`. This covers both nodes that never sent a heartbeat
 * (null) and nodes whose agent has gone quiet.
 */

import { and, eq, lt, inArray, isNull, or } from "drizzle-orm";
import { db, nodesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const OFFLINE_GRACE_MS = 2 * 60 * 1000; // 2 minutes
const CHECK_INTERVAL_MS = 60 * 1000;    // 1 minute

async function checkNodeHeartbeats(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_GRACE_MS);

    const staleNodes = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(
        and(
          eq(nodesTable.status, "online"),
          or(
            isNull(nodesTable.lastHeartbeatAt),
            lt(nodesTable.lastHeartbeatAt, cutoff)
          )
        )
      );

    if (staleNodes.length === 0) return;

    const ids = staleNodes.map((n) => n.id);
    await db
      .update(nodesTable)
      .set({ status: "offline", updatedAt: new Date() })
      .where(inArray(nodesTable.id, ids));

    logger.warn({ nodeIds: ids }, "Marked nodes offline due to missed heartbeat");
  } catch (err) {
    logger.error({ err }, "Node heartbeat check failed");
  }
}

export function startNodeHeartbeatWatcher(): void {
  checkNodeHeartbeats().catch((err) =>
    logger.error({ err }, "Initial node heartbeat check failed")
  );

  setInterval(() => {
    checkNodeHeartbeats().catch((err) =>
      logger.error({ err }, "Node heartbeat check failed")
    );
  }, CHECK_INTERVAL_MS);

  logger.info("Node heartbeat watcher started (60 s interval, 2 min grace period)");
}
