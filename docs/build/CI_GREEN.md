# CI green: what failed, what was fixed, what was proven

Baseline: commit `011dd57`, run <https://github.com/Akhera-Plants/Thekra/actions/runs/39700633923>.
Reported there: `lint`, `rtl-lint`, `i18n-parity`, `design-tokens` pass; `prisma` fails at «Migration drift check»;
every job that `needs: [prisma]` is skipped; `mobile-release.yml` fails on every push.

All local runs: macOS, Node **v22.19.0**, pnpm 11.7.0, Postgres 16.13 (Alpine), Prisma 6.19.3.
CI runs Node **24** on `ubuntu-latest`; see «Not proven locally» at the end.

## Where the checks were run, and why

- **Clean clone** (`git clone` of `011dd57` into `/tmp`, plus this change's diff, byte-identical to the
  working tree). The real checkout has gitignored files CI does not get (`backend/.env`, `backend/.env.test`,
  `frontend/.env`, `backend/.corpus/`, `next-env.d.ts`, `expo-env.d.ts`, old `dist/` and `.next/`). Two of
  the failures below were invisible in the real checkout because of them. Every CI job was replayed here,
  in workflow order, with the workflow's commands and env (database names swapped for scratch databases).
- **Case-sensitive APFS volume**: a second clone on a case-sensitive disk image, because the runner's
  filesystem is case-sensitive and macOS's is not. typecheck, unit tests, both builds and mobile-check
  were rerun there.
- **Real checkout**: the drift check, both `tsc`, both unit test suites, `pnpm deprecations`.
  The builds and the e2e suite were **not** run in place: `next dev` and a detached `node dist/main`
  were serving from `frontend/` and `backend/` (`nest build` has `deleteOutDir: true`), and the e2e
  global setup always migrates the `thekra_test` named in `backend/.env.test`. They were run in the clone.
- Databases: only scratch databases (`thekra_ci_*`), all dropped afterwards. `thekra`, `thekra_test`,
  `thekra_shadow`, `thekra_shadow_check` were not written to. Disclosure: `src/common/text/arabic-search.spec.ts`
  runs `SELECT thekra_normalize_ar($1)` (read-only, 10 queries) whenever `DATABASE_URL` is set. That
  happened against `thekra` in local unit runs: Prisma 6's client loads `backend/.env` when it is imported.

## Jobs

| Job | Before | After (local) | Changed |
|---|---|---|---|
| lint | pass | pass (0 errors; warnings only) | — |
| prisma | **fail** (drift) | pass | `backend/prisma/schema.prisma` |
| typecheck | skipped | pass | — |
| test-unit | skipped | pass, after 2 fixes | `ci.yml`, 2 spec files |
| test-e2e | skipped | pass (18 files, 282 tests) | — |
| design-tokens | «pass» (never ran) | pass, now real | `ci.yml`, `globals.css`, `site-public.css` |
| rtl-lint | «pass» (never ran) | pass, now real | `ci.yml` |
| i18n-parity | pass | pass (731 keys) | — |
| build | skipped | pass | — |
| mobile-check | skipped | pass (2 suites, 13 tests) | — |
| mobile-release.yml | **fail** every push | valid YAML; runs only on `mobile-v*` tags / manual | `mobile-release.yml` |

### prisma — «Migration drift check»

Command (as in `ci.yml`, in `backend/`):
`pnpm exec prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code`

- Before: `[*] Changed the ReferenceHadith table / [-] Removed index on columns (normalizedMatn)`, exit 2.
- Cause: `prisma/migrations/20261011180000_add_takhrij_and_flags/migration.sql:43` creates
  `ReferenceHadith_normalizedMatn_trgm_idx` (`USING GIN ("normalizedMatn" gin_trgm_ops)`); the schema never declared it.
- Fix: declared the index on `model ReferenceHadith`:
  `@@index([normalizedMatn(ops: raw("gin_trgm_ops"))], map: "ReferenceHadith_normalizedMatn_trgm_idx", type: Gin)`.
- How the syntax was established: Prisma 6.19.3 ships no prose docs, so the installed engine was the
  authority. Migrations were applied to a scratch DB and `prisma db pull --print` printed exactly that line,
  with no preview feature and no `extensions` block. `pg_trgm` is created by the migration itself; without the
  `postgresqlExtensions` preview feature, Prisma does not diff extensions. The Prisma 7 docs list `type: Gin`,
  `ops: raw("…")` and `map:` as current, non-preview syntax:
  <https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes.md>. So nothing is deprecated in
  the next major and `DEPRECATIONS.md` needs no entry.
- After: `No difference detected.`, exit 0.
- `prisma migrate dev --create-only` on a fresh scratch DB wrote
  `prisma/migrations/20261022004050_ci_drift_probe/migration.sql` containing only `-- This is an empty migration.`
  (`--create-only` always writes a file; empty means no schema change). **That file was deleted.** Plain
  `prisma migrate dev` then printed `Already in sync, no schema change or pending migration was found.` and
  wrote nothing. Control: the same `--create-only` run against the pre-fix schema produced
  `DROP INDEX "ReferenceHadith_normalizedMatn_trgm_idx";` (written as `20261022004113_ci_drift_probe_prefix`,
  **also deleted**). No migration files remain from this work.
- `prisma validate` / `prisma generate`: pass.
- Unrelated, not changed: `prisma format --check` already reports the schema as unformatted on `011dd57`.
  CI does not run it.

### test-unit — two failures hidden by the local checkout

1. **Corpus specs read gitignored files.** `prisma/imports/adhkar/parse.spec.ts` and
   `prisma/imports/ibn-abi-dunya/parse.spec.ts` read `backend/.corpus/…` unconditionally. In a clean clone:
   `ENOENT … .corpus/0676Nawawi.Adhkar.Shamela0001956-ara1`, 2 failed files. The corpus cannot be shipped:
   `backend/.gitignore` marks it «CC BY-NC-SA 4.0 — never commit».
   Fix: those tests run only when their pinned file exists, the convention `sahihayn/parse.spec.ts:87` and
   `tafsir/ashur.spec.ts:39` already follow. They use `describe.skipIf` / `it.skipIf` (vitest 4.1.11), so CI
   reports them as **skipped** instead of passing. No assertion changed. The corpus-free
   `normalizeHeadingTitle` test moved into its own `describe` so it still runs everywhere. Where the
   corpus is present (the real checkout), all 6 tests in the two files run and pass.
2. **DB parity suite in a job with no database.** `src/common/text/arabic-search.spec.ts` runs whenever
   `DATABASE_URL` is non-empty (its header: «skipped when DATABASE_URL is not set so they don't break CI»).
   `011dd57` added `DATABASE_URL` at workflow level for the Prisma CLI, and `test-unit` has no Postgres
   service. Reproduced with an unreachable URL: `PrismaClientInitializationError: Can't reach database server`.
   Fix: the `pnpm --filter backend test` step sets `DATABASE_URL: ''`. A workflow-level variable cannot be
   unset per step, and `prisma generate` in the step before still needs the URL. If you want the parity
   suite to run in CI, add a Postgres service plus `prisma migrate deploy` to this job instead.

Result (clean clone, no DB reachable): `Test Files 71 passed | 2 skipped (73)`, `Tests 586 passed | 15 skipped (601)`.

### design-tokens and rtl-lint — passed without running

Both jobs call `rg`, but the `ubuntu-latest` (24.04) image does not ship ripgrep
(<https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md>).
`if rg …; then` treats exit 127 like «no match», so both jobs went green without checking anything.

- Fix (`ci.yml`): an `Install ripgrep` step (`sudo apt-get update && sudo apt-get install -y ripgrep`). Each check
  now captures rg's exit code: 0 (a match) fails, 1 (no match) passes, anything else fails as an rg error.
  The step scripts, extracted from the YAML and run under `bash --noprofile --norc -eo pipefail`: clean tree → 0;
  `rg` missing from PATH → 127 (fails); injected `#123456` / `ml-2` → 1 (fails).
- With a real `rg`, **rtl-lint** was already clean. **design-tokens** failed on
  `frontend/src/app/site-public.css` lines 36, 55, 72, 73, 75 (13 literals, 7 values).
  Fix: the 7 values moved verbatim into `:root` in `frontend/src/app/globals.css` as `--pathway-shadow`,
  `--pathway-flourish`, `--pathway-return-ink`, `--pathway-return-cta`, `--pathway-return-cta-ink`,
  `--pathway-return-cta-border`, `--pathway-return-cta-hover`, and `site-public.css` uses `var(…)` instead.
  They are not overridden in `.dark`, matching the literals, so computed colours are unchanged in both themes.
  No visual change, but not checked in a browser.

### Other jobs (no change needed)

- lint: `pnpm --filter backend lint` → `0 errors` (29 warnings; 41 when run before `prisma generate`, as the
  CI lint job does); `pnpm --filter frontend lint` → `0 errors, 1 warning`.
- typecheck: `pnpm prisma:generate`, `pnpm --filter backend exec tsc --noEmit -p tsconfig.json`,
  `pnpm --filter frontend exec next typegen`, `pnpm --filter frontend exec tsc --noEmit` → all exit 0.
- test-e2e: fresh scratch DB, `backend/.env.test` written exactly as the workflow writes it,
  `pnpm exec prisma migrate deploy` → «All migrations have been successfully applied.»,
  `pnpm --filter backend test:e2e` → `Test Files 18 passed (18)`, `Tests 282 passed (282)`.
- i18n-parity: `node scripts/check-i18n-keys.mjs` → `i18n keys OK (731 keys)`.
- build: `pnpm --filter backend build` → exit 0; `pnpm --filter frontend build` → exit 0, 48/48 static pages.
  Locally `:3001` is taken by a running backend, which CI does not have. So the frontend build was
  also run with `NEXT_PUBLIC_API_URL` pointing at a closed port, to match CI's «nothing listening»; it passed.
- mobile-check: `pnpm --filter mobile exec tsc --noEmit` → exit 0 (no `expo-env.d.ts`, as in CI);
  `pnpm --filter mobile test` → `2 passed`, `13 passed`.
- `pnpm deprecations` → exit 0, «PASS: no deprecated API pattern outside the allowlist.» The `MAJOR` rows
  are existing outdated-major reports. No deprecation warning appeared in any build, test or lint log.
- `pnpm --filter frontend test` (not a CI job) → `10 passed`, `40 passed`.

### mobile-release.yml — failed on every push

Cause: lines 3–11 were prose, not comments, so the file was invalid YAML («mapping values are not
allowed in this context at line 7 column 9»). GitHub reports an unparseable workflow as a failed run on every push,
whatever its `on:` says. It did not fail because of missing secrets.
Fix: those lines are now `#` comments. Both workflow files now parse. The triggers were already what they should be:
`push: tags: ['mobile-v*']` and `workflow_dispatch`, and a `gate` job skips the build when `EXPO_TOKEN` is
absent. So it no longer runs on branch pushes, and on a tag without the secret it ends green with the build
skipped. The trigger was left unchanged. Mobile is not deployed, and no Expo account or secret was
used or faked. `mobile/RELEASE.md` lists the owner steps that unlock it.

## Not proven locally

- **Node 24.** No Node 24 binary on this machine. Every result above is from Node 22.19.0 (pnpm warns
  `Unsupported engine: wanted >=24`). Next.js build, vitest, jest-expo, Nest build and the Prisma engines
  on Node 24 are unproven until CI runs.
- **GitHub-hosted runner specifics.** The `apt-get install ripgrep` step needs network and gives
  ripgrep 14.x (local: 15.1.0); the two patterns use no feature that differs between them. `ubuntu-latest`
  moves to 26.04 in November 2026; the step still applies there. `actionlint` was not available, so
  workflow syntax was checked only by YAML parsing.
- **Linux itself.** Case sensitivity was covered with a case-sensitive APFS volume. Anything else
  Linux-specific (Prisma's Linux engine binaries, `psql` on the runner, service-container networking) was not.
- **Anything needing secrets.** `mobile-release.yml`'s `build` job (`EXPO_TOKEN`, `EAS_PROJECT_ID`, EAS Build)
  was not run; only its gate logic was read.
- **The pushed run.** The workflow needs to run on GitHub to confirm all of the above.
