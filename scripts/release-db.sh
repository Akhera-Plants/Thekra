#!/usr/bin/env bash
# Thekra release database pipeline. Replaces scripts/db-push-to-neon.sh.
# Full guide: docs/build/RELEASE_DB.md
#
#   scripts/release-db.sh build          local thekra → cleaned thekra_release → /tmp/thekra-release.dump
#   scripts/release-db.sh push [--yes]   /tmp/thekra-release.dump → Neon (NEON_DATABASE_URL, direct host)
#
# build never writes to the local source database: it reads it with pg_dump and
# SELECTs only. Everything else happens in two scratch databases on the same
# server, thekra_release (kept for inspection) and thekra_release_schema (dropped).
#
# Environment:
#   LOCAL_DATABASE_URL  local source DB (default: DATABASE_URL from backend/.env)
#   NEON_DATABASE_URL   push only: Neon *direct* connection string. Never printed.
#   PG_BIN              optional directory with pg_dump/pg_restore >= the server major.
#                       Without it the host tools are used when new enough, otherwise
#                       the ones inside the Postgres container (docker compose service
#                       `db`, or PG_CONTAINER=<name>).
# Needs: bash, psql, curl, node and pnpm on PATH (build also boots the API once).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
CLEAN_SQL="$BACKEND/prisma/release/clean.sql"
VERIFY_SQL="$BACKEND/prisma/release/verify.sql"
MIGRATIONS_DIR="$BACKEND/prisma/migrations"

RELEASE_DB="thekra_release"
PROBE_DB="thekra_release_schema"
DUMP="/tmp/thekra-release.dump"
STAMP="/tmp/thekra-release.build-started"   # touched when a build starts
MANIFEST="/tmp/thekra-release.manifest"     # written when a build succeeds
SNAPSHOT="/tmp/thekra-release.verify.txt"   # verify.sql output of thekra_release at build time

PSQL=(psql -X -q -v ON_ERROR_STOP=1)

WORK=""
API_PID=""

log() { printf '→ %s\n' "$*"; }
ok() { printf '✓ %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 2
}

cleanup() {
  local status=$?
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${PGU_USER:-}" && "${PROBE_CREATED:-0}" == 1 ]]; then
    sql_local postgres -c "DROP DATABASE IF EXISTS $PROBE_DB WITH (FORCE)" >/dev/null 2>&1 || true
  fi
  if [[ "$TOOL_MODE" == docker && -n "$PG_CONTAINER_ID" ]]; then
    docker exec "$PG_CONTAINER_ID" rm -rf "$CONTAINER_TMP" >/dev/null 2>&1 || true
  fi
  if [[ -n "$WORK" && -d "$WORK" ]]; then rm -rf "$WORK"; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

human_size() { awk -v b="$1" 'BEGIN { split("B KB MB GB", u); i = 1; while (b >= 1024 && i < 4) { b /= 1024; i++ } printf "%.1f %s", b, u[i] }'; }
sha256_of() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
md5_stdin() { if command -v md5sum >/dev/null 2>&1; then md5sum | cut -d' ' -f1; else md5 -q; fi; }
major_of() { sed -E 's/^[^0-9]*([0-9]+).*/\1/'; }

# ── Local connection ────────────────────────────────────────────────────────

read_env_value() { # key file
  local line
  [[ -f "$2" ]] || return 1
  line=$(grep -E "^[[:space:]]*$1=" "$2" | tail -n 1) || return 1
  line=${line#*=}
  line=${line%$'\r'}
  line=${line#\"}; line=${line%\"}
  line=${line#\'}; line=${line%\'}
  printf '%s' "$line"
}

parse_local_url() {
  local url="${LOCAL_DATABASE_URL:-}"
  if [[ -z "$url" ]]; then url=$(read_env_value DATABASE_URL "$BACKEND/.env" || true); fi
  [[ -n "$url" ]] || die "Set LOCAL_DATABASE_URL (or DATABASE_URL in backend/.env)."
  local re='^postgres(ql)?://([^:@/]+)(:([^@]*))?@([^:/?]+)(:([0-9]+))?/([^?]+)(\?.*)?$'
  [[ "$url" =~ $re ]] || die "The local database URL is not postgresql://user:password@host:port/db."
  PGU_USER=${BASH_REMATCH[2]}
  PGU_PASS=${BASH_REMATCH[4]}
  PGU_HOST=${BASH_REMATCH[5]}
  PGU_PORT=${BASH_REMATCH[7]:-5432}
  SOURCE_DB=${BASH_REMATCH[8]}
  case "$SOURCE_DB" in
    "$RELEASE_DB" | "$PROBE_DB" | postgres | template0 | template1)
      die "The source database cannot be $SOURCE_DB." ;;
  esac
}

# URL for another database on the local server (no query string: psql rejects ?schema=).
local_url() { printf 'postgresql://%s:%s@%s:%s/%s' "$PGU_USER" "$PGU_PASS" "$PGU_HOST" "$PGU_PORT" "$1"; }
sql_local() { local db=$1; shift; "${PSQL[@]}" -d "$(local_url "$db")" "$@"; }

# ── pg_dump / pg_restore: host binaries or the server's own container ───────

TOOL_MODE=""
PG_CONTAINER_ID=""

select_pg_tools() { # required major
  local need=$1 have
  if [[ -n "${PG_BIN:-}" ]]; then
    have=$("$PG_BIN/pg_dump" --version | major_of)
    (( have >= need )) || die "PG_BIN pg_dump is $have; need >= $need."
    TOOL_MODE=host; PG_DUMP_BIN="$PG_BIN/pg_dump"; PG_RESTORE_BIN="$PG_BIN/pg_restore"
  elif command -v pg_dump >/dev/null 2>&1 && have=$(pg_dump --version | major_of) && (( have >= need )); then
    TOOL_MODE=host; PG_DUMP_BIN=pg_dump; PG_RESTORE_BIN=pg_restore
  else
    command -v docker >/dev/null 2>&1 || die "Host pg_dump is older than $need and docker is not available. Set PG_BIN."
    PG_CONTAINER_ID=${PG_CONTAINER:-$(docker compose -f "$ROOT/docker-compose.yml" ps -q db 2>/dev/null || true)}
    [[ -n "$PG_CONTAINER_ID" ]] || die "Host pg_dump is older than $need and the compose service 'db' is not running. Set PG_BIN or PG_CONTAINER."
    have=$(docker exec "$PG_CONTAINER_ID" pg_dump --version | major_of)
    (( have >= need )) || die "Container pg_dump is $have; need >= $need."
    TOOL_MODE=docker
  fi
  log "pg_dump/pg_restore: ${TOOL_MODE}$( [[ $TOOL_MODE == docker ]] && printf ' (container %s)' "$(docker inspect -f '{{.Name}}' "$PG_CONTAINER_ID" | tr -d /)")"
}

# The container must serve the same cluster as LOCAL_DATABASE_URL, not a look-alike.
assert_container_is_local_server() {
  [[ $TOOL_MODE == docker ]] || return 0
  local q="SELECT pg_postmaster_start_time()::text || '/' || (SELECT oid FROM pg_database WHERE datname = current_database())"
  local outside inside
  outside=$(sql_local "$SOURCE_DB" -Atc "$q")
  inside=$(PGPASSWORD="$PGU_PASS" docker exec -e PGPASSWORD "$PG_CONTAINER_ID" psql -X -q -At -U "$PGU_USER" -d "$SOURCE_DB" -c "$q")
  [[ "$outside" == "$inside" ]] || die "Container $PG_CONTAINER_ID is not the server behind the local URL."
}

# Docker mode works on real files inside the container (docker cp in and out), never on
# pipes: an archive written to a pipe has no data offsets and cannot be read out of order.
CONTAINER_TMP="/tmp/thekra-release-$$"
container_put() { docker exec "$PG_CONTAINER_ID" mkdir -p "$CONTAINER_TMP"; docker cp -q "$1" "$PG_CONTAINER_ID:$CONTAINER_TMP/$2"; }
container_get() { docker cp -q "$PG_CONTAINER_ID:$CONTAINER_TMP/$1" "$2"; }
container_rm() { docker exec "$PG_CONTAINER_ID" rm -f "$CONTAINER_TMP/$1"; }

dump_local() { # db outfile [pg_dump args...]
  local db=$1 out=$2; shift 2
  if [[ $TOOL_MODE == host ]]; then
    "$PG_DUMP_BIN" --format=custom --no-owner --no-acl "$@" -d "$(local_url "$db")" -f "$out"
  else
    docker exec "$PG_CONTAINER_ID" mkdir -p "$CONTAINER_TMP"
    PGPASSWORD="$PGU_PASS" docker exec -e PGPASSWORD "$PG_CONTAINER_ID" \
      pg_dump --format=custom --no-owner --no-acl "$@" -U "$PGU_USER" -d "$db" -f "$CONTAINER_TMP/out.dump"
    container_get out.dump "$out"
    container_rm out.dump
  fi
}

schema_text_local() { # db → normalised schema-only SQL on stdout
  local db=$1
  if [[ $TOOL_MODE == host ]]; then
    "$PG_DUMP_BIN" --schema-only --no-owner --no-acl -d "$(local_url "$db")"
  else
    PGPASSWORD="$PGU_PASS" docker exec -e PGPASSWORD "$PG_CONTAINER_ID" \
      pg_dump --schema-only --no-owner --no-acl -U "$PGU_USER" -d "$db"
  fi | grep -vE '^(--|\\restrict |\\unrestrict |SELECT pg_catalog\.set_config|$)'
}

restore_local() { # db dumpfile [pg_restore args...]
  local db=$1 file=$2; shift 2
  if [[ $TOOL_MODE == host ]]; then
    "$PG_RESTORE_BIN" "$@" -d "$(local_url "$db")" "$file"
  else
    container_put "$file" in.dump
    PGPASSWORD="$PGU_PASS" docker exec -e PGPASSWORD "$PG_CONTAINER_ID" \
      pg_restore "$@" -U "$PGU_USER" -d "$db" "$CONTAINER_TMP/in.dump"
    container_rm in.dump
  fi
}

restore_to_stdout() { # dumpfile [pg_restore args...]: archive → SQL text, no database involved
  local file=$1; shift
  if [[ $TOOL_MODE == host ]]; then
    "$PG_RESTORE_BIN" "$@" -f - "$file"
  else
    container_put "$file" read.dump
    docker exec "$PG_CONTAINER_ID" pg_restore "$@" -f - "$CONTAINER_TMP/read.dump"
    container_rm read.dump
  fi
}

restore_neon() { # dumpfile [pg_restore args...]; the URL travels only in the environment
  local file=$1; shift
  if [[ $TOOL_MODE == host ]]; then
    "$PG_RESTORE_BIN" "$@" -d "$NEON_DATABASE_URL" "$file"
  else
    container_put "$file" push.dump
    docker exec -e NEON_DATABASE_URL "$PG_CONTAINER_ID" \
      sh -c 'exec pg_restore "$@" -d "$NEON_DATABASE_URL"' pg_restore "$@" "$CONTAINER_TMP/push.dump"
    container_rm push.dump
  fi
}

# ── Migrations in the repo ─────────────────────────────────────────────────

repo_migration_lines() {
  local dir
  for dir in "$MIGRATIONS_DIR"/*/; do
    [[ -f "$dir/migration.sql" ]] || continue
    printf '%s:%s\n' "$(basename "$dir")" "$(sha256_of "$dir/migration.sql")"
  done | LC_ALL=C sort
}
# Same value as verify.sql's migrations.digest when the database matches the repo.
repo_migrations_digest() { repo_migration_lines | paste -sd, - | tr -d '\n' | md5_stdin; }
repo_migrations_count() { repo_migration_lines | wc -l | tr -d ' '; }

# ── Verification ───────────────────────────────────────────────────────────

run_verify() { # url outfile
  "${PSQL[@]}" -At -F'|' -d "$1" -c 'SET default_transaction_read_only = on' -f "$VERIFY_SQL" \
    | LC_ALL=C sort -t'|' -k1,1 > "$2"
  [[ -s "$2" ]] || die "verify.sql returned nothing."
}

# compare_verify <mode build|push> <left label> <left file> <right label> <right file>
# Prints every check side by side and returns 1 when any check fails.
compare_verify() {
  local mode=$1 left_label=$2 left=$3 right_label=$4 right=$5
  local repo_digest repo_count failures=0 key a b status
  repo_digest=$(repo_migrations_digest)
  repo_count=$(repo_migrations_count)
  printf '%-58s %-34s %-34s %s\n' "check" "$left_label" "$right_label" "result"
  while IFS='|' read -r key a b; do
    status=ok
    case "$key" in
      private.*) [[ "$b" == 0 ]] || status=FAIL ;;
      schema.exists.*) [[ "$a" == "$b" && "$b" == 1 ]] || status=FAIL ;;
      migrations.digest)
        if [[ $mode == build ]]; then [[ "$b" == "$repo_digest" ]] || status=FAIL
        else [[ "$a" == "$b" && "$b" == "$repo_digest" ]] || status=FAIL; fi ;;
      migrations.count)
        if [[ $mode == build ]]; then [[ "$b" == "$repo_count" ]] || status=FAIL
        else [[ "$a" == "$b" && "$b" == "$repo_count" ]] || status=FAIL; fi ;;
      *) [[ "$a" == "$b" ]] || status=FAIL ;;
    esac
    [[ $status == ok ]] || failures=$((failures + 1))
    printf '%-58s %-34s %-34s %s\n' "$key" "${a:0:34}" "${b:0:34}" "$status"
  done < <(LC_ALL=C join -t'|' -a1 -a2 -e '<missing>' -o 0,1.2,2.2 "$left" "$right")
  printf '%-58s %-34s %-34s\n' "(repo) migrations" "" "$repo_count / $repo_digest"
  (( failures == 0 ))
}

# ANALYZE the app's tables only. A bare ANALYZE also visits system catalogs, which a
# non-superuser owner (as on Neon) may not analyze, and warns for each one.
analyze_public() { # url
  printf '%s\n' "SELECT 'ANALYZE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') FROM pg_tables WHERE schemaname = 'public' \\gexec" \
    | "${PSQL[@]}" -d "$1"
}

verify_value() { awk -F'|' -v k="$2" '$1 == k { print $2; exit }' "$1"; }

# ── API smoke test against thekra_release ──────────────────────────────────

free_port() {
  local port
  for port in $(seq 3190 3290); do
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then printf '%s' "$port"; return 0; fi
  done
  die "No free port in 3190-3290."
}

# check_endpoint <path> <node expression over j that must be true> <summary expression>
check_endpoint() {
  local path=$1 test=$2 summary=$3 code
  code=$(curl -sS -o "$WORK/response.json" -w '%{http_code}' "http://127.0.0.1:$API_PORT$path") || code=000
  if [[ "$code" != 200 ]]; then
    die "GET $path → HTTP $code (API log: $WORK/api.log kept until exit)
$(tail -n 20 "$WORK/api.log")"
  fi
  node -e '
    const fs = require("node:fs");
    const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const pass = Function("j", "return (" + process.argv[2] + ");")(j);
    const text = Function("j", "return (" + process.argv[3] + ");")(j);
    console.log(`  GET ${process.argv[4]} → 200 ${text}`);
    process.exit(pass ? 0 : 1);
  ' "$WORK/response.json" "$test" "$summary" "$path" || die "GET $path returned 200 without the expected data."
}

api_total() { node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).meta.total)' "$WORK/response.json"; }

smoke_test_api() { # release verify file
  local verify=$1 waited=0 total expected
  [[ -f "$BACKEND/dist/main.js" ]] || die "backend/dist/main.js is missing. Run: pnpm --filter backend build"
  command -v node >/dev/null 2>&1 || die "node is not on PATH."
  API_PORT=$(free_port)
  local env_file_flag=()
  [[ -f "$BACKEND/.env" ]] && env_file_flag=(--env-file=.env)
  log "Starting the API on :$API_PORT against $RELEASE_DB"
  # Variables set here win over backend/.env (node --env-file never overrides the environment).
  (
    cd "$BACKEND"
    exec env DATABASE_URL="$(local_url "$RELEASE_DB")" DIRECT_URL="$(local_url "$RELEASE_DB")" \
      PORT="$API_PORT" SYNC_ENABLED=false node ${env_file_flag[@]+"${env_file_flag[@]}"} dist/main.js
  ) > "$WORK/api.log" 2>&1 &
  API_PID=$!
  until curl -fsS -o /dev/null "http://127.0.0.1:$API_PORT/health" 2>/dev/null; do
    kill -0 "$API_PID" 2>/dev/null || die "The API exited during start-up:
$(tail -n 30 "$WORK/api.log")"
    (( waited < 60 )) || die "The API did not answer /health within 60 s."
    sleep 1; waited=$((waited + 1))
  done

  check_endpoint "/health" 'j.data && j.data.status === "ok"' '`status=${j.data.status} version=${j.data.version}`'
  check_endpoint "/health/ready" 'j.data && j.data.checks && j.data.checks.database === "up"' '`database=${j.data.checks.database}`'

  check_endpoint "/v1/sins?limit=1&lang=ar" 'Array.isArray(j.data) && j.data.length > 0' \
    '`total=${j.meta.total} first=${j.data[0].slug} (${j.data[0].nameAr}) quoteCount=${j.data[0].quoteCount}`'
  total=$(api_total); expected=$(verify_value "$verify" content.public.sins_listed)
  [[ "$total" == "$expected" ]] || die "/v1/sins total $total ≠ SQL content.public.sins_listed $expected"

  check_endpoint "/v1/good-deeds/dhikr/quotes?limit=1&lang=ar" 'Array.isArray(j.data.items) && j.data.items.length > 0' \
    '`total=${j.meta.total} countsByKind=${JSON.stringify(j.meta.countsByKind)} first=${j.data.items[0].quote.type}`'
  total=$(api_total)
  expected=0
  for part in verses hadith athar other; do
    expected=$((expected + $(verify_value "$verify" "content.topic.deed.dhikr.$part")))
  done
  [[ "$total" == "$expected" ]] || die "dhikr quotes total $total ≠ SQL $expected"

  check_endpoint "/v1/sources?limit=5" 'Array.isArray(j.data) && j.data.length === 5' \
    '`total=${j.meta.total} first=${j.data.map((s) => s.name).slice(0, 2).join(" | ")}`'
  total=$(api_total); expected=$(verify_value "$verify" content.public.sources_canonical)
  [[ "$total" == "$expected" ]] || die "/v1/sources total $total ≠ SQL content.public.sources_canonical $expected"

  kill "$API_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
  API_PID=""
  ok "API answered from $RELEASE_DB and its totals match the SQL checks; stopped it."
}

# ── build ──────────────────────────────────────────────────────────────────

build() {
  parse_local_url
  command -v psql >/dev/null 2>&1 || die "psql is not on PATH."
  command -v pnpm >/dev/null 2>&1 || die "pnpm is not on PATH."
  [[ -f "$CLEAN_SQL" && -f "$VERIFY_SQL" ]] || die "Missing $CLEAN_SQL or $VERIFY_SQL."

  local server_major
  server_major=$(sql_local "$SOURCE_DB" -Atc "SELECT current_setting('server_version_num')::int / 10000")
  log "Source: $SOURCE_DB on $PGU_HOST:$PGU_PORT (PostgreSQL $server_major). It is only read."
  select_pg_tools "$server_major"
  assert_container_is_local_server

  WORK=$(mktemp -d "${TMPDIR:-/tmp}/thekra-release.XXXXXX")
  touch "$STAMP"           # from here on, any older dump counts as stale for push
  rm -f "$MANIFEST"

  log "1/8 pg_dump $SOURCE_DB"
  dump_local "$SOURCE_DB" "$WORK/source.dump"
  ok "source dump $(human_size "$(wc -c < "$WORK/source.dump")")"

  log "2/8 Recreate $RELEASE_DB and restore into it"
  local encoding collate ctype
  IFS='|' read -r encoding collate ctype < <(sql_local "$SOURCE_DB" -At -F'|' -c \
    "SELECT pg_encoding_to_char(encoding), datcollate, datctype FROM pg_database WHERE datname = current_database()")
  sql_local postgres -c "DROP DATABASE IF EXISTS $RELEASE_DB WITH (FORCE)"
  sql_local postgres -c "CREATE DATABASE $RELEASE_DB TEMPLATE template0 ENCODING '$encoding' LC_COLLATE '$collate' LC_CTYPE '$ctype'"
  restore_local "$RELEASE_DB" "$WORK/source.dump" --no-owner --no-acl --exit-on-error --single-transaction
  ok "restored"

  log "3/8 Clean ($CLEAN_SQL)"
  sql_local "$RELEASE_DB" --single-transaction -f "$CLEAN_SQL"
  ok "cleaned"

  log "4/8 Schema probe: fresh prisma migrate deploy into $PROBE_DB"
  sql_local postgres -c "DROP DATABASE IF EXISTS $PROBE_DB WITH (FORCE)"
  sql_local postgres -c "CREATE DATABASE $PROBE_DB TEMPLATE template0 ENCODING '$encoding' LC_COLLATE '$collate' LC_CTYPE '$ctype'"
  PROBE_CREATED=1
  if ! (cd "$BACKEND" && DATABASE_URL="$(local_url "$PROBE_DB")" DIRECT_URL="$(local_url "$PROBE_DB")" \
        pnpm exec prisma migrate deploy) > "$WORK/migrate.log" 2>&1; then
    cat "$WORK/migrate.log" >&2
    die "prisma migrate deploy failed on $PROBE_DB."
  fi
  schema_text_local "$RELEASE_DB" > "$WORK/schema.release.sql"
  schema_text_local "$PROBE_DB" > "$WORK/schema.migrations.sql"
  if ! diff -u "$WORK/schema.migrations.sql" "$WORK/schema.release.sql" > "$WORK/schema.diff"; then
    head -n 80 "$WORK/schema.diff" >&2
    die "The local schema differs from what the repo migrations create (diff above)."
  fi
  ok "schema identical to a fresh migrate deploy ($(wc -l < "$WORK/schema.release.sql" | tr -d ' ') lines)"
  # Production's _prisma_migrations must describe the repo's migration files, which is
  # what migrate deploy wrote on Neon. Copy the probe's rows over the local history.
  local cols='id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count'
  sql_local "$PROBE_DB" -c "\\copy (SELECT $cols FROM _prisma_migrations) TO '$WORK/migrations.copy'"
  sql_local "$RELEASE_DB" --single-transaction -c 'TRUNCATE _prisma_migrations' \
    -c "\\copy _prisma_migrations ($cols) FROM '$WORK/migrations.copy'"
  sql_local postgres -c "DROP DATABASE IF EXISTS $PROBE_DB WITH (FORCE)"
  PROBE_CREATED=0
  ok "_prisma_migrations = $(repo_migrations_count) rows as written by migrate deploy"
  analyze_public "$(local_url "$RELEASE_DB")"

  log "5/8 Verify $SOURCE_DB ↔ $RELEASE_DB"
  run_verify "$(local_url "$SOURCE_DB")" "$WORK/verify.source.txt"
  run_verify "$(local_url "$RELEASE_DB")" "$WORK/verify.release.txt"
  compare_verify build "$SOURCE_DB" "$WORK/verify.source.txt" "$RELEASE_DB" "$WORK/verify.release.txt" \
    || die "Verification failed (rows marked FAIL above)."
  ok "all checks pass"

  log "6/8 API smoke test"
  smoke_test_api "$WORK/verify.release.txt"

  log "7/8 pg_dump $RELEASE_DB → $DUMP"
  dump_local "$RELEASE_DB" "$DUMP.partial"
  local toc
  toc=$(restore_to_stdout "$DUMP.partial" -l)
  grep -q 'EXTENSION - pg_trgm' <<< "$toc" || die "The dump has no pg_trgm extension entry."
  grep -q 'FUNCTION public thekra_normalize_ar(text)' <<< "$toc" || die "The dump has no thekra_normalize_ar function."
  local leaks statuses
  set +e
  restore_to_stdout "$DUMP.partial" --data-only | LC_ALL=C grep -c -F -e '@thekra.local' -e '$argon2' > "$WORK/leaks"
  statuses="${PIPESTATUS[0]} ${PIPESTATUS[1]}"
  set -e
  [[ "${statuses%% *}" == 0 ]] || die "pg_restore could not read $DUMP.partial for the data scan."
  leaks=$(tr -d ' \n' < "$WORK/leaks")
  [[ "$leaks" == 0 ]] || die "The dump data still contains $leaks line(s) with @thekra.local or an argon2 hash."
  ok "dump has pg_trgm + thekra_normalize_ar; no @thekra.local and no password hash in its data"

  log "8/8 Finalise"
  mv -f "$DUMP.partial" "$DUMP"
  cp "$WORK/verify.release.txt" "$SNAPSHOT"
  local bytes dumped_by
  bytes=$(wc -c < "$DUMP" | tr -d ' ')
  dumped_by=$(restore_to_stdout "$DUMP" -l | sed -n 's/^;[[:space:]]*Dumped by pg_dump version: //p' | major_of)
  {
    printf 'built_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'source_db=%s\n' "$SOURCE_DB"
    printf 'server_major=%s\n' "$server_major"
    printf 'pg_dump_major=%s\n' "$dumped_by"
    printf 'dump_bytes=%s\n' "$bytes"
    printf 'dump_sha256=%s\n' "$(sha256_of "$DUMP")"
  } > "$MANIFEST"
  ok "$DUMP  $(human_size "$bytes") ($bytes bytes)"
  printf '  next: NEON_DATABASE_URL=<direct URL> %s push\n' "scripts/release-db.sh"
}

# ── push ───────────────────────────────────────────────────────────────────

manifest_value() { grep -E "^$1=" "$MANIFEST" | head -n 1 | cut -d= -f2-; }

push() {
  local assume_yes=$1

  # Refusals that need nothing but the environment and the files come first.
  if [[ -z "${NEON_DATABASE_URL:-}" ]]; then
    die "NEON_DATABASE_URL is not set. Export Neon's direct (non-pooler) connection string; it is never printed."
  fi
  case "$NEON_DATABASE_URL" in
    *-pooler* | *pgbouncer=true*)
      die "NEON_DATABASE_URL points at the pooled endpoint (-pooler). pg_restore needs the direct host: remove '-pooler' from the hostname." ;;
    postgres://* | postgresql://*) ;;
    *) die "NEON_DATABASE_URL is not a postgresql:// URL." ;;
  esac
  [[ -f "$DUMP" ]] || die "$DUMP does not exist. Run: scripts/release-db.sh build"
  [[ -f "$MANIFEST" && -f "$STAMP" ]] || die "No completed build recorded ($MANIFEST). Run: scripts/release-db.sh build"
  [[ "$DUMP" -nt "$STAMP" ]] || die "$DUMP is older than the last build start; that build did not finish. Run build again."
  [[ "$(sha256_of "$DUMP")" == "$(manifest_value dump_sha256)" ]] || die "$DUMP changed after the build (sha256 mismatch). Run build again."

  local target_host target_db
  target_host=$(printf '%s' "$NEON_DATABASE_URL" | sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#')
  target_db=$(printf '%s' "$NEON_DATABASE_URL" | sed -E 's#^[a-z]+://[^/]*/([^?]*).*#\1#')
  parse_local_url
  case "$target_host" in
    localhost | 127.0.0.1 | ::1 | "$PGU_HOST")
      case "$target_db" in
        "$SOURCE_DB" | "$RELEASE_DB") die "NEON_DATABASE_URL points at the local $target_db database. Refusing." ;;
      esac ;;
  esac

  command -v psql >/dev/null 2>&1 || die "psql is not on PATH."
  select_pg_tools "$(manifest_value pg_dump_major)"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/thekra-release.XXXXXX")

  log "Dump: $DUMP $(human_size "$(manifest_value dump_bytes)"), built $(manifest_value built_at)"
  log "Target: $target_host/$target_db"
  local neon_major neon_names repo_names neon_users neon_quotes
  neon_major=$("${PSQL[@]}" -d "$NEON_DATABASE_URL" -Atc "SELECT current_setting('server_version_num')::int / 10000") \
    || die "Cannot connect to NEON_DATABASE_URL."
  (( neon_major >= $(manifest_value server_major) )) \
    || die "Neon runs PostgreSQL $neon_major; the dump comes from $(manifest_value server_major). Use a project on >= $(manifest_value server_major)."
  [[ "$("${PSQL[@]}" -d "$NEON_DATABASE_URL" -Atc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" == t ]] \
    || die "Neon has no _prisma_migrations table. Deploy the API (prisma migrate deploy) first."
  neon_names=$("${PSQL[@]}" -d "$NEON_DATABASE_URL" -Atc \
    "SELECT string_agg(migration_name, ',' ORDER BY migration_name COLLATE \"C\") FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
  repo_names=$(repo_migration_lines | cut -d: -f1 | paste -sd, -)
  [[ "$neon_names" == "$repo_names" ]] \
    || die "Neon's applied migrations differ from backend/prisma/migrations. Deploy this commit's API first, then push."
  neon_users=$("${PSQL[@]}" -d "$NEON_DATABASE_URL" -Atc 'SELECT count(*) FROM "User"')
  neon_quotes=$("${PSQL[@]}" -d "$NEON_DATABASE_URL" -Atc 'SELECT count(*) FROM "Quote"')
  ok "Neon: PostgreSQL $neon_major, $(repo_migrations_count) migrations applied, currently $neon_quotes quotes and $neon_users users"
  if [[ "$neon_users" != 0 ]]; then
    warn "Neon has $neon_users user(s). The restore replaces every table: they will be deleted. Run admin:create afterwards."
  fi

  if [[ "$assume_yes" != 1 ]]; then
    [[ -r /dev/tty ]] || die "No terminal for the confirmation. Re-run with --yes to skip it."
    printf 'This replaces ALL data in %s/%s with the release dump.\nType PUSH to continue: ' "$target_host" "$target_db" > /dev/tty
    local answer
    IFS= read -r answer < /dev/tty || answer=""
    [[ "$answer" == PUSH ]] || die "Not confirmed. Nothing was changed."
  fi

  # One transaction: on any error Neon keeps what it had. pg_restore orders the
  # archive by dependency, so EXTENSION pg_trgm and thekra_normalize_ar are
  # created before the tables and the trigram indexes that use them.
  log "Restoring (--clean --if-exists --no-owner --no-acl, single transaction)"
  local started=$SECONDS
  restore_neon "$DUMP" --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error
  analyze_public "$NEON_DATABASE_URL"
  ok "restored in $((SECONDS - started)) s"

  log "Verify $RELEASE_DB ↔ Neon"
  local baseline="$SNAPSHOT" baseline_label="$RELEASE_DB (build)"
  if [[ "$(sql_local postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = '$RELEASE_DB'" 2>/dev/null || echo 0)" == 1 ]]; then
    run_verify "$(local_url "$RELEASE_DB")" "$WORK/verify.release.txt"
    if ! cmp -s "$WORK/verify.release.txt" "$SNAPSHOT"; then
      warn "$RELEASE_DB changed since the build; comparing Neon with the build-time snapshot instead."
    else
      baseline="$WORK/verify.release.txt"; baseline_label="$RELEASE_DB"
    fi
  else
    warn "$RELEASE_DB is gone; comparing Neon with the build-time snapshot $SNAPSHOT."
  fi
  run_verify "$NEON_DATABASE_URL" "$WORK/verify.neon.txt"
  compare_verify push "$baseline_label" "$baseline" "neon" "$WORK/verify.neon.txt" \
    || die "Neon does not match the release database (rows marked FAIL above)."
  ok "Neon matches the release database."
  printf '  next: DATABASE_URL=<Neon URL> ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm --filter backend admin:create\n'
}

# ── main ───────────────────────────────────────────────────────────────────

[[ $# -ge 1 ]] || usage
case "$1" in
  build)
    [[ $# -eq 1 ]] || usage
    build ;;
  push)
    case "${2:-}" in
      "") [[ $# -eq 1 ]] || usage; push 0 ;;
      --yes) [[ $# -eq 2 ]] || usage; push 1 ;;
      *) usage ;;
    esac ;;
  -h | --help) usage ;;
  *) usage ;;
esac
