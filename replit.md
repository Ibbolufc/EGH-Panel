# EGH Panel — Easy Game Host Panel

## Overview

**EGH Panel** is a self-hosted, premium dark-themed game server hosting control panel compatible with Pterodactyl egg JSON files. Built as a pnpm monorepo with TypeScript throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui

## Project Structure

```
artifacts/
  api-server/       — Express 5 backend API (port 8080 dev, proxied via /api)
  egh-panel/        — React + Vite frontend (SPA at /)
lib/
  db/               — Drizzle ORM schema + migrations
  api-spec/         — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/ — Auto-generated React Query hooks from OpenAPI
```

## Features

### Admin Panel
- **Dashboard** — Live stats (servers, users, nodes, activity)
- **Users** — Create, edit, delete users with roles (super_admin, admin, client)
- **Servers** — Create and manage game servers across nodes
- **Nodes** — Add/remove infrastructure nodes
- **Eggs & Nests** — Manage game templates; import Pterodactyl egg.json files
- **Activity** — Audit log with pagination
- **Settings** — Account info and password change

### Client Panel
- **My Servers** — Overview of all assigned servers
- **Console** — Live server console with command input
- **File Manager** — Browse, navigate, delete files on game servers
- **Startup Variables** — Edit server startup environment variables
- **Backups** — Create, list, delete backups
- **Schedules** — Cron-based automation (power actions, commands, backups)
- **Account** — Profile and password management

## Authentication

- JWT tokens stored in `localStorage` as `egh_token`
- Roles: `super_admin`, `admin`, `client`
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

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/egh-panel run dev` — run frontend locally

## Docker Deployment

```bash
cp .env.example .env
# Edit .env with your secrets
docker-compose up -d
```

Access panel at `http://your-server-ip`

## Database Schema

Core tables: `users`, `nests`, `eggs`, `egg_variables`, `nodes`, `allocations`, `servers`, `server_variables`, `backups`, `schedules`, `activity_logs`

## Pterodactyl Egg Import

POST `/api/eggs/import` with `{ nestId, eggJson }` — parses Pterodactyl JSON format:
- `name`, `description`, `docker_image`/`docker_images`, `startup`, `variables`, `script.install`, `nest.name`
