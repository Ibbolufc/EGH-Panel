#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  echo
  echo "==> $1"
}

die() {
  echo
  echo "ERROR: $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ -f "docker-compose.yml" ] || die "docker-compose.yml not found. Run this from a valid EGH-Panel checkout."

if ! command -v docker >/dev/null 2>&1; then
  die "Docker is not installed."
fi

if ! docker info >/dev/null 2>&1; then
  die "Docker daemon is not running or not accessible."
fi

if ! command -v git >/dev/null 2>&1; then
  die "Git is not installed."
fi

export DOCKER_API_VERSION="${DOCKER_API_VERSION:-1.41}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-0}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

log "Checking working tree"
if [ -n "$(git status --porcelain)" ]; then
  die "You have uncommitted changes in ~/EGH-Panel. Commit/stash them first, then run update again."
fi

log "Fetching latest code"
git fetch origin "$CURRENT_BRANCH"

log "Pulling latest code"
git pull --ff-only origin "$CURRENT_BRANCH"

log "Starting core services"
docker compose up -d postgres redis

log "Building fresh images"
docker compose build --no-cache api frontend nginx

log "Running database schema update"
if docker compose run --rm api pnpm --filter @workspace/db run push; then
  echo "Database schema update completed."
else
  die "Database schema update failed. Fix that first before continuing."
fi

log "Recreating application containers"
docker compose up -d --force-recreate api frontend nginx

log "Cleaning orphaned EGH containers"
docker compose up -d --remove-orphans

log "Showing container status"
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
