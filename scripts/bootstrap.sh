#!/usr/bin/env bash
# =============================================================================
# EGH Panel — One-Command Bootstrap Installer  v2.0
#
# One-command install (run as root or a user with sudo + docker access):
#   curl -fsSL https://raw.githubusercontent.com/Ibbolufc/EGH-Panel/main/scripts/bootstrap.sh | bash
#
# Or, if you have already cloned the repo:
#   bash scripts/bootstrap.sh [OPTIONS]
#
# Options:
#   --non-interactive   Skip all prompts; use defaults / env-var overrides
#   --url <URL>         Public URL or IP (e.g. http://203.0.113.10)
#   --port <PORT>       HTTP port nginx binds on the host (default: 80)
#   --seed              Load demo accounts automatically
#   --no-seed           Skip demo data without asking
#   --clean             Wipe existing containers + volumes before installing
#
# Environment-variable equivalents (useful when piping from curl):
#   EGH_URL=http://... EGH_PORT=80 EGH_SEED=yes EGH_NON_INTERACTIVE=1
#   EGH_CLEAN=1 curl -fsSL .../bootstrap.sh | bash
#
# For subsequent updates do NOT re-run this script.  Use instead:
#   cd EGH-Panel && git pull && bash scripts/update.sh
# =============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

log()    { echo -e "${GREEN}[egh]${NC} $*"; }
info()   { echo -e "${CYAN}[egh]${NC} $*"; }
warn()   { echo -e "${YELLOW}[egh]${NC} $*"; }
die()    { echo -e "\n${RED}[egh] ERROR:${NC} $*" >&2; echo -e "${DIM}See above for details.${NC}" >&2; exit 1; }
bullet() { echo -e "  ${CYAN}•${NC} $*"; }
ok()     { echo -e "  ${GREEN}✓${NC} $*"; }
fail()   { echo -e "  ${RED}✗${NC} $*"; }
hr()     { printf "${CYAN}"; printf '─%.0s' $(seq 1 64); printf "${NC}\n"; }
section(){ echo ""; hr; echo -e "  ${BOLD}${1}${NC}"; hr; echo ""; }

REPO_URL="https://github.com/Ibbolufc/EGH-Panel.git"
INSTALL_DIR="${EGH_INSTALL_DIR:-EGH-Panel}"

# All interactive reads come from /dev/tty so the script works when piped via
# "curl ... | bash" (stdin is the downloaded script, not the terminal).
TTY=/dev/tty

# ── Parse flags ───────────────────────────────────────────────────────────────
NON_INTERACTIVE="${EGH_NON_INTERACTIVE:-}"
FLAG_URL="${EGH_URL:-}"
FLAG_PORT="${EGH_PORT:-}"
FLAG_SEED="${EGH_SEED:-}"   # "yes" | "no" | ""
FLAG_CLEAN="${EGH_CLEAN:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=1 ;;
    --clean)           FLAG_CLEAN=1 ;;
    --seed)            FLAG_SEED=yes ;;
    --no-seed)         FLAG_SEED=no ;;
    --url)             shift; FLAG_URL="${1:-}" ;;
    --port)            shift; FLAG_PORT="${1:-}" ;;
    *) warn "Unknown flag: $1 (ignored)" ;;
  esac
  shift
done

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
hr
echo -e "  ${BOLD}EGH Panel — Installer${NC}"
echo -e "  ${DIM}Game Server Control Panel · github.com/Ibbolufc/EGH-Panel${NC}"
hr
echo ""

# =============================================================================
# STEP 1 — Docker
# =============================================================================
log "Checking Docker..."

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found — installing via get.docker.com..."
  if ! curl -fsSL https://get.docker.com | bash; then
    die "Docker install failed.\nInstall manually: https://docs.docker.com/engine/install/"
  fi
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    warn "Added ${USER} to the 'docker' group."
    warn "If docker commands fail after install, log out → log back in → re-run this script."
  fi
fi

docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 not found.\nUpgrade Docker to ≥ 24 or install the compose plugin:\n  https://docs.docker.com/compose/install/"

DOCKER_VER=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
log "Docker ${DOCKER_VER}, Compose ${COMPOSE_VER} — OK"

# =============================================================================
# STEP 1b — Docker API compatibility check
#
# Some servers run an older Docker daemon (e.g. Docker 20 / API 1.41) while
# the client binary shipped with a newer OS expects API 1.44+.  When they
# mismatch, docker compose build fails with cryptic "server API too old"
# errors.  We detect this here and silently enable compatibility mode so the
# install continues without any manual exports.
# =============================================================================

_detect_docker_compat() {
  # Try to get both API versions from "docker version".
  # We use --format so we don't need jq.
  local client_api server_api
  client_api=$(docker version --format '{{.Client.APIVersion}}' 2>/dev/null || true)
  server_api=$(docker version --format '{{.Server.APIVersion}}' 2>/dev/null || true)

  # Strip whitespace/carriage-returns
  client_api=$(echo "${client_api}" | tr -d '[:space:]')
  server_api=$(echo "${server_api}" | tr -d '[:space:]')

  # If either is empty, the daemon may be unreachable or version format changed.
  if [[ -z "${client_api}" || -z "${server_api}" ]]; then
    warn "Could not read Docker API versions — skipping compatibility check."
    warn "If builds fail with 'server API too old', set these before re-running:"
    warn "  export DOCKER_API_VERSION=1.41 DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0"
    return
  fi

  log "Docker API — client: ${client_api}  daemon: ${server_api}"

  # Compare as floating-point numbers using awk (handles 1.41, 1.44, etc.)
  local needs_compat
  needs_compat=$(awk -v c="${client_api}" -v s="${server_api}" \
    'BEGIN { print (c + 0 > s + 0) ? "yes" : "no" }')

  if [[ "${needs_compat}" == "yes" ]]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}Compatibility mode enabled${NC}"
    echo -e "  ${DIM}Your Docker daemon speaks API ${server_api} but the client expects ${client_api}."
    echo -e "  The installer will automatically limit the API version and disable"
    echo -e "  BuildKit so the build works on this older daemon.${NC}"
    echo ""

    # Export for this process and all child processes (build, compose, etc.)
    export DOCKER_API_VERSION="${server_api}"
    export DOCKER_BUILDKIT=0
    export COMPOSE_DOCKER_CLI_BUILD=0

    ok "DOCKER_API_VERSION=${server_api}"
    ok "DOCKER_BUILDKIT=0"
    ok "COMPOSE_DOCKER_CLI_BUILD=0"
    echo ""
  else
    # Client ≤ daemon — no mismatch; normal BuildKit path is fine.
    : # nothing to do
  fi
}

_detect_docker_compat

# =============================================================================
# STEP 2 — Clone or update the repository
# =============================================================================
if [[ -f "docker-compose.yml" && -f "scripts/install.sh" ]]; then
  info "Running from inside the EGH-Panel directory."
  if [[ -d ".git" ]]; then
    info "Pulling latest changes..."
    git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
  fi
elif [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Repository already found at ./${INSTALL_DIR} — updating..."
  cd "${INSTALL_DIR}"
  git pull origin main 2>/dev/null || warn "git pull failed — continuing with current files."
else
  log "Cloning EGH Panel into ./${INSTALL_DIR} ..."
  git clone "${REPO_URL}" "${INSTALL_DIR}" \
    || die "git clone failed.\nCheck your internet connection or clone manually:\n  git clone ${REPO_URL}"
  cd "${INSTALL_DIR}"
fi

REPO_ROOT="$(pwd)"
log "Working directory: ${REPO_ROOT}"

# =============================================================================
# Helper functions  (must come before first use)
# =============================================================================

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

# Try to detect this server's public IPv4 via well-known echo services (best-effort)
_detect_public_ip() {
  local ip=""
  for _svc in "https://api.ipify.org" "https://ifconfig.me" "https://icanhazip.com"; do
    ip=$(curl -sf --max-time 4 "${_svc}" 2>/dev/null | tr -d '[:space:]' || true)
    if [[ "${ip}" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
      echo "${ip}"
      return
    fi
    ip=""
  done
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

# Returns 0 (true) if a TCP port is in use on the host
port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -q ":${port} " || ss -tlnp 2>/dev/null | grep -q ":${port}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep -q ":${port} "
  else
    (echo "" >/dev/tcp/localhost/"${port}") 2>/dev/null
  fi
}

# Finds the next free port starting from $1
find_free_port() {
  local p="${1:-8080}"
  while port_in_use "${p}"; do
    p=$((p + 1))
    [[ "${p}" -gt 65535 ]] && echo "8080" && return
  done
  echo "${p}"
}

# Best-effort: name of what's using a given port
who_owns_port() {
  local port="$1" proc=""
  if command -v ss >/dev/null 2>&1; then
    proc=$(ss -tlnp 2>/dev/null | grep -E ":${port}[ $]" \
      | grep -oP 'users:\(\("[^"]+' | cut -d'"' -f2 | head -1 || true)
  fi
  if [[ -z "${proc}" ]] && command -v fuser >/dev/null 2>&1; then
    local pid
    pid=$(fuser "${port}/tcp" 2>/dev/null | tr -d ' ' || true)
    [[ -n "${pid}" ]] && proc=$(ps -p "${pid}" -o comm= 2>/dev/null || true)
  fi
  echo "${proc:-unknown}"
}

# =============================================================================
# STEP 3 — Detect existing install
# =============================================================================
EXISTING_INSTALL="no"
HAS_VOLUMES="no"
HAS_ENV="no"

# Check for configured .env (secrets already set)
if [[ -f ".env" ]]; then
  _test_pg=$(get_env_var POSTGRES_PASSWORD || true)
  if ! is_placeholder "${_test_pg}"; then
    HAS_ENV="yes"
    EXISTING_INSTALL="yes"
  fi
fi

# Check for existing Docker volumes (data already present)
if docker volume ls --format '{{.Name}}' 2>/dev/null | grep -qE '(egh.panel|eghpanel).*postgres'; then
  HAS_VOLUMES="yes"
  EXISTING_INSTALL="yes"
fi

# Check for running containers from this compose project
_RUNNING_COUNT=0
if [[ -f "docker-compose.yml" ]]; then
  # grep -c always prints the count (even "0") and exits 1 when nothing matches.
  # Using || true suppresses that exit code without doubling the output the way
  # || echo "0" would (which produced "0\n0" and broke the -gt comparison).
  _RUNNING_COUNT=$(docker compose ps --status running 2>/dev/null \
    | grep -cE 'api|frontend|postgres|redis|nginx' || true)
  _RUNNING_COUNT="${_RUNNING_COUNT:-0}"
fi

if [[ "${EXISTING_INSTALL}" == "yes" || "${_RUNNING_COUNT}" -gt 0 ]]; then
  section "Existing Installation Detected"
  [[ "${_RUNNING_COUNT}" -gt 0 ]] && bullet "Running containers: ${_RUNNING_COUNT}"
  [[ "${HAS_VOLUMES}" == "yes" ]]  && bullet "Postgres data volume exists"
  [[ "${HAS_ENV}" == "yes" ]]      && bullet "Configured .env found"
  echo ""

  if [[ -n "${FLAG_CLEAN}" ]]; then
    # Non-interactive clean was requested via flag
    log "Clean reinstall requested (--clean). Stopping and removing existing containers and volumes..."
    docker compose down -v --remove-orphans 2>/dev/null || true
    EXISTING_INSTALL="cleaned"
  elif [[ -n "${NON_INTERACTIVE}" ]]; then
    info "Non-interactive mode: keeping existing install data and continuing."
  else
    echo -e "  What would you like to do?\n"
    echo -e "  ${BOLD}1)${NC} Update / re-install  ${DIM}(keep all data — safest choice)${NC}"
    echo -e "  ${BOLD}2)${NC} Clean reinstall      ${DIM}(wipe containers + volumes — start fresh, data will be lost)${NC}"
    echo -e "  ${BOLD}3)${NC} Abort"
    echo ""
    read -r -p "  Enter choice [1]: " _CHOICE <"${TTY}"
    _CHOICE="${_CHOICE:-1}"
    echo ""
    case "${_CHOICE}" in
      1) info "Keeping existing data. Proceeding with update/reinstall..." ;;
      2)
        warn "Stopping and removing all containers and volumes (data will be lost)..."
        docker compose down -v --remove-orphans 2>/dev/null || true
        log "Cleaned."
        EXISTING_INSTALL="cleaned"
        ;;
      3) info "Aborting."; exit 0 ;;
      *) warn "Invalid choice — defaulting to keep existing data." ;;
    esac
  fi
fi

# =============================================================================
# STEP 4 — Ensure .env exists
# =============================================================================
if [[ ! -f ".env" ]]; then
  [[ -f ".env.example" ]] || die ".env.example is missing — try re-cloning the repository."
  cp .env.example .env
  log ".env created from .env.example"
fi

# =============================================================================
# STEP 5 — Auto-generate secrets and internal credentials
# =============================================================================
section "Generating Secrets & Credentials"

GENERATED_VARS=()

_PG_PASS="$(get_env_var POSTGRES_PASSWORD)"
if is_placeholder "${_PG_PASS}"; then
  _PG_PASS="$(gen_hex 20)"
  set_env_var "POSTGRES_PASSWORD" "${_PG_PASS}"
  GENERATED_VARS+=("POSTGRES_PASSWORD")
  bullet "POSTGRES_PASSWORD   ${GREEN}auto-generated${NC}"
else
  bullet "POSTGRES_PASSWORD   ${CYAN}already set — kept${NC}"
fi

_REDIS_PASS="$(get_env_var REDIS_PASSWORD)"
if is_placeholder "${_REDIS_PASS}"; then
  _REDIS_PASS="$(gen_hex 20)"
  set_env_var "REDIS_PASSWORD" "${_REDIS_PASS}"
  GENERATED_VARS+=("REDIS_PASSWORD")
  bullet "REDIS_PASSWORD      ${GREEN}auto-generated${NC}"
else
  bullet "REDIS_PASSWORD      ${CYAN}already set — kept${NC}"
fi

_JWT="$(get_env_var JWT_SECRET)"
if is_placeholder "${_JWT}"; then
  _JWT="$(gen_hex 64)"
  set_env_var "JWT_SECRET" "${_JWT}"
  GENERATED_VARS+=("JWT_SECRET")
  bullet "JWT_SECRET          ${GREEN}auto-generated${NC}"
else
  bullet "JWT_SECRET          ${CYAN}already set — kept${NC}"
fi

[[ -z "$(get_env_var POSTGRES_USER)" ]] && set_env_var "POSTGRES_USER" "eghpanel"
[[ -z "$(get_env_var POSTGRES_DB)"   ]] && set_env_var "POSTGRES_DB"   "eghpanel"
set_env_var "NODE_ENV" "production"

echo ""

# =============================================================================
# STEP 6 — Panel configuration
# =============================================================================
section "Panel Configuration"

if [[ -n "${NON_INTERACTIVE}" ]]; then
  echo -e "  ${DIM}Non-interactive mode — using defaults / flag values.${NC}"
  echo ""
fi

# ── Public URL ────────────────────────────────────────────────────────────────
_CUR_URL="$(get_env_var FRONTEND_URL)"

# Treat any obviously-placeholder URL as empty so the user gets a real default.
# Catches: http://IP  http://#IP  http://YOUR_IP  http://server-ip  etc.
# Rule 1: host part contains # (never valid in a URL host)
# Rule 2: host part matches a known template token word (case-insensitive)
_url_is_placeholder() {
  local u="${1,,}"   # lowercase for comparison
  # Strip scheme
  local host="${u#http://}"; host="${host#https://}"
  # Strip port and path
  host="${host%%:*}"; host="${host%%/*}"
  # Any # in the host → placeholder
  [[ "${host}" == *"#"* ]] && return 0
  # Known template tokens
  case "${host}" in
    ip|"#ip"|your_ip|server_ip|server-ip|your-server|your-ip|"your.ip"|"server.ip"|"example.com") return 0 ;;
  esac
  return 1
}
if _url_is_placeholder "${_CUR_URL}"; then
  _CUR_URL=""
fi

# If no real URL is configured yet, try to detect the server's public IP so
# the prompt shows an actionable default instead of http://localhost.
_AUTO_IP=""
if [[ -z "${_CUR_URL}" && -z "${FLAG_URL}" ]]; then
  info "Detecting server IP for default URL (press Ctrl-C to skip)..."
  _AUTO_IP=$(_detect_public_ip || true)
fi

if [[ -n "${FLAG_URL}" ]]; then
  _DEFAULT_URL="${FLAG_URL}"
elif [[ -n "${_CUR_URL}" ]]; then
  _DEFAULT_URL="${_CUR_URL}"
elif [[ -n "${_AUTO_IP}" ]]; then
  _DEFAULT_URL="http://${_AUTO_IP}"
else
  _DEFAULT_URL="http://localhost"
fi

if [[ -n "${NON_INTERACTIVE}" ]]; then
  FRONTEND_URL="${_DEFAULT_URL}"
  echo -e "  ${DIM}Public URL:${NC}  ${FRONTEND_URL}"
else
  read -r -p "  Public URL or IP  [${_DEFAULT_URL}]: " _INPUT_URL <"${TTY}"
  FRONTEND_URL="${_INPUT_URL:-${_DEFAULT_URL}}"
fi

# Strip trailing slash
FRONTEND_URL="${FRONTEND_URL%/}"

# Ensure a scheme is present — a bare IP or hostname entered without http://
# must be normalised now so every downstream consumer sees a full URL.
if [[ -n "${FRONTEND_URL}" && ! "${FRONTEND_URL}" =~ ^https?:// ]]; then
  FRONTEND_URL="http://${FRONTEND_URL}"
fi

set_env_var "FRONTEND_URL" "${FRONTEND_URL}"

# ── HTTP port with conflict detection ────────────────────────────────────────
_CUR_PORT="$(get_env_var HTTP_PORT)"
_DEFAULT_PORT="${FLAG_PORT:-${_CUR_PORT:-80}}"

if [[ -n "${NON_INTERACTIVE}" ]]; then
  HTTP_PORT="${_DEFAULT_PORT}"
  # Even in non-interactive mode, warn about port conflicts but don't block
  if port_in_use "${HTTP_PORT}"; then
    _owner=$(who_owns_port "${HTTP_PORT}")
    _free=$(find_free_port "$((HTTP_PORT + 1))")
    warn "Port ${HTTP_PORT} is already in use (${_owner})."
    warn "The installer will continue — if nginx fails to bind, re-run with --port ${_free}"
  fi
  echo -e "  ${DIM}HTTP port:${NC}   ${HTTP_PORT}"
else
  # Interactive: detect conflicts and guide the user
  if port_in_use "${_DEFAULT_PORT}"; then
    _owner=$(who_owns_port "${_DEFAULT_PORT}")
    _free=$(find_free_port "$((${_DEFAULT_PORT} + 1))")
    echo ""
    echo -e "  ${YELLOW}⚠  Port ${_DEFAULT_PORT} is already in use${NC} (process: ${_owner})"
    echo ""
    if [[ "${_owner}" =~ nginx|apache|caddy|traefik|haproxy ]]; then
      echo -e "  ${DIM}It looks like you already have a reverse proxy on port ${_DEFAULT_PORT}."
      echo -e "  You have two options:${NC}"
      echo ""
      echo -e "    ${BOLD}A)${NC} Use a different port (e.g. ${_free}) and point your reverse proxy to it."
      echo -e "       Use ${BOLD}http://localhost:${_free}${NC} as the upstream in your proxy config."
      echo ""
      echo -e "    ${BOLD}B)${NC} Stop your reverse proxy temporarily and let EGH Panel use port ${_DEFAULT_PORT}."
      echo ""
    else
      echo -e "  ${DIM}Something else is using port ${_DEFAULT_PORT}."
      echo -e "  Suggested free port: ${BOLD}${_free}${NC}${NC}"
      echo ""
    fi
    _DEFAULT_PORT="${_free}"
  fi
  read -r -p "  HTTP port  [${_DEFAULT_PORT}]: " _INPUT_PORT <"${TTY}"
  HTTP_PORT="${_INPUT_PORT:-${_DEFAULT_PORT}}"
fi

if ! [[ "${HTTP_PORT}" =~ ^[0-9]+$ ]] || [[ "${HTTP_PORT}" -lt 1 ]] || [[ "${HTTP_PORT}" -gt 65535 ]]; then
  warn "Invalid port '${HTTP_PORT}' — defaulting to 8080."
  HTTP_PORT=8080
fi
set_env_var "HTTP_PORT" "${HTTP_PORT}"

# ── Demo seed ─────────────────────────────────────────────────────────────────
if [[ -n "${NON_INTERACTIVE}" ]] || [[ -n "${FLAG_SEED}" ]]; then
  SEED_REPLY="${FLAG_SEED:-no}"
  echo -e "  ${DIM}Demo data:${NC}   ${SEED_REPLY:-no}"
  echo ""
else
  echo ""
  read -r -p "  Load demo accounts? (sample admin + client users) [y/N]: " _SEED <"${TTY}"
  SEED_REPLY="${_SEED:-N}"
  echo ""
fi

hr
echo ""

# =============================================================================
# STEP 7 — Configuration summary (confirm before long build)
# =============================================================================
echo -e "  ${BOLD}Install summary — please confirm:${NC}"
echo ""
echo -e "  ${DIM}Panel URL   ${NC} ${FRONTEND_URL}"
echo -e "  ${DIM}HTTP port   ${NC} ${HTTP_PORT}"
echo -e "  ${DIM}Demo data   ${NC} $( [[ "${SEED_REPLY}" =~ ^[Yy]$ ]] && echo "yes" || echo "no" )"
echo -e "  ${DIM}Directory   ${NC} ${REPO_ROOT}"
echo ""

if [[ -z "${NON_INTERACTIVE}" ]]; then
  read -r -p "  Proceed? [Y/n]: " _CONFIRM <"${TTY}"
  echo ""
  if [[ "${_CONFIRM}" =~ ^[Nn]$ ]]; then
    info "Aborted. Nothing was changed."
    exit 0
  fi
fi

# =============================================================================
# STEP 8 — Make scripts executable
# =============================================================================
chmod +x scripts/install.sh scripts/update.sh scripts/seed.sh scripts/bootstrap.sh 2>/dev/null || true

# =============================================================================
# STEP 9 — Run install (build + migrate + start)
# =============================================================================
section "Building & Starting EGH Panel"
echo -e "  ${DIM}This takes 5–15 minutes on a fresh server. Grab a coffee. ☕${NC}"
echo ""

if [[ "${SEED_REPLY}" =~ ^[Yy]$ ]]; then
  INSTALL_EXIT=0
  bash scripts/install.sh --seed || INSTALL_EXIT=$?
else
  INSTALL_EXIT=0
  bash scripts/install.sh --no-seed || INSTALL_EXIT=$?
fi

if [[ "${INSTALL_EXIT}" -ne 0 ]]; then
  echo ""
  hr
  echo -e "  ${RED}${BOLD}Install did not complete successfully.${NC}"
  hr
  echo ""
  echo -e "  ${BOLD}Useful recovery commands:${NC}"
  echo ""
  bullet "Check all service logs:  ${CYAN}docker compose logs --tail=50${NC}"
  bullet "Check API logs:          ${CYAN}docker compose logs api${NC}"
  bullet "Check migration logs:    ${CYAN}docker compose logs tools${NC}"
  bullet "Retry the install:       ${CYAN}bash ${REPO_ROOT}/scripts/install.sh${NC}"
  bullet "Start fresh:             ${CYAN}docker compose down -v && bash ${REPO_ROOT}/scripts/bootstrap.sh --clean${NC}"
  echo ""
  exit "${INSTALL_EXIT}"
fi

# =============================================================================
# STEP 10 — Post-install verification
# =============================================================================
section "Verifying Installation"

_PORT="${HTTP_PORT:-80}"
_ALL_OK=true

# Check each container status
for svc in postgres redis api frontend nginx; do
  _state=$(docker compose ps --format '{{.State}}' "${svc}" 2>/dev/null | head -1 || echo "missing")
  _health=$(docker compose ps --format '{{.Health}}' "${svc}" 2>/dev/null | head -1 || echo "")
  if [[ "${_state}" == "running" ]]; then
    if [[ -n "${_health}" && "${_health}" != "healthy" ]]; then
      fail "${svc}  ${YELLOW}(running but not yet healthy — may still be initialising)${NC}"
    else
      ok "${svc}"
    fi
  else
    fail "${svc}  ${RED}(state: ${_state:-not found})${NC}"
    _ALL_OK=false
  fi
done

echo ""

# HTTP health check with retry
echo -ne "  Checking API health"
_HEALTHY=false
for _i in $(seq 1 12); do
  if curl -sf "http://localhost:${_PORT}/api/healthz" >/dev/null 2>&1; then
    _HEALTHY=true
    break
  fi
  echo -ne "."
  sleep 5
done
echo ""

if [[ "${_HEALTHY}" == "true" ]]; then
  ok "API health check passed"
  echo ""
else
  fail "API health check did not respond within 60 s"
  echo ""
  warn "The API may still be starting. Wait 30 s and try:"
  echo -e "  ${CYAN}curl http://localhost:${_PORT}/api/healthz${NC}"
  echo ""
  warn "If it stays unhealthy, check the logs:"
  echo -e "  ${CYAN}docker compose logs api${NC}"
  _ALL_OK=false
fi

# =============================================================================
# STEP 11 — Save install summary file
# =============================================================================
INSTALL_DATE=$(date '+%Y-%m-%d %H:%M:%S %Z')
SUMMARY_FILE="${REPO_ROOT}/egh-install-info.txt"

cat > "${SUMMARY_FILE}" << SUMMARY
EGH Panel — Install Summary
============================
Installed : ${INSTALL_DATE}
Panel URL : ${FRONTEND_URL}
HTTP port : ${HTTP_PORT}
Directory : ${REPO_ROOT}
Demo data : $( [[ "${SEED_REPLY}" =~ ^[Yy]$ ]] && echo "yes" || echo "no" )

Health check
  curl http://localhost:${HTTP_PORT}/api/healthz

Service management  (run from ${REPO_ROOT})
  Start all    docker compose up -d
  Stop all     docker compose down
  Restart all  docker compose restart
  View logs    docker compose logs -f
  API logs     docker compose logs -f api

Maintenance
  Update panel   cd ${REPO_ROOT} && git pull && bash scripts/update.sh
  Reseed data    bash ${REPO_ROOT}/scripts/seed.sh
  Backup DB      docker compose exec postgres pg_dump -U eghpanel eghpanel > backup_\$(date +%Y%m%d).sql
  Restore DB     docker compose exec -T postgres psql -U eghpanel eghpanel < backup.sql

HTTPS setup
  EGH Panel does not handle TLS directly.  Put Caddy, Nginx, or Traefik
  in front of port ${HTTP_PORT} to add HTTPS.  Then edit .env:
    FRONTEND_URL=https://yourdomain.com
  and run:  docker compose up -d

Security
  .env contains your generated secrets — keep it private.
  Do NOT commit it to version control.
SUMMARY

log "Install summary saved → ${SUMMARY_FILE}"

# =============================================================================
# STEP 12 — Final summary
# =============================================================================

# Build the display URL: ensure a scheme is present, then append :PORT when it
# is not the default for the scheme.
# e.g.  203.0.113.10 + port 8095        →  http://203.0.113.10:8095
#        http://203.0.113.10 + port 8095 →  http://203.0.113.10:8095
#        http://panel.example.com + 80   →  http://panel.example.com
_BASE_URL="${FRONTEND_URL}"
if [[ ! "${_BASE_URL}" =~ ^https?:// ]]; then
  _BASE_URL="http://${_BASE_URL}"
fi
_PANEL_URL="${_BASE_URL}"
if [[ "${HTTP_PORT}" -ne 80 && "${HTTP_PORT}" -ne 443 ]]; then
  # Strip any stale :port the user may have typed, then append the real one
  _PANEL_URL="$(echo "${_BASE_URL}" | sed -E 's|:[0-9]+$||'):${HTTP_PORT}"
fi

# The health-check command uses localhost + the actual port — always reachable
# on the server regardless of whether DNS points at it yet.
_HEALTHZ_CMD="curl http://localhost:${HTTP_PORT}/api/healthz"

echo ""
hr
if [[ "${_ALL_OK}" == "true" ]]; then
  echo -e "  ${GREEN}${BOLD}✓  EGH Panel is ready!${NC}"
else
  echo -e "  ${YELLOW}${BOLD}⚠  EGH Panel installed with warnings — see above.${NC}"
fi
hr
echo ""
echo -e "  ${BOLD}Panel URL      ${NC}  ${_PANEL_URL}"
echo -e "  ${BOLD}First run      ${NC}  Open the URL — you will be guided to create"
echo -e "                    your administrator account."
echo -e "  ${BOLD}Health check   ${NC}  ${_HEALTHZ_CMD}"
echo ""

if [[ "${_HEALTHY}" != "true" ]] || [[ "${_ALL_OK}" != "true" ]]; then
  echo -e "  ${YELLOW}One or more services did not reach a healthy state.${NC}"
  echo -e "  Recovery commands:"
  echo ""
  bullet "View logs:   ${CYAN}docker compose logs --tail=40${NC}"
  bullet "API logs:    ${CYAN}docker compose logs api${NC}"
  bullet "Retry:       ${CYAN}bash ${REPO_ROOT}/scripts/install.sh${NC}"
  echo ""
fi

if [[ ${#GENERATED_VARS[@]} -gt 0 ]]; then
  echo -e "  ${BOLD}Auto-generated secrets${NC} (saved to ${REPO_ROOT}/.env):"
  for v in "${GENERATED_VARS[@]}"; do
    ok "${v}"
  done
  echo ""
  echo -e "  ${YELLOW}Keep .env secure — do not commit it to version control.${NC}"
  echo ""
fi

if [[ "${SEED_REPLY}" =~ ^[Yy]$ ]]; then
  echo -e "  ${YELLOW}Demo accounts (change passwords before going public):${NC}"
  echo -e "  ┌────────────────────────────┬───────────┬─────────────┐"
  echo -e "  │ Email                      │ Password  │ Role        │"
  echo -e "  ├────────────────────────────┼───────────┼─────────────┤"
  echo -e "  │ admin@eghpanel.com         │ admin123  │ super_admin │"
  echo -e "  │ admin2@eghpanel.com        │ admin123  │ admin       │"
  echo -e "  │ client@example.com         │ client123 │ client      │"
  echo -e "  └────────────────────────────┴───────────┴─────────────┘"
  echo ""
fi

echo -e "  ${BOLD}Key commands${NC}  (run from ${REPO_ROOT})"
echo ""
bullet "Update:     ${CYAN}git pull && bash scripts/update.sh${NC}"
bullet "Logs:       ${CYAN}docker compose logs -f${NC}"
bullet "Stop:       ${CYAN}docker compose down${NC}"
bullet "Reseed:     ${CYAN}bash scripts/seed.sh${NC}"
echo ""
echo -e "  ${DIM}Full command reference saved to ${SUMMARY_FILE}${NC}"
echo ""

if [[ "${HTTP_PORT}" -ne 80 && "${HTTP_PORT}" -ne 443 ]]; then
  echo -e "  ${BOLD}HTTPS / Reverse proxy${NC}"
  echo -e "  ${DIM}Your panel is on port ${HTTP_PORT}. To add HTTPS, point Caddy, Nginx,"
  echo -e "  or Cloudflare at port ${HTTP_PORT}, then update FRONTEND_URL in .env"
  echo -e "  to https://yourdomain.com and run: docker compose up -d${NC}"
  echo ""
fi

hr
echo ""
