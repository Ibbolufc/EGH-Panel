# EGH Panel — Easy Game Host Panel

## Overview

**EGH Panel** is a self-hosted, premium dark-themed game server hosting control panel compatible with Pterodactyl egg JSON files. Built as a pnpm monorepo with TypeScript throughout. Second-pass upgrade complete.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Package manager**: pnpm 10
- **API framework**: Express 5 + TypeScript (ESM)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Realtime**: WebSocket (ws library) — attached to HTTP server at `/ws`
- **Scheduling**: node-cron (schedule runner with 30s sync interval)
- **Validation**: Zod 4 + drizzle-zod
- **Security**: helmet, express-rate-limit, JWT (jsonwebtoken + bcryptjs)
- **Logging**: pino + pino-http
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React 19 + Vite 7 + Tailwind v4 + shadcn/ui
- **Docker**: Docker Compose (postgres, redis, api, frontend, nginx)

## Architecture

All game server operations go through the `INodeProvider` interface in `artifacts/api-server/src/providers/`:
- `types.ts` — interface definition
- `mock.ts` — MockProvider (in-memory, realistic simulation)
- `registry.ts` — resolves provider per node (swap in WingsProvider here)

WebSocket console server: `artifacts/api-server/src/ws/consoleServer.ts`
- Connect: `ws://HOST/ws?token=JWT&serverId=N`
- Outgoing: `console`, `status`, `stats`, `auth_error`
- Incoming: `send_command`, `set_state`

Schedule runner: `artifacts/api-server/src/cron/scheduleRunner.ts`
- Polls DB every 30s and registers node-cron jobs per enabled schedule
- Supports: start, stop, restart, kill, backup, command (with payload)

## Project Structure

```
artifacts/
  api-server/src/
    app.ts              — Express app (helmet, cors, rate limiting, routes)
    index.ts            — HTTP server + WebSocket + cron startup
    providers/          — INodeProvider abstraction layer
    services/           — Business logic (serverService.ts)
    middleware/         — errorHandler, validate, rateLimiter
    ws/                 — WebSocket console server
    cron/               — Schedule execution engine
    routes/             — REST API route handlers
    lib/                — auth, logger, activity helpers
  egh-panel/            — React + Vite frontend (SPA at /)
lib/
  db/                   — Drizzle ORM schema + migrations
  api-spec/             — OpenAPI spec (openapi.yaml) + Orval config
  api-client-react/     — Auto-generated React Query hooks
  api-zod/              — Auto-generated Zod schemas
scripts/
  seed.ts               — Database seeder
  deploy.sh             — Production deploy script
```

## Features

### Admin Panel
- **Dashboard** — Live stats (servers, users, nodes, eggs, status breakdowns)
- **Users** — CRUD with roles (super_admin, admin, client), active toggle; click edit icon to go to user detail page
- **User Detail** (`/admin/users/:id`) — Profile editing + assigned server list; tabs sync to URL (?tab=)
- **Servers** — Create from egg templates, manage resources, power actions; click server name to go to detail page
- **Server Detail** (`/admin/servers/:id`) — Overview (resources, assignment, metadata) + settings editor; tabs sync to URL (?tab=)
- **Nodes** — Add/remove nodes, allocation management
- **Node Detail** (`/admin/nodes/:id`) — Full node config with 5 tabs; tabs sync to URL (?tab=)
- **Eggs & Nests** — CRUD + Pterodactyl JSON import with validation + preview; click egg name to go to detail page
- **Egg Detail** (`/admin/eggs/:id`) — Docker/startup config + variable list; tabs sync to URL (?tab=)
- **Activity** — Full audit log with pagination
- **Settings** — Account and password management

### Client Panel
- **My Servers** — Overview of assigned servers with status
- **Console** — Live WebSocket console with command input + stats
- **File Manager** — Browse, read, write, delete, rename, mkdir via provider
- **Startup Variables** — Edit server environment variables
- **Backups** — Create (via provider), delete, restore with status tracking
- **Schedules** — Cron-based automation (power, backup, command actions)
- **Account** — Profile and password management

## Middleware Stack

- `helmet` — HTTP security headers
- `cors` — Configurable CORS (via CORS_ORIGIN env var)
- `pino-http` — Request/response logging
- `apiLimiter` — 200 req/min per IP
- `authLimiter` — 10 req/min per IP on login endpoint
- `validateBody(schema)` — Zod validation middleware factory
- `asyncHandler(fn)` — Wraps async routes for error propagation
- `errorHandler` — Global error handler (consistent `{ error, code }` format)
- `notFoundHandler` — 404 handler

## Authentication

- JWT tokens stored in `localStorage` as `egh_token`
- Signed with `JWT_SECRET`, expires in `JWT_EXPIRES_IN` (default 7d)
- Password validation: min 8 chars, at least one letter + one number
- Roles: `super_admin`, `admin`, `client`
- Guards: `requireAuth`, `requireAdmin`, `requireSuperAdmin`
- Route protection redirects unauthenticated users to `/login`

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@eghpanel.com | admin123 | super_admin |
| admin2@eghpanel.com | admin123 | admin |
| client@example.com | client123 | client |
| client2@example.com | client123 | client |
| client3@example.com | client123 | client |

## Key Commands

```bash
pnpm --filter @workspace/db run push              # Push DB schema changes
pnpm --filter @workspace/db run push-force        # Force push (allows enum changes)
pnpm --filter @workspace/scripts run seed         # Seed demo data
pnpm --filter @workspace/api-spec run codegen     # Regenerate API hooks + Zod schemas
pnpm --filter @workspace/api-server run dev       # API server (dev)
pnpm --filter @workspace/egh-panel run dev        # Frontend (dev)
```

## Docker Deployment

```bash
cp .env.example .env
# Fill in POSTGRES_PASSWORD, JWT_SECRET, REDIS_PASSWORD, FRONTEND_URL
docker compose build --parallel
docker compose run --rm api pnpm --filter @workspace/db run push-force
docker compose run --rm api pnpm --filter @workspace/scripts run seed  # first deploy only
docker compose up -d
```

Or use the deploy script: `./scripts/deploy.sh`

## Database Schema

Core tables: `users`, `nests`, `eggs`, `egg_variables`, `nodes`, `allocations`, `servers`, `server_variables`, `backups`, `schedules`, `activity_logs`

New columns (v2): `schedules.payload` (text, for command action), `schedule_action` enum now includes `command`

## What is Mocked / Scaffolded

| Feature | Status | Notes |
|---------|--------|-------|
| File manager | Mock | In-memory per server via MockProvider |
| Backup storage | Mock | DB records only, no real files |
| Console output | Mock | Generated strings, not real daemon |
| Power actions | Mock | DB update + MockProvider (no real daemon) |
| Server stats | Mock | Random values within limits |
| Node heartbeat | Mock | Always returns online |
| Redis | Wired | In compose, not yet used for sessions/queues |
| Wings daemon | Stub | INodeProvider interface ready, WingsProvider pending |

## Pterodactyl Egg Import

`POST /api/eggs/import` — full Pterodactyl v1 egg JSON validation + import
`POST /api/eggs/import/preview` — parse + validate without writing to DB

Supports: `name`, `description`, `docker_image`/`docker_images`, `startup`, `variables[]`, `script.install`, `nest.name`
All variable fields properly parsed: `env_variable`, `default_value`, `user_viewable`, `user_editable`, `rules`

## API Key Files

- `artifacts/api-server/src/providers/types.ts` — INodeProvider interface (add Wings here)
- `artifacts/api-server/src/providers/registry.ts` — Provider resolver (swap providers here)
- `artifacts/api-server/src/services/serverService.ts` — Server business logic
- `artifacts/api-server/src/ws/consoleServer.ts` — WebSocket console
- `artifacts/api-server/src/cron/scheduleRunner.ts` — Cron execution engine
