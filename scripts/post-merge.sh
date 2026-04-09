#!/usr/bin/env bash
# Runs automatically after a task-agent branch is merged.
set -euo pipefail
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
