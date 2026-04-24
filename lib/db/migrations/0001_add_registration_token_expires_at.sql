-- Migration: add registration_token_expires_at to nodes
--
-- PURPOSE
--   Adds a 48-hour expiry to node registration tokens.  After this migration
--   the install.sh route (GET /api/nodes/:id/install.sh) will reject tokens
--   whose expiry timestamp is in the past with a shell-safe HTTP 403.
--
-- WHEN TO RUN THIS
--   • Fresh installs: handled automatically by `drizzle-kit push` or via the
--     baseline migration in drizzle/0000_glamorous_jigsaw.sql.
--   • Existing databases (upgrade path): apply this script once using psql:
--       psql "$DATABASE_URL" -f lib/db/migrations/0001_add_registration_token_expires_at.sql
--
-- LEGACY ROWS (backward-compatibility)
--   Rows with registration_token_expires_at = NULL are treated as never-expired
--   by the API (backward-compatible).  To close that window and enforce the
--   48-hour policy across all existing nodes, run the optional backfill below.

-- Step 1: add the column (safe to run multiple times thanks to IF NOT EXISTS)
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS registration_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Step 2 (optional): backfill existing rows so their token expires 48 hours
-- from the moment this migration is applied.  Comment out if you prefer to
-- leave legacy tokens valid until the next manual regen.
--
-- UPDATE nodes
--   SET registration_token_expires_at = NOW() + INTERVAL '48 hours'
--   WHERE registration_token_expires_at IS NULL
--     AND registration_token IS NOT NULL;
