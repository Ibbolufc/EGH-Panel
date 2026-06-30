import { Router } from 'express';
import type { ServerSummary } from '@egh/shared';

export const serversRouter = Router();

const demoServers: ServerSummary[] = [
  {
    id: 'demo-server-1',
    name: 'Demo Minecraft Server',
    ownerEmail: 'owner@example.com',
    nodeId: 'demo-node-1',
    status: 'offline',
    cpuLimit: 0,
    memoryMb: 4096,
    diskMb: 20480,
  },
];

serversRouter.get('/', (_, res) => {
  res.json({ data: demoServers });
});

serversRouter.post('/:id/power/:action', (req, res) => {
  res.status(202).json({
    serverId: req.params.id,
    action: req.params.action,
    queued: true,
    message: 'Power action placeholder queued. Node command wiring comes in the next milestone.',
  });
});
