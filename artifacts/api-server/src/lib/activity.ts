import { db, activityLogsTable } from "@workspace/db";
import type { Request } from "express";

interface LogActivityParams {
  req?: Request;
  userId?: number | null;
  serverId?: number | null;
  event: string;
  description: string;
}

export async function logActivity({ req, userId, serverId, event, description }: LogActivityParams): Promise<void> {
  try {
    const ip = req?.ip ?? req?.headers["x-forwarded-for"]?.toString() ?? null;
    await db.insert(activityLogsTable).values({
      userId: userId ?? null,
      serverId: serverId ?? null,
      event,
      description,
      ip,
    });
  } catch {
    // Non-critical — don't let logging failures break requests
  }
}
