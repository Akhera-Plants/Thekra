#!/usr/bin/env bash
# SUPERSEDED by scripts/release-db.sh (docs/build/RELEASE_DB.md).
#
# This script dumped the local database straight into Neon with no cleaning. That
# copied the development seed accounts (user@thekra.local / admin@thekra.local,
# password `password123456`), favourites and the local SyncLog into production.
# It now refuses to run; its previous body is in git history.
#
#   scripts/release-db.sh build
#   NEON_DATABASE_URL=… scripts/release-db.sh push
#   DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm --filter backend admin:create

echo "scripts/db-push-to-neon.sh is superseded and does nothing. Use scripts/release-db.sh (docs/build/RELEASE_DB.md)." >&2
exit 1
