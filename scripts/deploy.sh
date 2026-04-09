#!/usr/bin/env bash
# EGH Panel — Production Deploy Script (Ubuntu)
# Run as a non-root user with sudo access.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log() { echo -e "${GREEN}[EGH]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
die() { echo -e "${RED}[ERR]${NC} $1" >&2; exit 1; }

[[ -f .env ]] || die ".env file not found. Copy .env.example to .env and fill in values."

log "Pulling latest images..."
docker compose pull --quiet

log "Building application..."
docker compose build --parallel

log "Running database migrations..."
docker compose run --rm api pnpm --filter @workspace/db run push-force

log "Starting services..."
docker compose up -d --remove-orphans

log "Waiting for health checks..."
sleep 10
docker compose ps

log "Done! EGH Panel is running."
