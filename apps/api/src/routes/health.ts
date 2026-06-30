import { Router } from 'express';
import type { HealthResponse } from '@egh/shared';

export const healthRouter = Router();

healthRouter.get('/', (_, res) => {
  const payload: HealthResponse = {
    ok: true,
    service: 'egh-panel-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  };

  res.json(payload);
});
