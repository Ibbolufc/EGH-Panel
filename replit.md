# EGH Panel — Easy Game Host Panel

## Overview

**EGH Panel** is a self-hosted game server management panel that uses a custom node agent called **EGH Node**.  
Built as a pnpm monorepo with TypeScript throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Package manager**: pnpm
- **API framework**: Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Realtime**: WebSocket (`ws`)
- **Validation**: Zod
- **Frontend**: React + Vite + Tailwind + shadcn/ui
- **Deployment**: Docker Compose

## Architecture

### Panel
The panel is responsible for:

- authentication
- users
- servers
- nodes
- eggs and nests
- install script generation
- heartbeat endpoints
- node connectivity testing

### Node
The node runtime is handled by **EGH Node**, a custom daemon in the separate `EGH-Node` repository.

The panel provides:

- `GET /api/download/egh-node`
- `GET /api/nodes/:id/install.sh?token=...`

The generated install script:

- downloads the pinned EGH Node release
- writes `/etc/egh-node/config.yml`
- writes the `egh-node.service` systemd unit
- enables and starts the service
- connects the node back to the panel with heartbeat

## Repositories

- **EGH Panel** — this repository
- **EGH Node** — `Ibbolufc/EGH-Node`

## Current working install flow

### Panel install
On a fresh server:

```bash
curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
