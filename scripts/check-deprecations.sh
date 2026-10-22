#!/usr/bin/env bash
# Deprecation guard for the Thekra monorepo (backend · frontend · mobile).
#
#   1. Prints outdated packages per workspace: major gaps and packages marked deprecated.
#      Advisory only; it never changes the exit status.
#   2. Greps the repo for deprecated or removed API patterns (PATTERNS below).
#      Exit 1 only when a pattern matches outside ALLOWLIST; otherwise exit 0.
#
# Findings and migration notes: docs/build/DEPRECATIONS.md
# Run: `pnpm deprecations` (root) or `bash scripts/check-deprecations.sh`

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

# ── Deprecated / removed API patterns ───────────────────────────────────────
# Entry format: "id@@glob@@extended-regex". Each entry names the version that
# deprecates or removes the API; ids must stay unique.
PATTERNS=(
  # Prisma 7.0: `prisma-client-js` is superseded by `prisma-client` (deprecated in 7.x, removal announced).
  "prisma-generator-js@@*.prisma@@provider[[:space:]]*=[[:space:]]*\"prisma-client-js\""
  # Prisma 7.0: datasource `url` / `directUrl` / `shadowDatabaseUrl` move to prisma.config.ts (deprecated in the schema).
  "prisma-datasource-url@@*.prisma@@^[[:space:]]*(url|directUrl|shadowDatabaseUrl)[[:space:]]*=[[:space:]]*env[(]"
  # Prisma 7.0: PrismaClient needs a driver adapter; the `datasources` / `datasourceUrl` constructor options were removed.
  "prisma-client-no-adapter@@*.ts@@new PrismaClient[(]"
  # Zod 4.x: z.string().email() is @deprecated in installed zod 4.6.5 (use z.email()).
  "zod-string-email@@*.ts*@@z[.]string[(][)][.]email[(]"
  # Zod 4.x: z.string().uuid() is @deprecated in installed zod 4.6.5 (use z.uuid()).
  "zod-string-uuid@@*.ts*@@z[.]string[(][)][.]uuid[(]"
  # Next 16.0: `next lint` removed (use the ESLint CLI).
  "next-lint-script@@package.json@@\"lint\"[[:space:]]*:[[:space:]]*\"next lint\""
  # Next 16.0: `next/legacy/image` deprecated (use next/image).
  "next-legacy-image@@*.ts*@@next/legacy/image"
  # Next 16.0: `middleware` file/export deprecated (rename to proxy).
  "next-middleware-export@@*.ts*@@export (default )?(async )?function middleware[(]"
  # Next 16.0: serverRuntimeConfig / publicRuntimeConfig removed (use env vars).
  "next-runtime-config@@next.config.*@@(serverRuntimeConfig|publicRuntimeConfig)"
  # Next 16.0: revalidateTag single-argument form deprecated (pass a cacheLife profile).
  "next-revalidate-tag-1arg@@*.ts*@@revalidateTag[(][^,()]*[)]"
  # @types/helmet 4.0.0 is a stub deprecated on npm; helmet 8 ships its own types.
  "types-helmet-stub@@package.json@@\"@types/helmet\""
  # Vitest 5.0: vi.mock / vi.unmock / vi.hoisted must be top-level (throws otherwise).
  "vitest-nested-mock@@*.ts@@^[[:space:]]+vi[.](mock|unmock|hoisted)[(]"
  # TypeScript 6.0 deprecates moduleResolution node10 (removed in TypeScript 7.0; verify against the TS 7 notes).
  "ts-module-resolution-node10@@tsconfig*.json@@\"moduleResolution\"[[:space:]]*:[[:space:]]*\"node(10)?\""
  # TypeScript 6.0 deprecates ES3/ES5 targets (removed in TypeScript 7.0; verify against the TS 7 notes).
  "ts-target-es5@@tsconfig*.json@@\"target\"[[:space:]]*:[[:space:]]*\"(es3|es5)\""
)

# ── Known debt: matches accepted until the named migration lands ───────────
# Format: "id|path|max-matches". Documented in docs/build/DEPRECATIONS.md.
# A file with more matches than listed fails the check. Delete a line when its migration lands.
ALLOWLIST=(
  "prisma-generator-js|backend/prisma/schema.prisma|1"
  "prisma-datasource-url|backend/prisma/schema.prisma|2"
  "prisma-client-no-adapter|backend/src/common/text/arabic-search.spec.ts|1"
  "prisma-client-no-adapter|backend/prisma/seed.ts|1"
  "prisma-client-no-adapter|backend/prisma/imports/main.ts|1"
  "prisma-client-no-adapter|backend/prisma/imports/taxonomy/themes-report.ts|1"
  "prisma-client-no-adapter|backend/test/fixtures/seed-test-fixtures.ts|1"
  "zod-string-email|frontend/src/features/auth/components/LoginForm.tsx|1"
  "zod-string-email|frontend/src/features/auth/components/RegisterForm.tsx|1"
  "zod-string-uuid|frontend/src/features/curation/components/QuoteForm.tsx|1"
  "zod-string-uuid|frontend/src/features/curation/components/GoodDeedCrudView.tsx|1"
  "zod-string-uuid|frontend/src/features/curation/components/SyncConsoleView.tsx|1"
  "types-helmet-stub|backend/package.json|1"
)

# Directories and files that document or generate deprecated names, not call them.
EXCLUDES=(
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=dist
  --exclude-dir=build --exclude-dir=coverage --exclude-dir=test-results --exclude-dir=.corpus
  --exclude-dir=thekra-source --exclude-dir=docs --exclude-dir=.turbo --exclude-dir=out
  --exclude-dir=generated --exclude-dir=.cursor --exclude-dir=.interface-design
  --exclude='*.md' --exclude='*.mdc' --exclude='.cursorrules' --exclude='.env*'
  --exclude='*.tsbuildinfo' --exclude='pnpm-lock.yaml' --exclude='check-deprecations.sh'
)

allowance() {
  local want_id="$1" want_path="$2" entry
  for entry in "${ALLOWLIST[@]}"; do
    if [[ "$entry" == "$want_id|$want_path|"* ]]; then
      printf '%s' "${entry##*|}"
      return
    fi
  done
  printf '0'
}

echo "== 1. Outdated packages (pnpm outdated -r --format json) =="
status=0
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  pnpm not found on PATH; skipping outdated report"
else
  outdated_json="$(pnpm outdated -r --format json 2>/dev/null || true)"
  summary="$(printf '%s' "$outdated_json" | node -e '
    const fs = require("fs");
    const text = fs.readFileSync(0, "utf8");
    const start = text.search(/^\{/m);
    if (start < 0) process.exit(2);
    const data = JSON.parse(text.slice(start));
    const major = (v) => parseInt(String(v).replace(/^[^0-9]*/, ""), 10);
    const rows = [];
    let sameMajor = 0;
    // pnpm keys by package name: one version per name, even when workspaces differ.
    for (const [name, info] of Object.entries(data)) {
      const gap = major(info.latest) > major(info.current);
      if (!gap && info.latest !== info.current) sameMajor++;
      if (!gap && !info.isDeprecated) continue;
      const where = (info.dependentPackages || []).map((p) => p.name).join(", ");
      const tag = info.isDeprecated ? "DEPRECATED" : gap ? "MAJOR     " : "";
      // A prerelease "latest" (e.g. 8.1.0-dev.9) is not a stable upgrade target; say so.
      const pre = String(info.latest).includes("-") ? "  (prerelease: check the stable dist-tag)" : "";
      rows.push(`  ${tag.padEnd(10)} ${name}  ${info.current} -> ${info.latest}  [${where}]${pre}`);
    }
    console.log(rows.length ? rows.join("\n") : "  no major gaps or deprecated packages");
    console.log(`  (+ ${sameMajor} same-major update(s); run "pnpm outdated -r" for the full table)`);
  ' 2>/dev/null)"
  if [ $? -eq 0 ] && [ -n "$summary" ]; then
    printf '%s\n' "$summary"
  else
    echo "  JSON unavailable; plain output follows:"
    pnpm outdated -r 2>&1 | sed 's/^/  /' || true
  fi
fi

echo
echo "== 2. Deprecated API patterns (${#PATTERNS[@]} patterns) =="
for entry in "${PATTERNS[@]}"; do
  id="${entry%%@@*}"
  rest="${entry#*@@}"
  glob="${rest%%@@*}"
  re="${rest#*@@}"

  matches="$(grep -rEn "${EXCLUDES[@]}" --include="$glob" -e "$re" . 2>/dev/null | sed 's#^\./##' || true)"
  [ -z "$matches" ] && continue

  while read -r count file; do
    [ -z "$file" ] && continue
    allowed="$(allowance "$id" "$file")"
    if [ "$count" -gt "$allowed" ]; then
      echo "  FAIL [$id] $file: $count match(es), allowlisted $allowed"
      printf '%s\n' "$matches" | grep -F "$file:" | sed 's/^/        /'
      status=1
    else
      echo "  debt [$id] $file: $count match(es), allowlisted"
    fi
  done < <(printf '%s\n' "$matches" | cut -d: -f1 | sort | uniq -c)
done

echo
if [ "$status" -eq 0 ]; then
  echo "PASS: no deprecated API pattern outside the allowlist."
else
  echo "FAIL: deprecated API pattern(s) found outside the allowlist. See docs/build/DEPRECATIONS.md."
fi
exit "$status"
