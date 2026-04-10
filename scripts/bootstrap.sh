#!/usr/bin/env bash
# =============================================================================
# EGH Panel — One-Command Bootstrap Installer
#
# Handles first-time installation on a fresh Ubuntu/Debian/RHEL server.
# Installs Docker if needed, clones the repo, auto-generates all secrets,
# prompts only for the essentials (public URL + port), then builds and
# starts everything.
#
# One-command install (run as root or a user with sudo + docker access):
#   curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
#
# Or, if you have already cloned the repo:
#   bash scripts/bootstrap.sh
#
# For subsequent updates do NOT re-run this script.  Use instead:
#   cd EGH-Panel && git pull && bash scripts/update.sh
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()    { echo -e "${GREEN}[egh]${NC} $*"; }
info()   { echo -e "${CYAN}[egh]${NC} $*"; }
warn()   { echo -e "${YELLOW}[egh]${NC} $*"; }
die()    { echo -e "${RED}[egh]${NC} ERROR: $*" >&2; exit 1; }
bullet() { echo -e "  ${CYAN}•${NC} $*"; }
hr()     { echo -e "${CYAN}$(printf '─%.0s' $(seq 1 62))${NC}"; }

REPO_URL="https://github.com/Ibbolufc/EGH-Panel.git"
INSTALL_DIR="${EGH_INSTALL_DIR:-EGH-Panel}"

# All interactive reads come from /dev/tty so the script works when piped via
# "curl ... | bash" (stdin is the downloaded script, not the terminal).
TTY=/dev/tty

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
hr
echo -e "  ${BOLD}EGH Panel — Installer${NC}"
echo -e "  Game Server Control Panel · github.com/Ibbolufc/EGH-Panel"
hr
echo ""

# =============================================================================
# STEP 1 — Docker
# =============================================================================
log "Checking Docker..."

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found — installing via get.docker.com..."
  if ! curl -fsSL https://get.docker.com | bash; then
    die "Docker install failed. Install manually: https://docs.docker.com/engine/install/"
  fi
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    warn "Added $USER to the 'docker' group."
    warn "If docker commands fail, log out and back in, then re-run this script."
  fi
fi

docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 not found. Upgrade Docker to ≥ 24."

DOCKER_VER=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
log "Docker ${DOCKER_VER}, Compose ${COMPOSE_VER} — OK"

# =============================================================================
# STEP 2 — Clone or update the repository
# =============================================================================
if [[ -f "docker-compose.yml" && -f "scripts/install.sh" ]]; then
  info "Already inside the EGH-Panel directory."
  if [[ -d ".git" ]]; then
    info "Pulling latest changes..."
    git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
  fi
elif [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Repository found at ./${INSTALL_DIR} — pulling latest..."
  cd "${INSTALL_DIR}"
  git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
else
  log "Cloning EGH Panel..."
  git clone "${REPO_URL}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
fi

REPO_ROOT="$(pwd)"
log "Working directory: ${REPO_ROOT}"

# =============================================================================
# STEP 3 — Ensure .env exists
# =============================================================================
if [[ ! -f ".env" ]]; then
  [[ -f ".env.example" ]] || die ".env.example missing — try re-cloning the repository."
  cp .env.example .env
  log ".env created from .env.example"
fi

# =============================================================================
# Helper functions
# =============================================================================

# Read a single key from .env (returns empty string if not set)
get_env_var() {
  local key="$1"
  grep -m1 "^${key}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '\r' || true
}

# True when a value is empty or still a CHANGE_ME placeholder
is_placeholder() {
  local val="$1"
  [[ -z "${val}" ]] || [[ "${val}" == CHANGE_ME* ]]
}

# Replace or append KEY=VALUE in .env safely (handles any characters in value)
set_env_var() {
  local key="$1"
  local val="$2"
  local tmpfile
  tmpfile=$(mktemp)
  local found=0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    if [[ "${line}" == "${key}"=* ]]; then
      printf '%s=%s\n' "${key}" "${val}"
      found=1
    else
      printf '%s\n' "${line}"
    fi
  done < .env > "${tmpfile}"
  [[ "${found}" -eq 1 ]] || printf '%s=%s\n' "${key}" "${val}" >> "${tmpfile}"
  mv "${tmpfile}" .env
}

# Generate N bytes of cryptographically random hex (openssl preferred, falls back to /dev/urandom)
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

# =============================================================================
# STEP 4 — Auto-generate secrets and internal credentials
# =============================================================================
echo ""
hr
echo -e "  ${BOLD}Generating secrets and internal credentials${NC}"
hr
echo ""

# Track which values were auto-generated for the final summary
GENERATED_VARS=()

# ── POSTGRES_PASSWORD ─────────────────────────────────────────────────────────
_PG_PASS="$(get_env_var POSTGRES_PASSWORD)"
if is_placeholder "${_PG_PASS}"; then
  _PG_PASS="$(gen_hex 20)"   # 40-char hex password (160-bit entropy)
  set_env_var "POSTGRES_PASSWORD" "${_PG_PASS}"
  GENERATED_VARS+=("POSTGRES_PASSWORD")
  bullet "POSTGRES_PASSWORD   ${GREEN}auto-generated${NC}"
else
  bullet "POSTGRES_PASSWORD   ${CYAN}already set — kept${NC}"
fi

# ── REDIS_PASSWORD ────────────────────────────────────────────────────────────
_REDIS_PASS="$(get_env_var REDIS_PASSWORD)"
if is_placeholder "${_REDIS_PASS}"; then
  _REDIS_PASS="$(gen_hex 20)"
  set_env_var "REDIS_PASSWORD" "${_REDIS_PASS}"
  GENERATED_VARS+=("REDIS_PASSWORD")
  bullet "REDIS_PASSWORD      ${GREEN}auto-generated${NC}"
else
  bullet "REDIS_PASSWORD      ${CYAN}already set — kept${NC}"
fi

# ── JWT_SECRET ────────────────────────────────────────────────────────────────
_JWT="$(get_env_var JWT_SECRET)"
if is_placeholder "${_JWT}"; then
  _JWT="$(gen_hex 64)"   # 128-char hex (512-bit entropy)
  set_env_var "JWT_SECRET" "${_JWT}"
  GENERATED_VARS+=("JWT_SECRET")
  bullet "JWT_SECRET          ${GREEN}auto-generated${NC}"
else
  bullet "JWT_SECRET          ${CYAN}already set — kept${NC}"
fi

# ── POSTGRES_USER / POSTGRES_DB ───────────────────────────────────────────────
_PG_USER="$(get_env_var POSTGRES_USER)"
if [[ -z "${_PG_USER}" ]]; then
  set_env_var "POSTGRES_USER" "eghpanel"
fi
_PG_DB="$(get_env_var POSTGRES_DB)"
if [[ -z "${_PG_DB}" ]]; then
  set_env_var "POSTGRES_DB" "eghpanel"
fi

# ── NODE_ENV ──────────────────────────────────────────────────────────────────
set_env_var "NODE_ENV" "production"

echo ""

# =============================================================================
# STEP 5 — Prompt only for the essentials
# =============================================================================
hr
echo -e "  ${BOLD}Panel Configuration${NC}"
echo -e "  Press Enter to accept the default shown in brackets."
hr
echo ""

# -- Public URL ---------------------------------------------------------------
_CUR_URL="$(get_env_var FRONTEND_URL)"
_DEFAULT_URL="${_CUR_URL:-http://localhost}"
read -r -p "  Public URL or IP  [${_DEFAULT_URL}]: " _INPUT_URL <"${TTY}"
FRONTEND_URL="${_INPUT_URL:-${_DEFAULT_URL}}"
FRONTEND_URL="${FRONTEND_URL%/}"   # strip trailing slash
set_env_var "FRONTEND_URL" "${FRONTEND_URL}"

# -- HTTP port ----------------------------------------------------------------
_CUR_PORT="$(get_env_var HTTP_PORT)"
_DEFAULT_PORT="${_CUR_PORT:-80}"
read -r -p "  HTTP port         [${_DEFAULT_PORT}]: " _INPUT_PORT <"${TTY}"
HTTP_PORT="${_INPUT_PORT:-${_DEFAULT_PORT}}"
if ! [[ "${HTTP_PORT}" =~ ^[0-9]+$ ]] || [[ "${HTTP_PORT}" -lt 1 ]] || [[ "${HTTP_PORT}" -gt 65535 ]]; then
  warn "Invalid port '${HTTP_PORT}' — defaulting to 80."
  HTTP_PORT=80
fi
set_env_var "HTTP_PORT" "${HTTP_PORT}"

# -- Demo seed ----------------------------------------------------------------
echo ""
read -r -p "  Load demo data? (sample admin + client accounts) [y/N]: " _SEED <"${TTY}"
SEED_REPLY="${_SEED:-N}"

echo ""
hr

# =============================================================================
# STEP 6 — Make scripts executable
# =============================================================================
chmod +x scripts/install.sh scripts/update.sh scripts/seed.sh scripts/bootstrap.sh 2>/dev/null || true

# =============================================================================
# STEP 7 — Run install
# =============================================================================
echo ""
log "Starting install (Docker build + database setup + services)..."
echo ""

if [[ "${SEED_REPLY}" =~ ^[Yy]$ ]]; then
  bash scripts/install.sh --seed
else
  bash scripts/install.sh --no-seed
fi

# =============================================================================
# STEP 8 — Final summary
# =============================================================================
echo ""
hr
echo -e "  ${GREEN}${BOLD}EGH Panel is ready!${NC}"
hr
echo ""
echo -e "  ${BOLD}Panel URL:${NC}      ${FRONTEND_URL}"
echo -e "  ${BOLD}First run:${NC}      Open the URL above — you will be guided through"
echo -e "                  creating your administrator account."
echo -e "  ${BOLD}Health check:${NC}   curl ${FRONTEND_URL}/api/healthz"
echo ""

if [[ ${#GENERATED_VARS[@]} -gt 0 ]]; then
  echo -e "  ${BOLD}Auto-generated secrets${NC} (saved to ${REPO_ROOT}/.env):"
  for v in "${GENERATED_VARS[@]}"; do
    echo -e "  ${GREEN}✓${NC} ${v}"
  done
  echo ""
  echo -e "  ${YELLOW}Keep .env secure and do not commit it to version control.${NC}"
  echo ""
fi

if [[ "${SEED_REPLY}" =~ ^[Yy]$ ]]; then
  echo -e "  ${YELLOW}Demo accounts loaded (remove or change before going public):${NC}"
  echo -e "  ┌────────────────────────────┬───────────┬─────────────┐"
  echo -e "  │ Email                      │ Password  │ Role        │"
  echo -e "  ├────────────────────────────┼───────────┼─────────────┤"
  echo -e "  │ admin@eghpanel.com         │ admin123  │ super_admin │"
  echo -e "  │ admin2@eghpanel.com        │ admin123  │ admin       │"
  echo -e "  │ client@example.com         │ client123 │ client      │"
  echo -e "  └────────────────────────────┴───────────┴─────────────┘"
  echo ""
fi

echo -e "  ${BOLD}Update later:${NC}"
echo -e "    cd ${REPO_ROOT}"
echo -e "    git pull && bash scripts/update.sh"
echo ""
echo -e "  ${BOLD}HTTPS:${NC} Place Caddy, Nginx, or Cloudflare in front of port ${HTTP_PORT}."
echo -e "  Then update FRONTEND_URL in .env to your https:// address and run:"
echo -e "    docker compose up -d"
echo ""
hr
echo ""
