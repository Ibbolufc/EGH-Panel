#!/usr/bin/env bash
# =============================================================================
# EGH Panel — Deploy
#
# Convenience wrapper that delegates to install.sh or update.sh.
#
#   First install:  ./scripts/deploy.sh --install   (or: ./scripts/install.sh)
#   Update:         ./scripts/deploy.sh              (or: ./scripts/update.sh)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--install" ]]; then
  exec "$SCRIPT_DIR/install.sh" "${@:2}"
else
  exec "$SCRIPT_DIR/update.sh" "$@"
fi
