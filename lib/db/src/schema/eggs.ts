import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { nestsTable } from "./nests";

export const eggsTable = pgTable("eggs", {
  id: serial("id").primaryKey(),
  nestId: integer("nest_id").notNull().references(() => nestsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dockerImage: text("docker_image").notNull(),
  dockerImages: text("docker_images").array(),
  startup: text("startup").notNull(),
  installScript: text("install_script"),
  configFiles: text("config_files"),
  fileDenyList: text("file_deny_list").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const eggVariablesTable = pgTable("egg_variables", {
  id: serial("id").primaryKey(),
  eggId: integer("egg_id").notNull().references(() => eggsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  envVariable: text("env_variable").notNull(),
  defaultValue: text("default_value").notNull().default(""),
  userViewable: text("user_viewable").notNull().default("true"),
  userEditable: text("user_editable").notNull().default("false"),
  rules: text("rules").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEggSchema = createInsertSchema(eggsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEgg = z.infer<typeof insertEggSchema>;
export type Egg = typeof eggsTable.$inferSelect;

export const insertEggVariableSchema = createInsertSchema(eggVariablesTable).omit({ id: true, createdAt: true });
export type InsertEggVariable = z.infer<typeof insertEggVariableSchema>;
export type EggVariable = typeof eggVariablesTable.$inferSelect;
