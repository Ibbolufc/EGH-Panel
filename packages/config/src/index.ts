import { z } from 'zod';

export const PanelEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_PORT: z.coerce.number().int().positive().default(5173),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type PanelEnv = z.infer<typeof PanelEnvSchema>;

export function parsePanelEnv(source: NodeJS.ProcessEnv): PanelEnv {
  const parsed = PanelEnvSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid EGH Panel environment:\n${issues}`);
  }

  return parsed.data;
}
