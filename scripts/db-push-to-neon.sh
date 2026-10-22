#!/usr/bin/env bash
# Dump the local Postgres database and restore it into Neon.
# Never hard-codes URLs — set them in the environment (or a local .env you source).
#
# Required:
#   LOCAL_DATABASE_URL  — local Postgres (usually the same as backend DATABASE_URL)
#   NEON_DATABASE_URL   — Neon *direct* connection (not the pooled/-pooler host)
#
# Optional:
#   DUMP_FILE           — path for the intermediate dump (default: /tmp/thekra-neon.dump)
#
# Example:
#   set -a && source backend/.env && set +a
#   export LOCAL_DATABASE_URL="$DATABASE_URL"
#   export NEON_DATABASE_URL="$DIRECT_URL"   # Neon direct URL from the dashboard
#   ./scripts/db-push-to-neon.sh

set -euo pipefail

: "${LOCAL_DATABASE_URL:?Set LOCAL_DATABASE_URL to your local Postgres URL}"
: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL to the Neon direct (non-pooler) URL}"

DUMP_FILE="${DUMP_FILE:-/tmp/thekra-neon.dump}"

if [[ "$NEON_DATABASE_URL" == *"-pooler."* ]] || [[ "$NEON_DATABASE_URL" == *"pgbouncer=true"* ]]; then
  echo "error: NEON_DATABASE_URL looks pooled. Use the Neon direct connection string." >&2
  exit 1
fi

echo "→ Dumping local database to ${DUMP_FILE}"
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --dbname="$LOCAL_DATABASE_URL" \
  --file="$DUMP_FILE"

echo "→ Restoring into Neon (this replaces matching objects; review before prod)"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$NEON_DATABASE_URL" \
  "$DUMP_FILE"

echo "✓ Done. Point backend DATABASE_URL at the Neon pooled URL and DIRECT_URL at the direct URL."
