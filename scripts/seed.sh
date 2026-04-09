#!/usr/bin/env bash
# =============================================================================
# EGH Panel — Seed Demo Data
#
# Loads demo accounts, nests, eggs, nodes, allocations, and a sample server.
# The seed is idempotent — safe to re-run on an existing database.
#
# Demo accounts created:
#   admin@eghpanel.com  / admin123  (super_admin)
#   admin2@eghpanel.com / admin123  (admin)
#   client@example.com  / client123 (client)
#
# WARNING: Do NOT run in production unless you want demo credentials in your DB.
#
# Usage:
#   ./scripts/seed.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[seed]${NC} $1"; }
warn() { echo -e "${YELLOW}[seed]${NC} $1"; }
die()  { echo -e "${RED}[seed]${NC} $1" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not found."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found."
[[ -f .env ]] || die ".env not found."

warn "This will insert demo accounts and sample data into the database."
read -r -p "  Continue? [y/N] " reply
echo ""
[[ "$reply" =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }

log "Starting postgres if not running..."
docker compose up -d postgres

log "Waiting for postgres..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-eghpanel}" >/dev/null 2>&1; do
  sleep 1
done

log "Running seed..."
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/scripts run seed

log "Seed complete."
log "Login at: ${FRONTEND_URL:-http://localhost}"
