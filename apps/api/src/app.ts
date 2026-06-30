import cors from 'cors';
import express from 'express';
import { env } from './env.js';
import { healthRouter } from './routes/health.js';
import { nodesRouter } from './routes/nodes.js';
import { serversRouter } from './routes/servers.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/api/nodes', nodesRouter);
  app.use('/api/servers', serversRouter);

  app.use((_, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
