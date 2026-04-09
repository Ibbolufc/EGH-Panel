import { pgTable, serial, text, integer, timestamp, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { nodesTable, allocationsTable } from "./nodes";
import { eggsTable } from "./eggs";

export const serverStatusEnum = pgEnum("server_status", [
  "installing",
  "install_failed",
  "running",
  "offline",
  "stopping",
  "starting",
  "suspended",
]);

export const serversTable = pgTable("servers", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().defaultRandom().unique(),
  name: text("name").notNull(),
  description: text("description"),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id),
  eggId: integer("egg_id").notNull().references(() => eggsTable.id),
  allocationId: integer("allocation_id").notNull().references(() => allocationsTable.id),
  status: serverStatusEnum("status").notNull().default("offline"),
  memoryLimit: integer("memory_limit").notNull().default(512),
  diskLimit: integer("disk_limit").notNull().default(1024),
  cpuLimit: integer("cpu_limit").notNull().default(100),
  startup: text("startup"),
  dockerImage: text("docker_image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const serverVariablesTable = pgTable("server_variables", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  envVariable: text("env_variable").notNull(),
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServerSchema = createInsertSchema(serversTable).omit({ id: true, uuid: true, createdAt: true, updatedAt: true });
export type InsertServer = z.infer<typeof insertServerSchema>;
export type Server = typeof serversTable.$inferSelect;

export const insertServerVariableSchema = createInsertSchema(serverVariablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServerVariable = z.infer<typeof insertServerVariableSchema>;
export type ServerVariable = typeof serverVariablesTable.$inferSelect;
