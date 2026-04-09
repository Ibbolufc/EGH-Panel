#!/usr/bin/env bash
# =============================================================================
# EGH Panel — Update / Redeploy
#
# Run after `git pull` to rebuild changed images, apply any new migrations,
# and restart services with zero-downtime container replacement.
#
# Does NOT seed demo data. For seeding run: scripts/seed.sh
#
# Usage:
#   ./scripts/update.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[update]${NC} $1"; }
info() { echo -e "${CYAN}[update]${NC} $1"; }
die()  { echo -e "${RED}[update]${NC} $1" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not found."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found."
[[ -f .env ]] || die ".env not found. Run ./scripts/install.sh first."

log "Rebuilding changed images..."
docker compose build --parallel

log "Running database migrations..."
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force

log "Restarting services..."
docker compose up -d --remove-orphans

log "Waiting for health checks..."
sleep 10
docker compose ps

log "Update complete."
info "Panel: ${FRONTEND_URL:-http://localhost}"
