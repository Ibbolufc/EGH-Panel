import { z } from 'zod';

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const NodeStatusSchema = z.enum(['offline', 'installing', 'online', 'degraded']);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const ServerStatusSchema = z.enum(['offline', 'starting', 'running', 'stopping', 'installing', 'crashed']);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

export const NodeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  fqdn: z.string(),
  status: NodeStatusSchema,
  lastSeenAt: z.string().nullable(),
});

export type NodeSummary = z.infer<typeof NodeSummarySchema>;

export const ServerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerEmail: z.string().email(),
  nodeId: z.string(),
  status: ServerStatusSchema,
  cpuLimit: z.number().int().nonnegative(),
  memoryMb: z.number().int().positive(),
  diskMb: z.number().int().positive(),
});

export type ServerSummary = z.infer<typeof ServerSummarySchema>;
