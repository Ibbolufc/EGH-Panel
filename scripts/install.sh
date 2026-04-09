#!/usr/bin/env bash
# =============================================================================
# EGH Panel — First-Time Install
#
# Run this ONCE on a fresh server after cloning the repository.
# For subsequent updates use:  scripts/update.sh
# To seed/reseed demo data:    scripts/seed.sh
#
# Usage:
#   chmod +x scripts/install.sh
#   ./scripts/install.sh [--seed]
#
# Flags:
#   --seed    Automatically load demo data without prompting
#   --no-seed Skip the seed prompt entirely
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[install]${NC} $1"; }
info() { echo -e "${CYAN}[install]${NC} $1"; }
warn() { echo -e "${YELLOW}[install]${NC} $1"; }
die()  { echo -e "${RED}[install]${NC} $1" >&2; exit 1; }

SEED_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --seed)    SEED_FLAG="yes" ;;
    --no-seed) SEED_FLAG="no"  ;;
  esac
done

# ---- Prerequisites --------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker first: curl -fsSL https://get.docker.com | bash"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found."

[[ -f .env ]] || {
  if [[ -f .env.example ]]; then
    cp .env.example .env
    warn ".env created from .env.example — edit it with your values before continuing."
    warn "Required: POSTGRES_PASSWORD, JWT_SECRET"
    echo ""
    die "Fill in .env then re-run: ./scripts/install.sh"
  else
    die ".env not found and .env.example is missing."
  fi
}

# Basic sanity check on required variables
source .env 2>/dev/null || true
[[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD is not set in .env"
[[ -n "${JWT_SECRET:-}" ]]        || die "JWT_SECRET is not set in .env"
[[ "${POSTGRES_PASSWORD}" != "CHANGE_ME_STRONG_PASSWORD" ]] || die "You must change POSTGRES_PASSWORD in .env"
[[ "${JWT_SECRET}" != "CHANGE_ME_64_CHAR_RANDOM_HEX" ]]     || die "You must change JWT_SECRET in .env (run: openssl rand -hex 64)"

# ---- Build ----------------------------------------------------------------
log "Building images (this may take a few minutes)..."
docker compose build --parallel

# ---- Start Postgres -------------------------------------------------------
log "Starting postgres..."
docker compose up -d postgres

log "Waiting for postgres to be ready..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-eghpanel}" >/dev/null 2>&1; do
  sleep 1
done
log "Postgres ready."

# ---- Migrate --------------------------------------------------------------
log "Running database migrations..."
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force
log "Migrations complete."

# ---- Seed -----------------------------------------------------------------
if [[ "$SEED_FLAG" == "yes" ]]; then
  log "Seeding demo data..."
  docker compose --profile tools run --rm tools \
    pnpm --filter @workspace/scripts run seed
elif [[ "$SEED_FLAG" == "no" ]]; then
  info "Skipping seed (--no-seed)."
else
  echo ""
  read -r -p "  Load demo data? (admin/client accounts + sample servers) [y/N] " reply
  echo ""
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    log "Seeding demo data..."
    docker compose --profile tools run --rm tools \
      pnpm --filter @workspace/scripts run seed
  else
    info "Skipping demo seed. You can run it later with: ./scripts/seed.sh"
  fi
fi

# ---- Start all services ---------------------------------------------------
log "Starting all services..."
docker compose up -d --remove-orphans

log "Waiting for health checks (up to 60s)..."
for i in $(seq 1 12); do
  if docker compose ps | grep -q "healthy"; then
    break
  fi
  sleep 5
done

echo ""
docker compose ps
echo ""
log "Install complete!"
info "Panel: http://localhost (or your server IP)"
info "Health: curl http://localhost/api/healthz"
