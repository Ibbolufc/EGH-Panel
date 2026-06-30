import { Router } from 'express';
import type { NodeSummary } from '@egh/shared';

export const nodesRouter = Router();

const demoNodes: NodeSummary[] = [
  {
    id: 'demo-node-1',
    name: 'Demo Node',
    fqdn: '127.0.0.1',
    status: 'offline',
    lastSeenAt: null,
  },
];

nodesRouter.get('/', (_, res) => {
  res.json({ data: demoNodes });
});

nodesRouter.post('/:id/test-connection', (req, res) => {
  res.status(202).json({
    nodeId: req.params.id,
    queued: true,
    message: 'Connection test placeholder queued. Node RPC wiring comes in the next milestone.',
  });
});
