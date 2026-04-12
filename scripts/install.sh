#!/usr/bin/env bash
# =============================================================================
# EGH Panel — Core Install Script
#
# Normally called by scripts/bootstrap.sh.  Can also be run directly:
#
#   chmod +x scripts/install.sh
#   ./scripts/install.sh [--seed | --no-seed]
#
# When run directly without a pre-configured .env, secrets are
# auto-generated rather than failing.
#
# For updates use:   scripts/update.sh
# To reseed data:    scripts/seed.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log()    { echo -e "${GREEN}[install]${NC} $1"; }
info()   { echo -e "${CYAN}[install]${NC} $1"; }
warn()   { echo -e "${YELLOW}[install]${NC} $1"; }
die()    { echo -e "\n${RED}[install] FAILED:${NC} $1" >&2; shift || true; exit 1; }
bullet() { echo -e "  ${CYAN}•${NC} $1"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; }

# ── Trap unexpected errors ────────────────────────────────────────────────────
# Gives an actionable message instead of a bare "exit 1"
trap '_handle_error ${LINENO}' ERR

_handle_error() {
  local line="${1:-}"
  echo "" >&2
  echo -e "${RED}[install] Unexpected error at line ${line}.${NC}" >&2
  echo -e "${DIM}Useful recovery commands:${NC}" >&2
  echo -e "  docker compose logs --tail=50" >&2
  echo -e "  docker compose logs api" >&2
  echo -e "  bash scripts/install.sh" >&2
}

SEED_FLAG=""
for arg in "$@"; do
  case "${arg}" in
    --seed)    SEED_FLAG="yes" ;;
    --no-seed) SEED_FLAG="no"  ;;
  esac
done

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 \
  || die "docker not found." "Install Docker: curl -fsSL https://get.docker.com | bash"

docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 not found." "Upgrade Docker to ≥ 24: https://docs.docker.com/compose/install/"

# ── Ensure .env exists ────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    warn ".env created from .env.example"
  else
    die ".env not found and .env.example is missing." "Re-clone the repository."
  fi
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
get_env_var() {
  grep -m1 "^${1}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '\r' || true
}

is_placeholder() {
  [[ -z "${1}" ]] || [[ "${1}" == CHANGE_ME* ]]
}

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
# bootstrap.sh normally does this earlier; this path handles direct invocation.
_GENERATED=()

_PG_PASS="$(get_env_var POSTGRES_PASSWORD)"
if is_placeholder "${_PG_PASS}"; then
  _PG_PASS="$(gen_hex 20)"; set_env_var "POSTGRES_PASSWORD" "${_PG_PASS}"
  _GENERATED+=("POSTGRES_PASSWORD")
fi

_REDIS_PASS="$(get_env_var REDIS_PASSWORD)"
if is_placeholder "${_REDIS_PASS}"; then
  _REDIS_PASS="$(gen_hex 20)"; set_env_var "REDIS_PASSWORD" "${_REDIS_PASS}"
  _GENERATED+=("REDIS_PASSWORD")
fi

_JWT="$(get_env_var JWT_SECRET)"
if is_placeholder "${_JWT}"; then
  _JWT="$(gen_hex 64)"; set_env_var "JWT_SECRET" "${_JWT}"
  _GENERATED+=("JWT_SECRET")
fi

[[ -z "$(get_env_var POSTGRES_USER)" ]] && set_env_var "POSTGRES_USER" "eghpanel"
[[ -z "$(get_env_var POSTGRES_DB)"   ]] && set_env_var "POSTGRES_DB"   "eghpanel"

if [[ ${#_GENERATED[@]} -gt 0 ]]; then
  warn "Auto-generated missing secrets (saved to .env):"
  for v in "${_GENERATED[@]}"; do bullet "${v}"; done
  echo ""
fi

# ── Reload the now-complete .env ──────────────────────────────────────────────
# shellcheck disable=SC1091
set -a; source .env; set +a

# ── Build Docker images ───────────────────────────────────────────────────────
log "Building Docker images (first run: 5–15 min) ..."
if ! docker compose build --parallel; then
  die "Docker build failed." \
      "Check disk space (df -h) and try again: docker compose build --parallel"
fi
log "Build complete."

# ── Start Postgres ────────────────────────────────────────────────────────────
log "Starting postgres ..."
docker compose up -d postgres

log "Waiting for postgres to accept connections ..."
_PG_WAIT=0
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-eghpanel}" >/dev/null 2>&1; do
  sleep 2
  _PG_WAIT=$((_PG_WAIT + 2))
  if [[ "${_PG_WAIT}" -ge 60 ]]; then
    die "Postgres did not become ready within 60 s." \
        "Check logs: docker compose logs postgres"
  fi
done
ok "Postgres ready"

# ── Run database schema migrations ───────────────────────────────────────────
log "Running database schema migrations ..."
if ! docker compose --profile tools run --rm tools \
       pnpm --filter @workspace/db run push-force; then
  die "Database migration failed." \
      "Check logs: docker compose logs"
fi
ok "Schema migrations applied"

# ── Seed demo data ────────────────────────────────────────────────────────────
if [[ "${SEED_FLAG}" == "yes" ]]; then
  log "Seeding demo accounts ..."
  if ! docker compose --profile tools run --rm tools \
         pnpm --filter @workspace/scripts run seed; then
    warn "Seed step failed (not fatal). Try manually: bash scripts/seed.sh"
  else
    ok "Demo accounts seeded"
  fi
elif [[ "${SEED_FLAG}" == "no" ]]; then
  info "Skipping demo seed (--no-seed)."
else
  echo ""
  read -r -p "  Load demo accounts? (sample admin + client users) [y/N]: " reply
  echo ""
  if [[ "${reply}" =~ ^[Yy]$ ]]; then
    log "Seeding demo accounts ..."
    docker compose --profile tools run --rm tools \
      pnpm --filter @workspace/scripts run seed \
      && ok "Demo accounts seeded" \
      || warn "Seed step failed. Try manually: bash scripts/seed.sh"
  else
    info "Skipping demo seed. Re-run later with: bash scripts/seed.sh"
  fi
fi

# ── Start all services ────────────────────────────────────────────────────────
log "Starting all services ..."
docker compose up -d --remove-orphans

# ── Wait for API health ────────────────────────────────────────────────────────
log "Waiting for API to become healthy (up to 90 s) ..."
_API_OK=false
for _i in $(seq 1 18); do
  _status=$(docker compose ps --format '{{.Health}}' api 2>/dev/null | head -1 || true)
  if [[ "${_status}" == "healthy" ]]; then
    _API_OK=true
    break
  fi
  # Also accept a direct HTTP response (covers the case before healthcheck kicks in)
  _PORT="${HTTP_PORT:-80}"
  if curl -sf "http://localhost:${_PORT}/api/healthz" >/dev/null 2>&1; then
    _API_OK=true
    break
  fi
  sleep 5
done

echo ""
docker compose ps
echo ""

if [[ "${_API_OK}" == "true" ]]; then
  ok "API is healthy"
else
  warn "API did not reach healthy state within 90 s."
  warn "It may still be starting up. Check with:"
  bullet "docker compose logs api"
  bullet "curl http://localhost:${HTTP_PORT:-80}/api/healthz"
fi
