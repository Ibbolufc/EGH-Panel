import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const nodeSchemeEnum = pgEnum("node_scheme", ["http", "https"]);
export const nodeStatusEnum = pgEnum("node_status", ["online", "offline", "maintenance", "pending"]);

export const nodesTable = pgTable("nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  fqdn: text("fqdn").notNull(),
  scheme: nodeSchemeEnum("scheme").notNull().default("https"),
  daemonPort: integer("daemon_port").notNull().default(8080),
  isPublic: boolean("is_public").notNull().default(true),
  memoryTotal: integer("memory_total").notNull(),
  memoryOverallocate: integer("memory_overallocate").notNull().default(0),
  diskTotal: integer("disk_total").notNull(),
  diskOverallocate: integer("disk_overallocate").notNull().default(0),
  status: nodeStatusEnum("status").notNull().default("pending"),
  daemonToken: text("daemon_token"),
  registrationToken: text("registration_token"),
  notes: text("notes"),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const allocationsTable = pgTable("allocations", {
  id: serial("id").primaryKey(),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id, { onDelete: "cascade" }),
  ip: text("ip").notNull(),
  port: integer("port").notNull(),
  alias: text("alias"),
  serverId: integer("server_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Node = typeof nodesTable.$inferSelect;

export const insertAllocationSchema = createInsertSchema(allocationsTable).omit({ id: true, createdAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocationsTable.$inferSelect;
