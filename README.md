# EGH Panel — Easy Game Host Panel

A self-hosted, premium dark-themed game server hosting control panel compatible with Pterodactyl egg JSON files.

---

## Stack

| Layer         | Technology                         |
|---------------|-----------------------------------|
| Frontend      | React 19 + Vite 7 + TypeScript    |
| Backend       | Express 5 + TypeScript (ESM)      |
| Database      | PostgreSQL 16 + Drizzle ORM       |
| Realtime      | WebSocket (ws library)            |
| Scheduling    | node-cron                         |
| Auth          | JWT (jsonwebtoken + bcryptjs)     |
| API Spec      | OpenAPI 3 + Orval codegen         |
| Deployment    | Docker Compose + nginx            |

> **Note:** The originally specified Next.js + NestJS stack was intentionally kept as Express + Vite for the current build to maintain stability and speed. The provider abstraction layer makes migration to a NestJS backend straightforward — no route changes required, only swap the provider implementation.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                           nginx (reverse proxy)                  │
│                    :80 → API (/api, /ws) + Frontend (/)          │
└────────────────────────────┬─────────────────┬───────────────────┘
                             │                 │
                    ┌────────▼──────┐  ┌───────▼──────────┐
                    │  API Server   │  │   Frontend SPA   │
                    │  Express 5    │  │   React + Vite   │
                    │  :8080        │  │   nginx SPA      │
                    └──────┬────────┘  └──────────────────┘
                           │
              ┌────────────┼─────────────────┐
              │            │                 │
       ┌──────▼────┐ ┌─────▼─────┐ ┌────────▼───────┐
       │ PostgreSQL│ │   Redis   │ │  Node Provider │
       │  :5432    │ │  :6379    │ │  (mock/wings)  │
       └───────────┘ └───────────┘ └────────────────┘
```

### Provider Architecture

All game server operations go through the `INodeProvider` interface (`lib/providers/types.ts`).

The `MockProvider` handles all calls in-memory (realistic simulation).
To connect a real Wings-compatible daemon: implement `INodeProvider` in `src/providers/wings.ts` and register it in `registry.ts`.

### WebSocket Console

Clients connect to `ws://HOST/ws?token=JWT&serverId=N`.

Outgoing message types: `console`, `status`, `stats`, `auth_error`, `not_found`
Incoming event types: `send_command`, `set_state`

---

## What is Fully Implemented

- JWT authentication (login, logout, /me, password change, profile update)
- Role-based access control (super_admin, admin, client)
- Rate limiting on all endpoints (200 req/min general, 10/min on auth)
- Global error handler with consistent `{ error, code, fields? }` format
- Zod validation on all mutation endpoints
- User CRUD (super_admin only for role assignment)
- Node management (CRUD, allocation management)
- Nest + Egg management (CRUD + Pterodactyl JSON import with validation + preview mode)
- Server CRUD (create with egg defaults, variable seeding)
- Server power actions routed through the provider abstraction layer
- Server stats endpoint (mocked but realistic)
- File manager CRUD (list, read, write, delete, rename, mkdir) via provider
- Backup CRUD (create, delete, restore) — in-memory mock
- Schedule CRUD with cron expression validation + node-cron execution engine
- Schedule `command` action with `payload` field
- Activity logging on all key operations
- Admin dashboard stats
- WebSocket console server (auth, real-time console lines, stats streaming)
- Docker Compose (postgres, redis, api, frontend, nginx)
- Production Dockerfiles with multi-stage builds
- Health check endpoints on API and Docker containers
- `.env.example` with all required variables
- Seed data (5 nests, 8 eggs, 3 nodes, 10 allocations, 4 servers, 5 egg vars, 8 activity logs)

---

## What is Still Mocked / Scaffolded

| Feature               | Status    | Notes                                              |
|-----------------------|-----------|----------------------------------------------------|
| File manager storage  | Mock      | In-memory per server, resets on restart            |
| Backup storage        | Mock      | DB records only, no actual file backup             |
| Power actions         | Mock      | DB status update + provider call (MockProvider)    |
| Console output        | Mock      | Generated strings, no real daemon connection       |
| Server stats          | Mock      | Random values within limits                        |
| Install process       | Mock      | Status updated to `installing`, no real install    |
| Node heartbeat        | Mock      | Always returns online                              |
| Redis                 | Wired     | In docker-compose, not yet used for sessions/queue |
| Wings daemon          | Stub      | Provider interface ready, implementation pending   |

---

## Demo Accounts

| Email                   | Password  | Role         |
|-------------------------|-----------|--------------|
| admin@eghpanel.com      | admin123  | super_admin  |
| admin2@eghpanel.com     | admin123  | admin        |
| client@example.com      | client123 | client       |

---

## Local Development

### Prerequisites
- Node.js 22+
- pnpm 10+
- PostgreSQL 16

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_ORG/egh-panel.git
cd egh-panel

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

# 4. Push database schema
pnpm --filter @workspace/db run push

# 5. Seed demo data
pnpm --filter @workspace/scripts run seed

# 6. Start API server
pnpm --filter @workspace/api-server run dev

# 7. Start frontend (separate terminal)
pnpm --filter @workspace/egh-panel run dev
```

API runs on `PORT` (set in environment, default 8080).
Frontend runs on a Vite dev port.

---

## Production Deployment (Ubuntu)

### 1. Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
newgrp docker

# Install Git
sudo apt-get install -y git
```

### 2. Clone and configure

```bash
git clone https://github.com/YOUR_ORG/egh-panel.git
cd egh-panel
cp .env.example .env
nano .env   # Fill in all required values
```

Required environment variables:
- `POSTGRES_PASSWORD` — strong password for the database
- `JWT_SECRET` — generate with: `openssl rand -hex 64`
- `REDIS_PASSWORD` — strong password for Redis
- `FRONTEND_URL` — your domain or IP (e.g. `https://panel.yourdomain.com`)

### 3. Build and start

```bash
./scripts/deploy.sh
```

Or manually:

```bash
# Build
docker compose build --parallel

# Push database schema
docker compose run --rm api pnpm --filter @workspace/db run push-force

# Seed initial data (first deploy only)
docker compose run --rm api pnpm --filter @workspace/scripts run seed

# Start
docker compose up -d
```

### 4. Verify

```bash
# Check all containers are healthy
docker compose ps

# Check API health
curl http://localhost/api/health

# Check logs
docker compose logs -f api
```

### 5. TLS / HTTPS (recommended)

Use Certbot + nginx outside Docker, or add a Caddy container as a reverse proxy.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d panel.yourdomain.com
```

Then update `FRONTEND_URL=https://panel.yourdomain.com` in `.env` and restart.

---

## API Endpoints Reference

All endpoints are prefixed with `/api`.

### Auth
| Method | Path                   | Auth | Description              |
|--------|------------------------|------|--------------------------|
| POST   | /auth/login            | -    | Login, returns JWT       |
| POST   | /auth/logout           | ✓    | Logout (activity logged) |
| GET    | /auth/me               | ✓    | Get current user         |
| PATCH  | /auth/me               | ✓    | Update profile           |
| PATCH  | /auth/me/password      | ✓    | Change password          |

### WebSocket Console
Connect to: `ws://HOST/ws?token=JWT&serverId=N`

---

## Project Structure

```
egh-panel/                          # Monorepo root
├── artifacts/
│   ├── api-server/                 # Express 5 API
│   │   └── src/
│   │       ├── app.ts              # Express app (middleware, routes)
│   │       ├── index.ts            # HTTP server + WebSocket + cron
│   │       ├── providers/          # Node provider abstraction
│   │       │   ├── types.ts        # INodeProvider interface
│   │       │   ├── mock.ts         # MockProvider (current)
│   │       │   └── registry.ts     # Provider resolver
│   │       ├── services/           # Business logic
│   │       │   └── serverService.ts
│   │       ├── middleware/         # Express middleware
│   │       │   ├── errorHandler.ts # Global error handler
│   │       │   ├── rateLimiter.ts  # Rate limiting
│   │       │   └── validate.ts     # Zod validation + param parsing
│   │       ├── ws/                 # WebSocket server
│   │       │   └── consoleServer.ts
│   │       ├── cron/               # Schedule execution
│   │       │   └── scheduleRunner.ts
│   │       ├── routes/             # REST API routes
│   │       └── lib/                # Auth, logger, activity
│   └── egh-panel/                  # React + Vite frontend
│       └── src/
│           ├── pages/admin/        # Admin panel pages
│           ├── pages/client/       # Client panel pages
│           └── components/layout/  # Admin/Client layouts
├── lib/
│   ├── db/                         # Drizzle ORM + schema
│   ├── api-zod/                    # Zod validation schemas
│   ├── api-spec/                   # OpenAPI spec
│   └── api-client-react/           # Generated React Query hooks
├── scripts/                        # Seed + deploy scripts
├── docker-compose.yml              # Production Docker Compose
├── Dockerfile.api                  # API multi-stage build
├── Dockerfile.frontend             # Frontend multi-stage build
├── nginx.conf                      # nginx reverse proxy config
├── docker/nginx-spa.conf           # nginx SPA config (inside frontend)
├── .env.example                    # Environment variable reference
└── README.md
```

---

## Environment Variables

| Variable            | Required | Default        | Description                          |
|---------------------|----------|----------------|--------------------------------------|
| POSTGRES_PASSWORD   | Yes      | —              | PostgreSQL password                  |
| POSTGRES_USER       | No       | eghpanel       | PostgreSQL username                  |
| POSTGRES_DB         | No       | eghpanel       | PostgreSQL database name             |
| REDIS_PASSWORD      | No       | changeme       | Redis password                       |
| JWT_SECRET          | Yes      | —              | 64+ char random secret               |
| JWT_EXPIRES_IN      | No       | 7d             | JWT token expiry                     |
| FRONTEND_URL        | No       | http://localhost | Frontend URL for CORS/API base URL |
| NODE_ENV            | No       | development    | `production` in Docker               |
| PORT                | Yes      | —              | API server port (set by runtime)     |
| CORS_ORIGIN         | No       | true           | Allowed CORS origin                  |

---

## Next Recommended Milestones

1. **Real daemon integration** — Implement `WingsProvider` using the Pterodactyl Wings API. The `INodeProvider` interface is ready.
2. **Real file storage** — Connect provider file operations to a daemon that mounts the actual server volume.
3. **Real console streaming** — Stream actual SFTP/WebSocket output from Wings/custom daemon to the WebSocket server.
4. **Redis job queue** — Use BullMQ + Redis for backup/install jobs instead of `setTimeout`.
5. **SFTP file upload/download** — Add file upload endpoint and signed download URLs.
6. **WHMCS integration** — Billing hooks can call the server creation API with admin credentials. Provider layer is already decoupled.
7. **Next.js migration** — The frontend can be migrated page-by-page; the API client is framework-agnostic.
8. **NestJS migration** — Each route file maps cleanly to a NestJS module+controller+service. The provider interface stays identical.
9. **Two-factor authentication** — Add TOTP support on the login endpoint.
10. **Audit log export** — Allow super_admins to export activity logs as CSV/JSON.

---

## Security Notes

- JWT tokens are stateless — logout only removes the token on the client. For token invalidation, implement a Redis blocklist.
- Passwords must be ≥8 chars with at least one letter and one number.
- Rate limiting is active on all endpoints (200 req/min, 10 req/min on auth).
- `helmet` is enabled for standard HTTP security headers.
- Clients cannot access admin resources — enforced at the middleware level.
- Docker containers run on isolated internal networks.

---

## Before Pushing to GitHub

1. **Change all secrets** in `.env` — never commit real credentials.
2. Ensure `.env` is in `.gitignore` (already is, verify).
3. Generate a real `JWT_SECRET`: `openssl rand -hex 64`
4. Set `POSTGRES_PASSWORD` to a strong password.
5. Update `FRONTEND_URL` to your production domain.
6. Review `CORS_ORIGIN` — restrict it to your domain in production.
7. Remove any test/seed data from production before going live.
