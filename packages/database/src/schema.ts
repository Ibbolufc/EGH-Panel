import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const nodeStatus = pgEnum('node_status', ['offline', 'installing', 'online', 'degraded']);
export const serverStatus = pgEnum('server_status', ['offline', 'starting', 'running', 'stopping', 'installing', 'crashed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  fqdn: text('fqdn').notNull(),
  status: nodeStatus('status').notNull().default('offline'),
  daemonTokenHash: text('daemon_token_hash'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id').notNull().references(() => nodes.id),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  status: serverStatus('status').notNull().default('offline'),
  dockerImage: text('docker_image').notNull(),
  startupCommand: text('startup_command').notNull(),
  cpuLimit: integer('cpu_limit').notNull().default(0),
  memoryMb: integer('memory_mb').notNull(),
  diskMb: integer('disk_mb').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const allocations = pgTable('allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeId: uuid('node_id').notNull().references(() => nodes.id),
  serverId: uuid('server_id').references(() => servers.id),
  ip: text('ip').notNull(),
  port: integer('port').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
