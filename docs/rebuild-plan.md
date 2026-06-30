# EGH Panel clean rebuild plan

This document is the working plan for rebuilding EGH Panel cleanly instead of continuing with the messy Replit-generated structure.

## Goal

Build a self-hosted game server management panel with a separate node daemon, keeping compatibility with Pterodactyl-style eggs where possible while making the codebase easier to understand, install, maintain, and extend.

## Rebuild approach

The rebuild should happen on the `clean-rebuild` branch first. The existing `main` branch should not be wiped until the clean version has a working install flow and can replace it safely.

## Target architecture

### Panel

- TypeScript monorepo managed with pnpm
- Backend API for users, servers, nodes, eggs, allocations, installs, and admin actions
- Frontend dashboard for admin and client use
- Postgres database
- Drizzle ORM migrations
- WebSocket or server-sent events for realtime server status updates
- Bootstrap installer for fresh Debian/Ubuntu servers

### Node daemon

- Separate `EGH-Node` project
- Installed from a panel-generated command
- Registers securely with the panel
- Sends heartbeat/status updates back to the panel
- Handles server lifecycle actions such as start, stop, restart, kill, reinstall, and log streaming
- Uses Docker for game server isolation

## First milestone: clean base

- Replace generated clutter with a clear monorepo structure
- Add a single source of truth for environment variables
- Add Docker Compose for local development
- Add Postgres service for development
- Add backend health endpoint
- Add frontend shell/dashboard layout
- Add shared TypeScript types package
- Add lint/typecheck/build scripts

## Second milestone: core panel

- Authentication
- Admin user bootstrap
- Node create/edit/list pages
- Server create/edit/list pages
- Allocation management
- Egg import/list/basic install configuration
- Server status display

## Third milestone: node integration

- Panel-generated node install command
- Node registration token flow
- Heartbeat endpoint
- Connection test
- Basic Docker server creation
- Start/stop/restart commands
- Live console/log stream

## Fourth milestone: install and production readiness

- One-line panel bootstrap script
- Production Docker Compose option
- Reverse proxy guidance
- Database migration command
- Systemd service where needed
- Backup/restore guidance
- Clear README

## Guardrails

- Do not break the existing `main` branch while rebuilding
- Keep the project self-hostable
- Keep install steps simple enough for a normal game host to follow
- Avoid overengineering before the first working panel/node loop is complete
- Prefer readable code over clever code
