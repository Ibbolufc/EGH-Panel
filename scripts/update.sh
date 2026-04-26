#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  echo
  echo "[update] $1"
}

die() {
  echo
  echo "[update] ERROR: $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ -f "docker-compose.yml" ] || die "docker-compose.yml not found. Run this from a valid EGH-Panel checkout."

command -v docker >/dev/null 2>&1 || die "Docker is not installed."
command -v git >/dev/null 2>&1 || die "Git is not installed."
docker info >/dev/null 2>&1 || die "Docker daemon is not running or not accessible."

export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-0}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

log "Checking working tree"
if [ -n "$(git status --porcelain)" ]; then
  die "You have uncommitted changes in ~/EGH-Panel. Commit or stash them first."
fi

log "Fetching latest code"
git fetch origin "$CURRENT_BRANCH"

log "Pulling latest code"
git pull --ff-only origin "$CURRENT_BRANCH"

log "Ensuring database services are up"
docker compose up -d postgres redis

log "Rebuilding API and frontend images"
docker compose build --no-cache api frontend nginx

log "Running database schema sync"
if docker compose run --rm api pnpm --filter @workspace/db run push-force; then
  echo "[update] Database schema sync completed."
else
  die "Database schema sync failed."
fi

log "Force recreating application containers"
docker compose up -d --force-recreate --no-deps api frontend nginx

log "Ensuring full stack is up"
docker compose up -d --remove-orphans

log "Current container status"
docker compose ps

echo
echo "============================================"
echo " EGH Panel update completed successfully."
echo "============================================"
echo
echo "Quick checks:"
echo "  curl -I https://egh.valyria.win"
echo "  curl -I https://egh.valyria.win/api/healthz"
echo "  curl -I https://egh.valyria.win/api/download/egh-node"
echo
