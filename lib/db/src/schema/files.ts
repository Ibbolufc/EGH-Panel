import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { serversTable } from "./servers";

export const backupStatusEnum = pgEnum("backup_status", [
  "created",
  "in_progress",
  "completed",
  "failed",
  "deleted",
]);

export const backupsTable = pgTable("backups", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  size: integer("size").notNull().default(0),
  status: backupStatusEnum("status").notNull().default("created"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const scheduleActionEnum = pgEnum("schedule_action", [
  "start",
  "stop",
  "restart",
  "kill",
  "backup",
  "command",
]);

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cronMinute: text("cron_minute").notNull().default("0"),
  cronHour: text("cron_hour").notNull().default("*"),
  cronDayOfMonth: text("cron_day_of_month").notNull().default("*"),
  cronMonth: text("cron_month").notNull().default("*"),
  cronDayOfWeek: text("cron_day_of_week").notNull().default("*"),
  action: scheduleActionEnum("action").notNull().default("restart"),
  payload: text("payload"),
  isEnabled: text("is_enabled").notNull().default("true"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBackupSchema = createInsertSchema(backupsTable).omit({ id: true, createdAt: true });
export type InsertBackup = z.infer<typeof insertBackupSchema>;
export type Backup = typeof backupsTable.$inferSelect;

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
