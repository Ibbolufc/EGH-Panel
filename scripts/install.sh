#!/usr/bin/env bash
# =============================================================================
# EGH Panel — First-Time Install
#
# Normally called by scripts/bootstrap.sh, which handles secret generation
# and user prompts before calling this script.  Can also be run directly:
#
#   chmod +x scripts/install.sh
#   ./scripts/install.sh [--seed | --no-seed]
#
# When run directly without a pre-configured .env, this script auto-generates
# POSTGRES_PASSWORD, REDIS_PASSWORD, and JWT_SECRET rather than failing.
#
# For subsequent updates use:  scripts/update.sh
# To seed/reseed demo data:    scripts/seed.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()    { echo -e "${GREEN}[install]${NC} $1"; }
info()   { echo -e "${CYAN}[install]${NC} $1"; }
warn()   { echo -e "${YELLOW}[install]${NC} $1"; }
die()    { echo -e "${RED}[install]${NC} $1" >&2; exit 1; }
bullet() { echo -e "  ${CYAN}•${NC} $1"; }

SEED_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --seed)    SEED_FLAG="yes" ;;
    --no-seed) SEED_FLAG="no"  ;;
  esac
done

# ── Prerequisites ──────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 \
  || die "docker not found. Install Docker: curl -fsSL https://get.docker.com | bash"
docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 not found. Upgrade Docker to ≥ 24."

# ── Ensure .env exists ─────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    warn ".env created from .env.example"
  else
    die ".env not found and .env.example is missing."
  fi
fi

# ── Helper: read a key from .env ───────────────────────────────────────────────
get_env_var() {
  grep -m1 "^${1}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '\r' || true
}

# ── Helper: true when value is empty or a CHANGE_ME placeholder ───────────────
is_placeholder() {
  [[ -z "${1}" ]] || [[ "${1}" == CHANGE_ME* ]]
}

# ── Helper: replace or append KEY=VALUE in .env ────────────────────────────────
set_env_var() {
  local key="$1" val="$2" tmpfile found=0
  tmpfile=$(mktemp)
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${line}" == "${key}"=* ]]; then
      printf '%s=%s\n' "${key}" "${val}"; found=1
    else
      printf '%s\n' "${line}"
    fi
  done < .env > "${tmpfile}"
  [[ "${found}" -eq 1 ]] || printf '%s=%s\n' "${key}" "${val}" >> "${tmpfile}"
  mv "${tmpfile}" .env
}

# ── Helper: generate N bytes of random hex ─────────────────────────────────────
gen_hex() {
  local n="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${n}"
  elif command -v xxd >/dev/null 2>&1; then
    xxd -l "${n}" -p /dev/urandom | tr -d '\n'
  else
    od -A n -t x1 -N "${n}" /dev/urandom | tr -d ' \n'
  fi
}

# ── Auto-generate any missing/placeholder secrets ─────────────────────────────
# (bootstrap.sh normally does this before calling us; this is the standalone path)
_GENERATED=()

_PG_PASS="$(get_env_var POSTGRES_PASSWORD)"
if is_placeholder "${_PG_PASS}"; then
  _PG_PASS="$(gen_hex 20)"
  set_env_var "POSTGRES_PASSWORD" "${_PG_PASS}"
  _GENERATED+=("POSTGRES_PASSWORD")
fi

_REDIS_PASS="$(get_env_var REDIS_PASSWORD)"
if is_placeholder "${_REDIS_PASS}"; then
  _REDIS_PASS="$(gen_hex 20)"
  set_env_var "REDIS_PASSWORD" "${_REDIS_PASS}"
  _GENERATED+=("REDIS_PASSWORD")
fi

_JWT="$(get_env_var JWT_SECRET)"
if is_placeholder "${_JWT}"; then
  _JWT="$(gen_hex 64)"
  set_env_var "JWT_SECRET" "${_JWT}"
  _GENERATED+=("JWT_SECRET")
fi

[[ -z "$(get_env_var POSTGRES_USER)" ]] && set_env_var "POSTGRES_USER" "eghpanel"
[[ -z "$(get_env_var POSTGRES_DB)"   ]] && set_env_var "POSTGRES_DB"   "eghpanel"

if [[ ${#_GENERATED[@]} -gt 0 ]]; then
  warn "Auto-generated missing secrets (saved to .env):"
  for v in "${_GENERATED[@]}"; do bullet "${v}"; done
  echo ""
fi

# ── Reload the now-complete .env ───────────────────────────────────────────────
# shellcheck disable=SC1091
set -a; source .env; set +a

# ── Build ──────────────────────────────────────────────────────────────────────
log "Building Docker images (first run takes 5–15 minutes)..."
docker compose build --parallel

# ── Start Postgres ─────────────────────────────────────────────────────────────
log "Starting postgres..."
docker compose up -d postgres

log "Waiting for postgres to be ready..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-eghpanel}" >/dev/null 2>&1; do
  sleep 1
done
log "Postgres ready."

# ── Migrate ────────────────────────────────────────────────────────────────────
log "Running database migrations..."
docker compose --profile tools run --rm tools \
  pnpm --filter @workspace/db run push-force
log "Migrations complete."

# ── Seed ───────────────────────────────────────────────────────────────────────
if [[ "${SEED_FLAG}" == "yes" ]]; then
  log "Seeding demo data..."
  docker compose --profile tools run --rm tools \
    pnpm --filter @workspace/scripts run seed
elif [[ "${SEED_FLAG}" == "no" ]]; then
  info "Skipping seed (--no-seed)."
else
  echo ""
  read -r -p "  Load demo data? (admin/client sample accounts) [y/N] " reply
  echo ""
  if [[ "${reply}" =~ ^[Yy]$ ]]; then
    log "Seeding demo data..."
    docker compose --profile tools run --rm tools \
      pnpm --filter @workspace/scripts run seed
  else
    info "Skipping demo seed. Run later with: ./scripts/seed.sh"
  fi
fi

# ── Start all services ─────────────────────────────────────────────────────────
log "Starting all services..."
docker compose up -d --remove-orphans

# ── Wait for API health ────────────────────────────────────────────────────────
log "Waiting for API to become healthy (up to 90s)..."
for i in $(seq 1 18); do
  status=$(docker compose ps --format json api 2>/dev/null \
    | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || true)
  if [[ "${status}" == "healthy" ]]; then
    break
  fi
  sleep 5
done

echo ""
docker compose ps
echo ""

_PORT="${HTTP_PORT:-80}"
if curl -sf "http://localhost:${_PORT}/api/healthz" >/dev/null 2>&1; then
  log "Install complete — panel is healthy."
else
  warn "Health check at http://localhost:${_PORT}/api/healthz did not respond."
  warn "Services may still be initialising. Check with: docker compose logs api"
fi
info "Panel:  http://localhost (or your server IP / domain)"
info "Health: curl http://localhost:${_PORT}/api/healthz"
