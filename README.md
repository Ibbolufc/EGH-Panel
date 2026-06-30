# EGH Panel

EGH Panel is a clean, self-hosted game server management panel with a separate node daemon called **EGH Node**.

This branch is the clean rebuild. The old Replit-generated structure is being replaced carefully on `clean-rebuild` before anything replaces `main`.

## Current rebuild status

The first foundation is now in place:

- pnpm workspace
- TypeScript base config
- Express API app
- React/Vite dashboard shell
- Shared API types package
- Config/env validation package
- Drizzle/Postgres database package
- Local Postgres Docker Compose file
- API health, nodes, and servers placeholder routes

## Repository layout

```text
EGH-Panel/
  apps/
    api/          Express API
    web/          React/Vite dashboard
  packages/
    config/       Environment parsing and validation
    database/     Drizzle schema and database connection helper
    shared/       Shared API schemas and TypeScript types
  docs/           Planning and implementation notes
  docker-compose.dev.yml
  pnpm-workspace.yaml
```

## Local development

Copy the environment template:

```bash
cp .env.example .env
```

Start Postgres:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Install dependencies:

```bash
pnpm install
```

Run the API and web dashboard:

```bash
pnpm dev
```

Then open:

```text
http://localhost:5173
```

The API health endpoint is available at:

```text
http://localhost:4000/health
```

## Next milestone

The next milestone is to replace the placeholder data with real database-backed nodes and servers, then add the first node registration flow for `EGH-Node`.

## Related repository

- **EGH Node:** `Ibbolufc/EGH-Node`
