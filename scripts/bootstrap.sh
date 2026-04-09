#!/usr/bin/env bash
# =============================================================================
# EGH Panel — Interactive Bootstrap Installer
#
# Intended for first-time installation on a fresh Ubuntu server (22.04+).
# Wraps the existing install flow (scripts/install.sh) with interactive prompts
# so that .env is fully configured before Docker is ever started.
#
# One-command install (as root or a user with sudo + docker access):
#   curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
#
# Or, if you have already cloned the repo:
#   bash scripts/bootstrap.sh
#
# For subsequent updates, do NOT re-run this script.  Use:
#   git pull && bash scripts/update.sh
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[egh]${NC} $*"; }
info() { echo -e "${CYAN}[egh]${NC} $*"; }
warn() { echo -e "${YELLOW}[egh]${NC} $*"; }
die()  { echo -e "${RED}[egh]${NC} ERROR: $*" >&2; exit 1; }
hr()   { echo -e "${CYAN}$(printf '─%.0s' $(seq 1 62))${NC}"; }

REPO_URL="https://github.com/Ibbolufc/EGH-Panel.git"
INSTALL_DIR="${EGH_INSTALL_DIR:-EGH-Panel}"

# All interactive reads come from /dev/tty so the script works when piped via
# "curl ... | bash" (stdin is the script itself, not the terminal in that case).
TTY=/dev/tty

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
hr
echo -e "  ${BOLD}EGH Panel — Interactive Installer${NC}"
hr
echo ""

# =============================================================================
# STEP 1 — Docker
# =============================================================================
log "Checking Docker..."

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found — installing via get.docker.com..."
  if ! curl -fsSL https://get.docker.com | bash; then
    die "Docker install failed. Install Docker manually: https://docs.docker.com/engine/install/"
  fi
  # Add the current user to the docker group so non-root runs work after relogin
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    warn "Added $USER to the 'docker' group."
    warn "This session may still need a permission refresh."
    warn "If Docker commands fail later, log out, log back in, and re-run: bash ${INSTALL_DIR}/scripts/bootstrap.sh"
  fi
fi

docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 not found. Ensure Docker ≥ 24 is installed and 'docker compose version' works."

DOCKER_VER=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
log "Docker ${DOCKER_VER}, Compose ${COMPOSE_VER} — OK"

# =============================================================================
# STEP 2 — Clone or update the repository
# =============================================================================
# Detect whether we are already inside the repo (the user cloned manually, or
# this is a re-run).  Fall back to cloning into INSTALL_DIR.

if [[ -f "docker-compose.yml" && -f "scripts/install.sh" ]]; then
  info "Already inside the EGH-Panel directory."
  if [[ -d ".git" ]]; then
    info "Pulling latest changes..."
    git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
  fi
elif [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Repository found at ./${INSTALL_DIR} — pulling latest changes..."
  cd "${INSTALL_DIR}"
  git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
else
  log "Cloning EGH Panel from GitHub..."
  git clone "${REPO_URL}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
fi

REPO_ROOT="$(pwd)"
log "Working directory: ${REPO_ROOT}"

# =============================================================================
# STEP 3 — Create .env if it does not exist yet
# =============================================================================
if [[ ! -f ".env" ]]; then
  [[ -f ".env.example" ]] || die ".env.example missing from repository. Try re-cloning."
  cp .env.example .env
  log ".env created from .env.example."
fi

# =============================================================================
# STEP 4 — Interactive prompts
# =============================================================================
echo ""
hr
echo -e "  ${BOLD}Panel Configuration${NC}"
echo -e "  Answer each prompt, or press Enter to accept the default [shown in brackets]."
echo -e "  Passwords are not echoed."
hr
echo ""

# -- Public URL ---------------------------------------------------------------
read -r -p "  Public URL or IP  (e.g. http://203.0.113.10 or http://panel.example.com)
  [http://localhost]: " _FRONTEND_URL <"${TTY}"
FRONTEND_URL="${_FRONTEND_URL:-http://localhost}"

# Strip trailing slash
FRONTEND_URL="${FRONTEND_URL%/}"

# -- PostgreSQL password -------------------------------------------------------
while true; do
  read -r -s -p "
  PostgreSQL password (required, min 8 characters): " _PG_PASS <"${TTY}"
  echo ""
  if [[ "${#_PG_PASS}" -ge 8 ]]; then
    POSTGRES_PASSWORD="${_PG_PASS}"
    break
  fi
  warn "Password must be at least 8 characters."
done

# -- Redis password ------------------------------------------------------------
while true; do
  read -r -s -p "  Redis password    (required, min 8 characters): " _REDIS_PASS <"${TTY}"
  echo ""
  if [[ "${#_REDIS_PASS}" -ge 8 ]]; then
    REDIS_PASSWORD="${_REDIS_PASS}"
    break
  fi
  warn "Password must be at least 8 characters."
done

# -- JWT secret ----------------------------------------------------------------
echo -e "
  JWT secret — leave blank to auto-generate a secure 64-character hex key."
read -r -s -p "  JWT secret [auto-generate]: " _JWT <"${TTY}"
echo ""
if [[ -z "${_JWT}" ]]; then
  JWT_SECRET=$(openssl rand -hex 64)
  log "JWT_SECRET auto-generated."
else
  JWT_SECRET="${_JWT}"
fi

# -- HTTP port -----------------------------------------------------------------
read -r -p "
  HTTP port  [80]: " _PORT <"${TTY}"
HTTP_PORT="${_PORT:-80}"
if ! [[ "${HTTP_PORT}" =~ ^[0-9]+$ ]] || [[ "${HTTP_PORT}" -lt 1 ]] || [[ "${HTTP_PORT}" -gt 65535 ]]; then
  warn "Invalid port '${HTTP_PORT}' — defaulting to 80."
  HTTP_PORT=80
fi

# -- Seed data -----------------------------------------------------------------
echo ""
read -r -p "  Load demo seed data? (creates admin + client demo accounts) [y/N]: " _SEED <"${TTY}"
SEED_REPLY="${_SEED:-N}"

echo ""
hr

# =============================================================================
# STEP 5 — Write configuration into .env
# =============================================================================
# set_env_var replaces KEY=<anything> in .env with KEY=<new value>.
# It writes through a temp file so special characters in values are safe.
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
  # Append if the key was not in the file at all
  if [[ "${found}" -eq 0 ]]; then
    printf '%s=%s\n' "${key}" "${val}" >> "${tmpfile}"
  fi
  mv "${tmpfile}" .env
}

log "Writing configuration to .env..."
set_env_var "FRONTEND_URL"      "${FRONTEND_URL}"
set_env_var "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
set_env_var "REDIS_PASSWORD"    "${REDIS_PASSWORD}"
set_env_var "JWT_SECRET"        "${JWT_SECRET}"
set_env_var "HTTP_PORT"         "${HTTP_PORT}"
set_env_var "NODE_ENV"          "production"
log ".env written."

# =============================================================================
# STEP 6 — Make scripts executable
# =============================================================================
chmod +x scripts/install.sh scripts/update.sh scripts/seed.sh scripts/bootstrap.sh 2>/dev/null || true

# =============================================================================
# STEP 7 — Run install
# =============================================================================
echo ""
log "Starting install (Docker build + migrations + services)..."
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
echo -e "  ${CYAN}Panel URL:${NC}  ${FRONTEND_URL}"
echo -e "  ${CYAN}Health check:${NC}  curl ${FRONTEND_URL}/api/healthz"
echo ""

if [[ "${SEED_REPLY}" =~ ^[Yy]$ ]]; then
  echo -e "  ${YELLOW}Demo accounts (remove or change before going public):${NC}"
  echo -e "  ┌────────────────────────────┬───────────┬─────────────┐"
  echo -e "  │ Email                      │ Password  │ Role        │"
  echo -e "  ├────────────────────────────┼───────────┼─────────────┤"
  echo -e "  │ admin@eghpanel.com         │ admin123  │ super_admin │"
  echo -e "  │ admin2@eghpanel.com        │ admin123  │ admin       │"
  echo -e "  │ client@example.com         │ client123 │ client      │"
  echo -e "  └────────────────────────────┴───────────┴─────────────┘"
  echo ""
fi

echo -e "  ${CYAN}Update later:${NC}"
echo -e "    cd ${REPO_ROOT}"
echo -e "    git pull && bash scripts/update.sh"
echo ""
echo -e "  ${CYAN}HTTPS:${NC} Point an external reverse proxy (Caddy, Nginx, Cloudflare) at"
echo -e "  port ${HTTP_PORT} on this machine. Then update FRONTEND_URL in .env and run:"
echo -e "    docker compose up -d"
echo ""
hr
echo ""
