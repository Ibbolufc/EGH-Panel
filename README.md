# EGH Panel

A self-hosted, dark-themed game server hosting control panel with Pterodactyl egg compatibility. Manage game servers, users, nodes, and schedules from a polished admin and client interface — fully containerised for deployment on any Linux server.

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

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Frontend      | React 19 + Vite 7 + TypeScript                |
| Backend       | Express 5 + TypeScript (ESM)                  |
| Database      | PostgreSQL 16 + Drizzle ORM                   |
| Realtime      | WebSocket (`ws` library)                      |
| Scheduling    | node-cron                                     |
| Auth          | JWT (jsonwebtoken + bcryptjs)                 |
| API Spec      | OpenAPI 3 + Orval codegen                     |
| Deployment    | Docker Compose + nginx (HTTP) + node:22-alpine|

---

## Architecture

```
nginx (:80)
  ├── /api/*  →  api-server (Express 5, port 8080)
  ├── /ws     →  api-server (WebSocket console)
  └── /*      →  egh-panel  (React SPA via nginx static)

PostgreSQL 16  — primary database
Redis 7        — reserved for future queue/cache use
```

### HTTPS

EGH Panel serves HTTP only from the nginx container. TLS is handled by an external reverse proxy placed in front of the stack (see [HTTPS Setup](#https-setup) below).

### Provider abstraction

All game server operations go through the `INodeProvider` interface. The current implementation is `MockProvider` (in-memory simulation). To connect a real Pterodactyl Wings daemon:

1. Implement `INodeProvider` in `artifacts/api-server/src/providers/wings.ts`
2. Register it in `artifacts/api-server/src/providers/registry.ts`

No route changes needed.

### WebSocket Console

Connect to `ws://HOST/ws?token=JWT&serverId=N`.

Server → Client: `console`, `status`, `stats`, `auth_error`, `not_found`
Client → Server: `send_command`, `set_state`

---

## Quickstart (Docker Compose — Ubuntu 22.04+)

### Prerequisites

- Docker 24+ and Docker Compose v2
- A non-root user with Docker access

```bash
# Install Docker (skip if already installed)
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER && newgrp docker
```

### 1. Clone and configure

```bash
git clone https://github.com/Ibbolufc/EGH-Panel.git
cd EGH-Panel
cp .env.example .env
```

Edit `.env`:

| Variable            | Required | Notes                                |
|---------------------|----------|--------------------------------------|
| `POSTGRES_PASSWORD` | **Yes**  | Choose a strong password             |
| `JWT_SECRET`        | **Yes**  | `openssl rand -hex 64`               |
| `REDIS_PASSWORD`    | No       | Defaults to `changeme`               |
| `FRONTEND_URL`      | No       | Defaults to `http://localhost`       |
| `HTTP_PORT`         | No       | Host port for nginx (default `80`)   |

### 2. First-time install

```bash
chmod +x scripts/install.sh scripts/update.sh scripts/seed.sh scripts/deploy.sh
./scripts/install.sh
```

The script will:
1. Validate your `.env`
2. Build all Docker images
3. Start PostgreSQL and run migrations
4. Ask whether to load demo data
5. Start all services

To skip the interactive prompt:

```bash
./scripts/install.sh --seed     # install + seed demo data
./scripts/install.sh --no-seed  # install without seeding
```

### 3. Verify

```bash
docker compose ps                  # all services should show "healthy" or "running"
curl http://localhost/api/healthz  # → {"status":"ok","uptime":...}
```

Open `http://your-server-ip` in a browser.

---

## Demo Accounts

Created by `scripts/seed.sh`. Remove or change them before exposing the panel to the internet.

| Email                  | Password  | Role        |
|------------------------|-----------|-------------|
| admin@eghpanel.com     | admin123  | super_admin |
| admin2@eghpanel.com    | admin123  | admin       |
| client@example.com     | client123 | client      |

---

## Update / Redeploy

After `git pull`:

```bash
./scripts/update.sh
```

This rebuilds changed images, runs any new migrations, and restarts services. It does **not** reseed data.

---

## Seed Demo Data

The seed is idempotent (uses `onConflictDoNothing`). Safe to run on an existing database.

```bash
./scripts/seed.sh
```

To skip in production — just don't run the seed script. There is no seed that runs automatically.

---

## HTTPS Setup

EGH Panel does not handle TLS internally. Place a reverse proxy in front of the nginx container.

**Option A — Caddy (recommended, auto-HTTPS)**

```bash
# Install Caddy on the host
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install caddy

# /etc/caddy/Caddyfile
panel.yourdomain.com {
    reverse_proxy localhost:80
}

sudo systemctl reload caddy
```

**Option B — Certbot standalone**

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d panel.yourdomain.com
# Then configure host-level nginx or Apache to proxy to localhost:80
```

After enabling HTTPS, update `.env`:

```env
FRONTEND_URL=https://panel.yourdomain.com
```

Then rebuild the frontend image (it bakes `FRONTEND_URL` into CORS config):

```bash
docker compose build frontend
docker compose up -d frontend api
```

---

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@10.6.5 --activate`)
- PostgreSQL 16 (local or `docker compose up -d postgres`)

### Setup

```bash
pnpm install

# Set DATABASE_URL, JWT_SECRET in .env (or export them directly)
export DATABASE_URL="postgresql://eghpanel:yourpassword@localhost:5432/eghpanel"
export JWT_SECRET="$(openssl rand -hex 64)"

# Push schema
pnpm --filter @workspace/db run push

# Seed demo data (optional)
pnpm --filter @workspace/scripts run seed

# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port provided by runtime)
pnpm --filter @workspace/egh-panel run dev
```

### Useful commands

```bash
# Force-push schema (needed after enum changes)
pnpm --filter @workspace/db run push-force

# Regenerate API client + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Type-check all packages
pnpm run typecheck
```

---

## Manual Docker Commands

If you prefer not to use the helper scripts:

```bash
# Build all images (including the tools image for migrate/seed)
docker compose build --parallel

# Start postgres only
docker compose up -d postgres

# Run migrations (via the tools container)
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force

# Seed demo data (via the tools container)
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/scripts run seed

# Start all services
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f frontend

# Stop everything
docker compose down
```

---

## What Is Mocked

This is a v1 release. The following features have complete UI but use a simulated backend:

| Feature            | Status  | Notes                                                    |
|--------------------|---------|----------------------------------------------------------|
| Console output     | **Mock**| Simulated strings over a real WebSocket transport        |
| Server stats       | **Mock**| Random CPU/memory/disk values within realistic limits    |
| Power actions      | **Mock**| DB status update only, no real daemon call               |
| File storage       | **Mock**| In-memory per server, resets on API restart              |
| Backup files       | **Mock**| DB records only, no actual file data stored              |
| Node heartbeat     | **Mock**| Always returns online                                    |
| Wings daemon       | **Stub**| `INodeProvider` interface ready, not implemented         |
| Redis              | **Wired**| In docker-compose, not yet consumed by app code         |
| JWT auth           | **Real**| Full login, token validation, role gating                |
| REST API           | **Real**| All routes, validation, rate limiting, error handling    |
| Database           | **Real**| PostgreSQL with Drizzle ORM, full schema                 |
| WebSocket          | **Real**| Connection, auth, live stats frame, reconnect logic      |
| Schedules          | **Real**| node-cron runs on the API server, dispatches actions     |

---

## Environment Variables

All variables are set in `.env` (copy from `.env.example`).

| Variable            | Required | Default           | Description                           |
|---------------------|----------|-------------------|---------------------------------------|
| `POSTGRES_PASSWORD` | **Yes**  | —                 | PostgreSQL password                   |
| `POSTGRES_USER`     | No       | `eghpanel`        | PostgreSQL username                   |
| `POSTGRES_DB`       | No       | `eghpanel`        | PostgreSQL database name              |
| `REDIS_PASSWORD`    | No       | `changeme`        | Redis password                        |
| `JWT_SECRET`        | **Yes**  | —                 | ≥64-char random hex (server will not start without it) |
| `JWT_EXPIRES_IN`    | No       | `7d`              | JWT token expiry                      |
| `FRONTEND_URL`      | No       | `http://localhost`| Public URL used for CORS              |
| `HTTP_PORT`         | No       | `80`              | Host port nginx binds to              |
| `NODE_ENV`          | No       | `development`     | Set to `production` in Docker         |

---

## Project Structure

```
egh-panel/
├── artifacts/
│   ├── api-server/src/
│   │   ├── providers/      — INodeProvider abstraction (mock + registry)
│   │   ├── services/       — Business logic (serverService.ts)
│   │   ├── middleware/      — errorHandler, validate, rateLimiter
│   │   ├── ws/             — WebSocket console server
│   │   ├── cron/           — Schedule execution engine
│   │   └── routes/         — REST API route handlers
│   └── egh-panel/src/
│       ├── pages/admin/    — Admin panel pages
│       └── pages/client/   — Client panel pages
├── lib/
│   ├── db/                 — Drizzle ORM schema + migrations
│   ├── api-spec/           — OpenAPI 3 specification
│   ├── api-zod/            — Generated Zod schemas
│   └── api-client-react/   — Generated React Query hooks
├── scripts/
│   ├── install.sh          — First-time install
│   ├── update.sh           — Update after git pull
│   ├── seed.sh             — Load demo data
│   ├── deploy.sh           — Wrapper (--install or update)
│   └── src/seed.ts         — Seed implementation
├── Dockerfile.api          — API production image
├── Dockerfile.frontend     — Frontend build + nginx image
├── Dockerfile.tools        — Migration + seed one-off image
├── docker-compose.yml
├── nginx.conf              — Reverse proxy (HTTP only)
└── .env.example
```

---

## Security Notes

- `JWT_SECRET` **must** be set — the server refuses to start without it.
- Passwords require ≥8 characters with at least one letter and one digit.
- Rate limiting: 200 req/min general, 10 req/min on `/auth/login`.
- `helmet` is enabled with standard HTTP security headers.
- Docker containers run on isolated internal networks; only nginx is public-facing.
- JWT tokens are stateless — for revocation, implement a Redis blocklist.
- Remove demo accounts (`./scripts/seed.sh` data) before production use.

---

## Roadmap

1. **WingsProvider** — Implement `INodeProvider` to connect a real Pterodactyl Wings daemon
2. **Real console streaming** — Proxy daemon WebSocket output through the EGH WS server
3. **Real file operations** — Wire file endpoints to the daemon filesystem
4. **BullMQ job queue** — Use Redis for backup/install job queuing (REDIS_URL already wired)
5. **Two-factor auth** — TOTP support on login
6. **Audit log export** — CSV/JSON export for super_admins
7. **SFTP access** — Expose SFTP via the file manager UI

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/wings-provider`)
3. Commit your changes
4. Open a pull request

The most impactful contribution right now is implementing `WingsProvider`.

---

## License

MIT
