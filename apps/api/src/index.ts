import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  console.log(`EGH API listening on ${env.API_URL}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down API`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
