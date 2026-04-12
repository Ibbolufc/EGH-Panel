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

## Deployment (Docker Compose — Ubuntu 22.04+)

Requirements: a Linux server with internet access (root or a user with `sudo`). Docker is installed automatically if it is not already present.

---

### Option A — One-command install *(recommended)*

Run this single command on your server:

```bash
curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
```

**The installer handles everything for you.** Here is exactly what happens:

| Step | What happens |
|------|-------------|
| Docker | Installs Docker + Compose automatically if not present |
| Repository | Clones the repo (or pulls latest if already cloned) |
| Existing install | Detects a previous install and offers: update in place, clean reinstall, or abort |
| Secrets | **Auto-generates** `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `JWT_SECRET` using `openssl rand` — no manual typing required |
| Defaults | Sets `POSTGRES_USER=eghpanel`, `POSTGRES_DB=eghpanel`, `NODE_ENV=production` |
| Port check | Detects if your chosen port is already in use and suggests a free alternative |
| Prompts | Asks **three questions**: public URL/IP, HTTP port, and whether to load demo accounts — all have sensible defaults, press Enter to accept |
| Confirmation | Shows a summary of chosen settings before starting the build |
| Build | Builds Docker images, runs schema migrations, optionally seeds demo data, starts all services |
| Verification | Checks each container status and pings the API health endpoint |
| Summary | Prints the panel URL, key commands, and saves `egh-install-info.txt` |

**Re-run safe** — existing `.env` secrets are preserved; you are asked before overwriting data.

**First build takes 5–15 minutes** on a fresh VPS. Subsequent builds are fast.

**After install finishes**, open the URL it prints — you will be taken to the first-run setup page to create your administrator account (see [First-Time Setup](#first-time-setup) below).

**`egh-install-info.txt`** is saved in the install directory with your panel URL, port, and all maintenance commands in one place.

---

#### Non-interactive mode (CI / automation)

Skip all prompts by passing flags or environment variables:

```bash
# Using flags
bash scripts/bootstrap.sh --non-interactive --url http://203.0.113.10 --port 8080 --no-seed

# Using environment variables (useful when piping from curl)
EGH_URL=http://203.0.113.10 EGH_PORT=8080 EGH_SEED=no EGH_NON_INTERACTIVE=1 \
  curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
```

| Flag | Env var | Description |
|------|---------|-------------|
| `--non-interactive` | `EGH_NON_INTERACTIVE=1` | Skip all prompts, use defaults / overrides |
| `--url <URL>` | `EGH_URL=http://...` | Public URL or IP |
| `--port <PORT>` | `EGH_PORT=80` | HTTP port nginx binds on the host |
| `--seed` | `EGH_SEED=yes` | Load demo accounts |
| `--no-seed` | `EGH_SEED=no` | Skip demo data |
| `--clean` | `EGH_CLEAN=1` | Wipe existing containers and volumes first |

---

#### Existing reverse proxy / port 80 already in use

If you already have Nginx, Caddy, or another web server on port 80, the installer will detect this and suggest a free alternative port (e.g. `8080`). Choose that port, then point your existing reverse proxy at `http://localhost:8080`. The installer also shows this if you dismiss the suggestion.

---

#### To update later

```bash
cd EGH-Panel
git pull && bash scripts/update.sh
```

---

### Option B — Manual install *(if you prefer full control)*

#### Prerequisites

```bash
# Install Docker if not already installed
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker
docker compose version  # must print v2.x
```

#### 1 — Clone the repository

```bash
git clone https://github.com/Ibbolufc/EGH-Panel.git
cd EGH-Panel
```

#### 2 — Create .env

```bash
cp .env.example .env
```

The install script auto-generates all secrets, so you only need to set:

```env
FRONTEND_URL=http://your-server-ip-or-domain
HTTP_PORT=80
```

Full variable reference:

| Variable            | Auto-generated? | Default                  | Description                              |
|---------------------|-----------------|--------------------------|------------------------------------------|
| `POSTGRES_PASSWORD` | **Yes**         | *(random 40-char hex)*   | PostgreSQL password                      |
| `REDIS_PASSWORD`    | **Yes**         | *(random 40-char hex)*   | Redis password                           |
| `JWT_SECRET`        | **Yes**         | *(random 128-char hex)*  | JWT signing secret (512-bit entropy)     |
| `POSTGRES_USER`     | Yes (default)   | `eghpanel`               | PostgreSQL username                      |
| `POSTGRES_DB`       | Yes (default)   | `eghpanel`               | PostgreSQL database name                 |
| `FRONTEND_URL`      | No              | `http://localhost`       | Your public URL (used for CORS headers)  |
| `HTTP_PORT`         | No              | `80`                     | Host port nginx listens on               |

#### 3 — Run the install script

```bash
chmod +x scripts/install.sh scripts/update.sh scripts/seed.sh
./scripts/install.sh [--seed | --no-seed]
```

The script auto-generates any missing secrets, builds Docker images (5–15 min first run), starts postgres, runs schema migrations, optionally seeds demo data, starts all services, and waits up to 90 s for the API health check. If any step fails it prints the exact recovery command to run.

#### 4 — Verify

```bash
docker compose ps
curl http://localhost/api/healthz
# → {"status":"ok","uptime":...}
```

Open `http://your-server-ip` in a browser — on a fresh install you will be taken to the setup page (see [First-Time Setup](#first-time-setup) below).

#### Troubleshooting

| Problem | Command |
|---------|---------|
| A service won't start | `docker compose logs <service>` |
| Migrations failed | `docker compose logs tools` |
| API not healthy | `docker compose logs api` |
| Port already in use | Change `HTTP_PORT` in `.env` → `docker compose up -d` |
| Start fresh | `docker compose down -v && bash scripts/bootstrap.sh --clean` |

---

## First-Time Setup

On a fresh install with **no existing user accounts**, EGH Panel automatically shows a setup page instead of the normal login screen. This is the recommended and secure way to create your first administrator account.

**What happens:**

1. Open the panel URL in your browser.
2. The setup page appears — enter your name, username, email, and a strong password (12+ characters, mixed case, at least one number).
3. Click **Create Administrator Account**.
4. You are immediately logged in as `super_admin` and taken to the admin dashboard.
5. The setup page is permanently disabled — it returns `403` from that point on and the frontend never shows it again.

**Password requirements enforced on the form and server:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Security design:**
- The `POST /api/setup/complete` endpoint verifies zero users exist before creating the account, even under concurrent requests — no race condition.
- The same strict rate-limit that protects `/api/auth/login` is applied to the setup endpoint.
- Once any user account exists, `GET /api/setup/status` returns `{ "setupRequired": false }` and the frontend redirects all `/setup` visits to `/login`.

---

## Demo Accounts

The seed script creates sample accounts for **local development and testing only**. Do not use these on a production server.

| Email                  | Password  | Role        |
|------------------------|-----------|-------------|
| admin@eghpanel.com     | admin123  | super_admin |
| admin2@eghpanel.com    | admin123  | admin       |
| client@example.com     | client123 | client      |

Running the seed also disables the setup page (because user rows now exist). On a production install, **do not seed** — use the setup page instead:

```bash
./scripts/install.sh --no-seed
```

Demo data is never loaded automatically. It is only loaded when you explicitly run the seed or pass `--seed` to the install script.

---

## Updating (after git pull)

```bash
git pull
./scripts/update.sh
```

What it does:
1. Rebuilds only the images that changed (`docker compose build --parallel`)
2. Runs migrations via the tools container (idempotent — safe to run repeatedly)
3. Restarts services with `docker compose up -d --remove-orphans`

It does **not** seed data. Running `update.sh` on a live panel is safe.

---

## Seeding / Reseeding Demo Data

The seed is idempotent (`onConflictDoNothing` on every insert). It is safe to run on an existing database — it will not duplicate rows.

```bash
./scripts/seed.sh
```

The script prompts for confirmation before running. To run unattended (e.g. in a pipeline) respond with `y` or pipe it:

```bash
echo y | ./scripts/seed.sh
```

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

## What Each Script Does

The helper scripts are thin wrappers. This is exactly what they run — no hidden behaviour:

### install.sh (first-time only)

```bash
# 1. Validate .env (exits if POSTGRES_PASSWORD or JWT_SECRET are missing/default)

# 2. Build all Docker images
docker compose build --parallel

# 3. Start postgres and wait for it to be ready
docker compose up -d postgres
until docker compose exec -T postgres pg_isready ...; do sleep 1; done

# 4. Run migrations via the tools container
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force

# 5. Optionally seed demo data
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/scripts run seed

# 6. Start all services
docker compose up -d --remove-orphans
```

### update.sh (after git pull)

```bash
# 1. Rebuild changed images
docker compose build --parallel

# 2. Run migrations (idempotent — safe on every update)
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force

# 3. Restart services
docker compose up -d --remove-orphans
```

### seed.sh

```bash
# Runs the tools container with:
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/scripts run seed
```

### Common docker compose commands

```bash
docker compose logs -f api        # stream API logs
docker compose logs -f frontend   # stream frontend/nginx logs
docker compose ps                 # show container status + health
docker compose down               # stop and remove containers (data volumes kept)
docker compose down -v            # stop and remove everything including volumes (destructive)
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `docker compose build` fails on pnpm install | Stale or mismatched lockfile | Run `pnpm install` locally and commit updated `pnpm-lock.yaml` |
| API container restarts immediately | `JWT_SECRET` not set in `.env` | Set it: `openssl rand -hex 64` |
| CORS errors in browser | `FRONTEND_URL` doesn't match actual domain | Update `FRONTEND_URL` in `.env`, rebuild frontend: `docker compose build frontend && docker compose up -d` |
| Migration fails | Tables already exist with different schema | Usually safe to retry. For destructive changes: `docker compose down -v` wipes data — use carefully |
| Port 80 already in use | Another service on the host | Change `HTTP_PORT=8080` in `.env` and re-run `docker compose up -d` |

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
