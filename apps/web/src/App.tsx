import { Activity, Boxes, Cpu, HardDrive, Network, Server } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getHealth, getNodes, getServers } from './api.js';

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth });
  const nodes = useQuery({ queryKey: ['nodes'], queryFn: getNodes });
  const servers = useQuery({ queryKey: ['servers'], queryFn: getServers });

  const nodeCount = nodes.data?.length ?? 0;
  const serverCount = servers.data?.length ?? 0;
  const runningServers = servers.data?.filter((server) => server.status === 'running').length ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-purple-950/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-300">EGH Panel</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Clean game hosting control panel</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              A fresh foundation for managing nodes, servers, allocations, eggs, installs, and realtime status without the Replit clutter.
            </p>
          </div>
          <div className="rounded-2xl border border-purple-400/30 bg-purple-400/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-purple-200">API status</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5" />
              {health.isLoading ? 'Checking...' : health.data?.ok ? 'Online' : 'Unavailable'}
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard icon={<Network />} label="Nodes" value={nodeCount.toString()} detail="Connected daemon hosts" />
          <StatCard icon={<Server />} label="Servers" value={serverCount.toString()} detail="Game server records" />
          <StatCard icon={<Boxes />} label="Running" value={runningServers.toString()} detail="Live game containers" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <PanelCard title="Nodes" description="Daemon hosts that will run Docker game servers.">
            {nodes.data?.map((node) => (
              <div key={node.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">{node.name}</h3>
                    <p className="text-sm text-slate-400">{node.fqdn}</p>
                  </div>
                  <StatusBadge value={node.status} />
                </div>
              </div>
            ))}
          </PanelCard>

          <PanelCard title="Servers" description="First server list backed by the API placeholder routes.">
            {servers.data?.map((server) => (
              <div key={server.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">{server.name}</h3>
                    <p className="text-sm text-slate-400">{server.ownerEmail}</p>
                  </div>
                  <StatusBadge value={server.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-300">
                  <span className="flex items-center gap-2"><Cpu className="h-4 w-4" /> {server.cpuLimit || 'Shared'} CPU</span>
                  <span className="flex items-center gap-2">RAM {Math.round(server.memoryMb / 1024)}GB</span>
                  <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> {Math.round(server.diskMb / 1024)}GB</span>
                </div>
              </div>
            ))}
          </PanelCard>
        </section>
      </section>
    </main>
  );
}

function StatCard(props: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between text-purple-200">
        <span className="text-sm font-medium uppercase tracking-[0.2em]">{props.label}</span>
        <span className="rounded-xl bg-purple-400/10 p-2">{props.icon}</span>
      </div>
      <p className="mt-5 text-4xl font-bold text-white">{props.value}</p>
      <p className="mt-2 text-sm text-slate-400">{props.detail}</p>
    </article>
  );
}

function PanelCard(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">{props.title}</h2>
        <p className="mt-1 text-sm text-slate-400">{props.description}</p>
      </div>
      <div className="space-y-3">{props.children}</div>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-200">{value}</span>;
}
