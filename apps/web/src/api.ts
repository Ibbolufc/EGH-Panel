import type { HealthResponse, NodeSummary, ServerSummary } from '@egh/shared';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getHealth() {
  return fetchJson<HealthResponse>('/health');
}

export async function getNodes() {
  const response = await fetchJson<{ data: NodeSummary[] }>('/api/nodes');
  return response.data;
}

export async function getServers() {
  const response = await fetchJson<{ data: ServerSummary[] }>('/api/servers');
  return response.data;
}
