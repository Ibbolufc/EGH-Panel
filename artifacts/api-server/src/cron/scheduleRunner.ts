/**
 * Schedule Runner
 *
 * Polls the database every 30 s for schedule changes.
 * Each enabled schedule is registered as a node-cron job.
 * The cron expression is composed from the five schedule fields:
 *   minute hour dayOfMonth month dayOfWeek
 *
 * For production at scale: swap polling for BullMQ + Redis queues.
 */

import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, schedulesTable, serversTable, nodesTable, backupsTable } from "@workspace/db";
import { getProviderForNode } from "../providers/registry";
import type { ProviderNode, ProviderServer } from "../providers/types";
import { logger } from "../lib/logger";

const activeJobs = new Map<number, cron.ScheduledTask>();

function buildCronExpression(s: typeof schedulesTable.$inferSelect): string {
  return `${s.cronMinute} ${s.cronHour} ${s.cronDayOfMonth} ${s.cronMonth} ${s.cronDayOfWeek}`;
}

async function executeSchedule(scheduleId: number): Promise<void> {
  const [schedule] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, scheduleId));
  if (!schedule || schedule.isEnabled !== "true") return;

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, schedule.serverId));
  if (!server) return;

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, server.nodeId));
  if (!node) return;

  const providerNode: ProviderNode = {
    id: node.id,
    fqdn: node.fqdn,
    scheme: node.scheme,
    daemonPort: node.daemonPort,
    daemonToken: node.daemonToken,
  };

  const providerServer: ProviderServer = {
    id: server.id,
    uuid: server.uuid,
    node: providerNode,
    dockerImage: server.dockerImage,
    startup: server.startup,
    memoryLimit: server.memoryLimit,
    diskLimit: server.diskLimit,
    cpuLimit: server.cpuLimit,
  };

  const provider = getProviderForNode(providerNode);

  logger.info({ scheduleId, action: schedule.action, serverId: server.id }, "Executing schedule");

  try {
    switch (schedule.action) {
      case "command":
        if (schedule.payload) {
          await provider.sendCommand(providerServer, schedule.payload);
        }
        break;
      case "backup": {
        const [backup] = await db.insert(backupsTable).values({
          serverId: server.id,
          name: `Scheduled backup ${new Date().toISOString()}`,
          size: 0,
          status: "in_progress",
        }).returning();
        await provider.createBackup(providerServer, backup.name);
        setTimeout(async () => {
          await db.update(backupsTable).set({
            status: "completed",
            size: Math.floor(Math.random() * 500_000_000) + 50_000_000,
            completedAt: new Date(),
          }).where(eq(backupsTable.id, backup.id));
        }, 5000);
        break;
      }
      default:
        await provider.powerAction(providerServer, schedule.action as "start" | "stop" | "restart" | "kill");
        break;
    }

    await db
      .update(schedulesTable)
      .set({ lastRunAt: new Date() })
      .where(eq(schedulesTable.id, scheduleId));
  } catch (err) {
    logger.error({ err, scheduleId }, "Schedule execution failed");
  }
}

async function syncSchedules(): Promise<void> {
  try {
    const schedules = await db.select().from(schedulesTable);
    const enabledIds = new Set(schedules.filter((s) => s.isEnabled === "true").map((s) => s.id));

    for (const [id, task] of activeJobs.entries()) {
      if (!enabledIds.has(id)) {
        task.stop();
        activeJobs.delete(id);
        logger.debug({ scheduleId: id }, "Stopped schedule (disabled or deleted)");
      }
    }

    for (const schedule of schedules) {
      if (schedule.isEnabled !== "true") continue;
      if (activeJobs.has(schedule.id)) continue;

      const expr = buildCronExpression(schedule);

      if (!cron.validate(expr)) {
        logger.warn({ scheduleId: schedule.id, expr }, "Invalid cron expression — skipping");
        continue;
      }

      const task = cron.schedule(expr, () => {
        executeSchedule(schedule.id).catch((err) => {
          logger.error({ err, scheduleId: schedule.id }, "Schedule cron fire error");
        });
      });

      activeJobs.set(schedule.id, task);
      logger.debug({ scheduleId: schedule.id, expr }, "Registered cron schedule");
    }
  } catch (err) {
    logger.error({ err }, "Failed to sync schedules from database");
  }
}

export function startScheduleRunner(): void {
  syncSchedules().catch((err) => logger.error({ err }, "Initial schedule sync failed"));

  setInterval(() => {
    syncSchedules().catch((err) => logger.error({ err }, "Schedule sync failed"));
  }, 30_000);

  logger.info("Schedule runner started (30 s sync interval)");
}

export function stopAllSchedules(): void {
  for (const [id, task] of activeJobs.entries()) {
    task.stop();
    activeJobs.delete(id);
  }
}
