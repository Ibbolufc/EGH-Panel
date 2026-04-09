# EGH Panel

A self-hosted, premium dark-themed game server hosting control panel with Pterodactyl egg compatibility. Manage game servers, users, nodes, and schedules from a polished admin and client interface.

---

## Features

- **Admin panel** — users, servers, nodes, eggs/nests, activity log, dashboard stats
- **Client panel** — live console, file manager, backups, schedules, startup variables
- **Pterodactyl egg import** — drop in any Pterodactyl v1 `egg.json` file (with preview mode)
- **Live WebSocket console** — real-time server output and command dispatch
- **Cron schedules** — automate power actions, backups, and commands
- **Role system** — `super_admin`, `admin`, `client`
- **Provider abstraction** — swap in a real Wings/Pterodactyl daemon with no route changes

---

## Stack

| Layer         | Technology                         |
|---------------|------------------------------------|
| Frontend      | React 19 + Vite 7 + TypeScript     |
| Backend       | Express 5 + TypeScript (ESM)       |
| Database      | PostgreSQL 16 + Drizzle ORM        |
| Realtime      | WebSocket (ws library)             |
| Scheduling    | node-cron                          |
| Auth          | JWT (jsonwebtoken + bcryptjs)      |
| API Spec      | OpenAPI 3 + Orval codegen          |
| Deployment    | Docker Compose + nginx             |

---

## Architecture

```
nginx (port 80)
  ├── /api/*  →  api-server (Express 5, port 8080)
  ├── /ws     →  api-server (WebSocket console)
  └── /*      →  egh-panel (React SPA served by nginx)

PostgreSQL 16  — primary database
Redis 7        — wired, reserved for future queue/cache use
```

### Provider abstraction

All game server operations go through the `INodeProvider` interface. The current implementation uses `MockProvider` (realistic in-memory simulation). To connect a real Pterodactyl Wings daemon:

1. Implement `INodeProvider` in `artifacts/api-server/src/providers/wings.ts`
2. Register it in `artifacts/api-server/src/providers/registry.ts`

No route changes needed.

### WebSocket Console

Clients connect to `ws://HOST/ws?token=JWT&serverId=N`.

Outgoing: `console`, `status`, `stats`, `auth_error`, `not_found`
Incoming: `send_command`, `set_state`

---

## Quickstart (Docker Compose)

### Prerequisites

- Docker 24+ and Docker Compose v2
- Linux server (Ubuntu 22.04+ recommended)

### 1. Clone and configure

```bash
git clone https://github.com/Ibbolufc/EGH-Panel.git
cd EGH-Panel
cp .env.example .env
```

Edit `.env` — required values:

```env
POSTGRES_PASSWORD=your_strong_password
JWT_SECRET=           # generate: openssl rand -hex 64
REDIS_PASSWORD=your_redis_password
FRONTEND_URL=http://your-server-ip
```

### 2. Deploy

```bash
./scripts/deploy.sh
```

Or manually:

```bash
docker compose build --parallel
docker compose run --rm api pnpm --filter @workspace/db run push-force
docker compose run --rm api pnpm --filter @workspace/scripts run seed   # first deploy only
docker compose up -d
```

### 3. Verify

```bash
docker compose ps                              # all containers healthy
curl http://localhost/api/healthz              # {"status":"ok"}
```

Open `http://your-server-ip` in your browser.

---

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@eghpanel.com | admin123 | super_admin |
| admin2@eghpanel.com | admin123 | admin |
| client@example.com | client123 | client |

> Remove or change these before exposing the panel to the internet.

---

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16 (local or Docker)

### Setup

```bash
pnpm install
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, PORT in .env

pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed

# Terminal 1 — API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/egh-panel run dev
```

### Useful commands

```bash
pnpm --filter @workspace/db run push-force        # Force-push schema (needed for enum changes)
pnpm --filter @workspace/api-spec run codegen      # Regenerate API client + Zod schemas from OpenAPI spec
pnpm run typecheck                                 # Typecheck all packages
```

---

## Production Deployment (Ubuntu)

### Install Docker

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER && newgrp docker
```

### TLS / HTTPS (recommended)

Use Certbot outside Docker, or add a Caddy container as a TLS-terminating reverse proxy.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d panel.yourdomain.com
```

Then update `FRONTEND_URL=https://panel.yourdomain.com` in `.env` and restart.

---

## What Is Mocked

This is a v1 release. The following features work end-to-end in the UI but use a simulated backend:

| Feature               | Status | Notes                                               |
|-----------------------|--------|-----------------------------------------------------|
| File storage          | Mock   | In-memory per server, resets on API restart         |
| Backup files          | Mock   | DB records only, no actual file data                |
| Power actions         | Mock   | DB status update + MockProvider (no real daemon)    |
| Console output        | Mock   | Simulated strings (real WebSocket transport active) |
| Server stats          | Mock   | Random values within realistic limits               |
| Node heartbeat        | Mock   | Always returns online                               |
| Redis                 | Wired  | In docker-compose, not yet used for queue/cache     |
| Wings daemon          | Stub   | INodeProvider interface ready, not implemented      |

---

## Environment Variables

| Variable            | Required | Default            | Description                          |
|---------------------|----------|--------------------|--------------------------------------|
| `POSTGRES_PASSWORD` | Yes      | —                  | PostgreSQL password                  |
| `POSTGRES_USER`     | No       | eghpanel           | PostgreSQL username                  |
| `POSTGRES_DB`       | No       | eghpanel           | PostgreSQL database name             |
| `REDIS_PASSWORD`    | No       | changeme           | Redis password                       |
| `JWT_SECRET`        | Yes      | —                  | 64+ char random hex string           |
| `JWT_EXPIRES_IN`    | No       | 7d                 | JWT token expiry                     |
| `FRONTEND_URL`      | No       | http://localhost   | Frontend URL (for CORS)              |
| `NODE_ENV`          | No       | development        | Set to `production` in Docker        |
| `PORT`              | Yes      | —                  | API server port (set by runtime)     |
| `CORS_ORIGIN`       | No       | true (all)         | Restrict CORS to your domain         |

---

## Project Structure

```
egh-panel/
├── artifacts/
│   ├── api-server/src/
│   │   ├── providers/          — INodeProvider abstraction (mock + registry)
│   │   ├── services/           — Business logic (serverService.ts)
│   │   ├── middleware/         — errorHandler, validate, rateLimiter
│   │   ├── ws/                 — WebSocket console server
│   │   ├── cron/               — Schedule execution engine
│   │   └── routes/             — REST API route handlers
│   └── egh-panel/src/
│       ├── pages/admin/        — Admin panel pages
│       └── pages/client/       — Client panel pages
├── lib/
│   ├── db/                     — Drizzle ORM schema
│   ├── api-spec/               — OpenAPI 3 spec
│   ├── api-zod/                — Generated Zod schemas
│   └── api-client-react/       — Generated React Query hooks
├── scripts/                    — Seed + deploy scripts
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.frontend
├── nginx.conf
└── .env.example
```

---

## Security Notes

- `JWT_SECRET` **must** be set — the server refuses to start without it.
- Passwords require ≥8 chars with at least one letter and one number.
- Rate limiting is active on all endpoints (200 req/min general, 10 req/min on auth).
- `helmet` is enabled with standard HTTP security headers.
- Docker containers run on isolated internal networks.
- JWT tokens are stateless — to add token invalidation, implement a Redis blocklist.

---

## Roadmap

1. **WingsProvider** — Implement the `INodeProvider` interface to connect a real Pterodactyl Wings daemon
2. **Real file operations** — Wire file endpoints to the actual daemon filesystem
3. **Real console streaming** — Stream daemon WebSocket output through the EGH WS server
4. **BullMQ job queue** — Use Redis for backup/install job queuing (REDIS_URL already wired)
5. **File upload/download** — Add signed download URLs and multipart upload endpoint
6. **SFTP access** — Expose SFTP via the file manager UI
7. **Two-factor authentication** — TOTP on login
8. **Audit log export** — CSV/JSON export for super_admins

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/wings-provider`)
3. Commit your changes
4. Open a pull request

The most impactful contribution is implementing `WingsProvider`.

---

## License

MIT
