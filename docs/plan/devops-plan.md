# Thekra — DevOps Plan

> Scope: environments, CI, deployment, database migrations, secrets, health checks and rollback for the
> monorepo. Recommendations are **recommendations, not commitments** — every hosting choice below is reversible
> and flagged as such.
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [backend-plan.md](./backend-plan.md) ·
> [frontend-plan.md](./frontend-plan.md) · [content-pipeline-plan.md](./content-pipeline-plan.md) ·
> [roadmap.md](./roadmap.md)

---

## 0. Repo facts this plan must respect

| Fact | Consequence |
| --- | --- |
| **pnpm 11.7.0** workspace ([`pnpm-workspace.yaml`](../../pnpm-workspace.yaml): `backend`, `frontend`) | CI uses `pnpm/action-setup` with the version read from `packageManager`, and `pnpm install --frozen-lockfile`. `mobile` joins the workspace only in phase 7 ([mobile-plan](./mobile-plan.md)). |
| `pnpm-workspace.yaml` has an **`allowBuilds`** allow-list (`@prisma/client`, `@prisma/engines`, `prisma`, `esbuild`, `unrs-resolver`, `workerd`) | pnpm ≥ 10 blocks install scripts by default. If a CI install fails with "ignored build scripts", the fix is **adding the package to `allowBuilds`**, not `--no-strict-peer-dependencies` or disabling the check. |
| `engines.node >= 24` (root [`package.json`](../../package.json)) | Node **24** in CI and in every runtime image. A Node 20 runner will install fine and fail subtly. |
| Backend is ESM with `"type": "module"`; build output is `dist/` via `nest build`, started with `node dist/main` | The production image runs `node dist/main.js`-style entry per Nest's output — verify the emitted filename once and pin the start command. |
| Backend lint = **oxlint** (`pnpm --filter backend lint`); frontend lint = **ESLint 9** (`pnpm --filter frontend lint`) | Two different lint jobs; do not try to unify them in CI. |
| Tests = **Vitest** (`test`, `test:e2e` with [`vitest.config.e2e.ts`](../../backend/vitest.config.e2e.ts)) | Separate CI steps; e2e needs a live Postgres service container. |
| Root scripts already exist: `prisma:validate`, `prisma:generate`, `dev:backend`, `dev:frontend` | CI calls the **root** scripts so local and CI commands match. |
| [`docker-compose.yml`](../../docker-compose.yml) runs `postgres:16-alpine`, db/user `thekra`, port `5432` | Local parity: **Postgres 16** in CI and in every hosted environment. |
| `.gitignore` already ignores `.env`, `.env.local`, `.env.*.local`, `dist/`, `.next/`, `coverage/` | Secrets are already protected; `backend/.env` exists locally and is correctly untracked. |
| **No `.github/` directory exists yet** | Everything in §2 is new work, created in phase 2. |
| **The project is not a git repository yet** (`git status` → *not a git repository*) | `git init` + the first commit + a remote are a prerequisite for §2. Flag this: CI cannot exist before the repo does. |
| `backend/.env.example` `PORT=3000` collides with `next dev` on 3000 | **Action, phase 2:** backend `PORT=3001`; `frontend/.env.example` → `NEXT_PUBLIC_API_URL="http://localhost:3001"`. One commit, both files. |

---

## 1. Environments

Three environments, identical in shape, differing only in configuration.

| | **local** | **staging** | **production** |
| --- | --- | --- | --- |
| Purpose | Development; the only place the dev seed runs | Pre-release verification, realistic data volumes, where sync jobs are first enabled against real providers | Real users |
| Postgres | `docker compose up -d db` — `postgres:16-alpine` | Managed Postgres 16 on the host platform | Managed Postgres 16, automated daily backups + PITR |
| Backend | `pnpm dev:backend` (watch, port **3001**) | 1 instance, auto-deploy from `main` | 1–2 instances, deploy on tag/release |
| Frontend | `pnpm dev:frontend` (port 3000) | Vercel preview/staging deployment | Vercel production |
| Migrations | `prisma migrate dev` | `prisma migrate deploy` (automatic, pre-start) | `prisma migrate deploy` (gated, pre-release) |
| Seed | **Yes** ([content-pipeline-plan §5](./content-pipeline-plan.md#5-development-seed-plan-prismaseedts)) | Once, to bootstrap; then real curated content | **Never** — guarded by the `NODE_ENV` check in the seed |
| `SYNC_ENABLED` | `false` | `true` (this is where provider integration is proven) | `true` |
| Provider API keys | optional; adapters refuse to run without them rather than failing mid-run | real keys, separate from production where the provider allows it | real keys |
| Log level / format | `debug`, `pino-pretty` | `info`, JSON | `info`, JSON |
| CORS origins | `http://localhost:3000` | the staging frontend origin | the production frontend origin only |

Staging exists mainly for two risky things that cannot be rehearsed locally: **migrations against a populated
database** and **real external-provider behaviour** (auth, rate limits, payload drift). Both are the pipeline's
highest-variance areas.

### 1.1 Local onboarding (unchanged, just confirmed)

The flow in [README.md](../../README.md) already works: `pnpm install` → `docker compose up -d db` →
`cp backend/.env.example backend/.env` → `pnpm prisma:generate` → `prisma migrate dev --name init`. Phase 2 adds
one step — `cp frontend/.env.example frontend/.env.local` — and one script: `pnpm db:seed`.

---

## 2. Continuous integration (GitHub Actions)

Two workflows. Described as jobs, not YAML, by design — the YAML is written at implementation time against the
then-current action versions.

### 2.1 `ci.yml` — on `pull_request` and on `push` to `main`

Shared setup for every job: checkout → `pnpm/action-setup` (version from `packageManager`) →
`actions/setup-node` (Node 24, `cache: pnpm`) → `pnpm install --frozen-lockfile`.

| Job | Steps | Fails the PR when |
| --- | --- | --- |
| `lint` | `pnpm --filter backend lint` (oxlint) · `pnpm --filter frontend lint` (ESLint) · `prettier --check` on `backend/` | Any lint error. |
| `typecheck` | `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` · `pnpm --filter frontend exec tsc --noEmit` | Any type error. Needs `prisma generate` first (see `prisma` job ordering below) because backend types depend on the generated client. |
| `prisma` | `pnpm prisma:validate` · `pnpm prisma:generate` · **`prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code`** | The schema is invalid, **or** `schema.prisma` was changed without a matching migration (the `migrate diff` drift check — the single highest-value Prisma guard, and it catches the most common real mistake). |
| `test-unit` | `pnpm --filter backend test` (Vitest) | Any failing unit test. |
| `test-e2e` | Postgres 16 **service container** (matching `docker-compose.yml` credentials) → `prisma migrate deploy` → `pnpm --filter backend test:e2e` | Any failing e2e test. Needs `DATABASE_URL` pointed at the service container; `SYNC_ENABLED=false` and no provider keys, so **CI never calls an external API** ([content-pipeline-plan §3.7](./content-pipeline-plan.md#37-testing-the-pipeline)). |
| `build` | `pnpm --filter backend build` (`nest build`) · `pnpm --filter frontend build` (`next build`) | A build break that lint and typecheck missed (route typing, RSC boundaries). |
| `design-tokens` *(from phase 3)* | A `grep`/ESLint check that no file outside `frontend/src/app/globals.css` contains a literal colour (`#rrggbb`, `rgb(`, `bg-neutral-`, `text-gray-`) | A hard-coded colour sneaks in — this is what keeps the phase 8 palette swap a one-file change ([frontend-plan §4.4](./frontend-plan.md#44--exactly-what-changes-on-design-day)). |
| `rtl-lint` *(from phase 3)* | A `grep` for physical spacing utilities (`pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right`) in `frontend/src` outside `components/ui/` | RTL-unsafe utilities, per [frontend-plan §5.4](./frontend-plan.md#54-tailwind-rtl-conventions-enforced-in-review). |

Ordering: `lint`, `prisma` and `build` can run in parallel; `typecheck`, `test-unit` and `test-e2e` depend on
`prisma generate`. Cheapest approach is a `prisma generate` step inside each job that needs it (it is fast) or an
artifact upload — pick one and keep it consistent.

**Path filters:** frontend-only jobs skip when only `backend/**` changed and vice versa; `docs/**`-only changes
skip everything except a markdown link check. Worth adding early — this repo's planning docs will change often.

**Branch protection on `main`:** `lint`, `typecheck`, `prisma`, `test-unit`, `build` required. `test-e2e` becomes
required once it is stable (phase 3). Coverage is **not** a gate before phase 5
([backend-plan §11.2](./backend-plan.md#112-e2e-tests)).

### 2.2 `release.yml` — on push to `main` (staging) and on tag `v*` (production)

| Job | Steps |
| --- | --- |
| `migrate` | `prisma migrate deploy` against the target environment's `DATABASE_URL`. **Runs before** the new app version starts (§4). |
| `deploy-backend` | Trigger the platform deploy (Railway/Fly), wait for health, mark the release. |
| `smoke` | `GET /health` → 200; `GET /health/ready` → 200; `GET /v1/sins?limit=1` → a `{ data, meta }` envelope. Failure triggers the rollback in §6. |
| `deploy-frontend` | Vercel's own Git integration handles this; the job only waits for and reports the deployment status. |
| `tag-release` | Create a GitHub Release with the commit range (the artifact that makes "roll back to the previous version" concrete). |

### 2.3 Optional additions

Dependabot/Renovate (weekly, grouped, with the Expo SDK excluded from auto-bumps), `pnpm audit` as a
non-blocking report, a markdown link checker over `docs/**` (this plan set is heavily cross-linked), and
`actions/dependency-review-action` on PRs.

---

## 3. Deployment targets

> **Recommendations, not commitments.** All three choices below are swappable; what is *not* swappable is the
> shape: one stateless API container, one managed Postgres, one edge-hosted Next.js app.

### 3.1 Backend + Postgres — **Railway** (recommended), Fly.io as the alternative

| Option | Why | Why not |
| --- | --- | --- |
| **Railway** ✅ | Postgres and the API live in one project with a private network and an injected `DATABASE_URL`; Nixpacks detects a pnpm monorepo with a root directory setting; release-command support makes `prisma migrate deploy` a first-class pre-deploy step; backups and metrics included. Lowest operational overhead for a solo/small team, which is the actual constraint. | Less control over regions and scaling than Fly; pricing grows with usage. |
| **Fly.io** | Real multi-region, generous always-on small instances, `fly postgres` nearby, Dockerfile-native (full control over the ESM/Node 24 image). | Fly Postgres is **self-managed** (you own backups/failover) unless you use Managed Postgres; more concepts to learn. Better once there is a reason to be multi-region. |
| Render | Very close to Railway in ergonomics; managed Postgres with PITR. | Cold starts on cheaper tiers; slower builds. |
| AWS (ECS/RDS) | Ceiling. | Weeks of setup for an app with no users yet. **Not recommended at this stage.** |

Backend deployment shape either way:

- A multi-stage **Dockerfile** committed at `backend/Dockerfile` (phase 2/5) — deps → `prisma generate` + `nest build` → a slim `node:24-alpine` runtime with only `dist/`, production `node_modules`, the Prisma engine and `prisma/`. Owning the Dockerfile keeps the platform choice cheap to change; relying on buildpack magic does not.
- Release command: `pnpm --filter backend exec prisma migrate deploy`.
- Start: `node dist/main` (confirm the emitted entry filename).
- `PORT` from the platform env; the app must bind `0.0.0.0`.
- Health check → `GET /health` (unprefixed, §5 of [backend-plan](./backend-plan.md#111-health)).
- Graceful shutdown: `app.enableShutdownHooks()` + a SIGTERM grace period ≥ 15 s so an in-flight sync batch finishes.
- Single instance until there is load. **Scaling past one instance requires resolving the cron-duplication question** in [content-pipeline-plan §3.1](./content-pipeline-plan.md#31-scheduler-choice--nestjsschedule-cron-now-bullmq-later) — the advisory lock covers it, but verify it before scaling.

### 3.2 Frontend — **Vercel** (recommended)

First-party Next.js 16 support (App Router, RSC, ISR/`revalidate`, image optimisation, streaming), per-PR
preview deployments — genuinely valuable for a design-sensitive app where the palette lands late and every
preview is a review artifact — and zero-config monorepo support (root directory `frontend/`, pnpm workspace
aware).

Settings: root directory `frontend`, `NEXT_PUBLIC_API_URL` per environment (preview → staging API, production →
production API), production branch `main`, Node 24. Alternatives: Netlify, Cloudflare Workers (`@opennextjs/cloudflare`),
or self-hosting the Next standalone output on the same platform as the API — the last is the option to take if
the goal becomes "one bill, one platform"; it costs preview deployments and image optimisation ergonomics.

Keep CORS on the API restricted to the known frontend origins, plus Vercel preview origins via a regex
allow-list if previews must hit staging directly.

### 3.3 Mobile (phase 7)

**EAS Build** + **EAS Submit** for store delivery, `expo-updates` channels (`staging`/`production`) for OTA
JS-only fixes, and a separate `mobile-release.yml`. Native binaries still require store review; only JS/asset
changes can ship OTA. Covered in [mobile-plan §2](./mobile-plan.md#2-stack).

---

## 4. Migration workflow

The rules, in order of importance:

1. **Local: `prisma migrate dev --name <descriptive_name>`.** Generates the SQL, applies it, regenerates the client. Commit `prisma/migrations/**` **with** the schema change in the same commit — a schema change without its migration is a broken build (the CI drift check in §2.1 enforces this).
2. **Staging/production: `prisma migrate deploy` only.** Never `migrate dev`, never `db push` — both can drop data or desync history. `migrate deploy` applies pending migrations and nothing else.
3. **Run migrations *before* the new code starts.** As a platform release command, so a failed migration aborts the deploy and the old version keeps serving.
4. **Never edit a migration that has been deployed.** It is immutable history; `migrate deploy` detects the checksum change and refuses. To change something, write a **new** migration.
5. **Additive-first (expand/contract) for anything with real data.** Add nullable column → backfill → start writing it → make it required in a later migration → drop the old column in a third. The `User.passwordHash`/`User.role` additions ([backend-plan §9](./backend-plan.md#9-proposed-schema-additions)) are deliberately nullable/defaulted for exactly this reason: they apply to a populated table without a rewrite.
6. **Raw SQL migrations are first-class.** The Arabic trigram/search index ([content-pipeline-plan](./content-pipeline-plan.md) / [backend-plan §4.4](./backend-plan.md#44-arabic-text-search)) is not expressible in the Prisma schema: generate an empty migration (`prisma migrate dev --create-only`), hand-write the `CREATE EXTENSION pg_trgm; CREATE INDEX … USING GIN (…)`, and commit it. Use `CREATE INDEX CONCURRENTLY` in a standalone migration once the table is large (note: it cannot run inside a transaction — Prisma wraps migrations, so this one needs its own migration file and a documented manual step or `--no-transaction`).
7. **Backup before every production migration.** Platform snapshot first; the restore path is only real if it has been tested once (do that in staging).
8. **`migrate reset` is a local/CI-only command.** Never point it at a shared database. The e2e job is the only automated user of it.
9. **Review migrations like code.** Destructive statements (`DROP`, `ALTER … TYPE`, `NOT NULL` on a populated column) need an explicit note in the PR describing the data impact and the rollback.
10. **No migration is committed in phase 1** (per [README](../../README.md)). The first one is created in phase 2 (`init`), and it must include the full current schema.

Rollback of a migration is a **forward** migration (a new one that reverses the change) — not an in-place edit.
That is why the app-level rollback in §6 and the schema rollback are separate concerns, and why rule 5 matters:
an additive migration is compatible with the previous app version, so the app can roll back without the schema
rolling back.

---

## 5. Secrets & configuration management

`.env` per environment, never committed. Already enforced: `.gitignore` covers `.env`, `.env.local`,
`.env.*.local`; `backend/.env.example` and `frontend/.env.example` are the committed templates and must list
**every** key with a safe placeholder.

### 5.1 Backend variables

| Variable | Phase | Secret? | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | 1 ✅ exists | **yes** | Postgres connection string. Add `?connection_limit=…&pool_timeout=…` on managed hosts; require SSL in staging/production. |
| `PORT` | 1 ✅ exists | no | **Change to `3001`** (§0). |
| `NODE_ENV` | 2 | no | `development` / `staging` / `production` |
| `CORS_ORIGINS` | 2 | no | CSV of allowed frontend origins |
| `LOG_LEVEL` | 2 | no | `debug` \| `info` \| `warn` |
| `JWT_ACCESS_SECRET` | 4 | **yes** | ≥ 32 random bytes, distinct per environment |
| `JWT_REFRESH_SECRET` | 4 | **yes** | **Must differ from the access secret** ([backend-plan §7.1](./backend-plan.md#71-decisions)) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | 4 | no | `15m` / `30d` |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | 4 | no | rate limiting |
| `SYNC_ENABLED` | 5 | no | **`false` by default**; `true` only in staging/production |
| `SYNC_QURAN_CRON`, `SYNC_HADITH_CRON` | 5 | no | overridable schedules |
| `QURAN_API_BASE_URL` | 5 | no | `https://api.quran.com/api/v4` |
| `QURAN_API_TOKEN`, `QURAN_API_CLIENT_ID` | 5 | **yes** | optional depending on the provider's current auth |
| `QURAN_TRANSLATION_IDS`, `QURAN_TEXT_FIELD`, `QURAN_PREFERRED_PROVIDER` | 5 | no | mapping configuration |
| `SUNNAH_API_KEY` | 5 | **yes** | `X-API-Key` header |
| `HADITH_API_KEY` | 5 | **yes** | sent as a **query parameter** — must be redacted in logs and stripped before persisting to `rawPayload` ([content-pipeline-plan §2.4](./content-pipeline-plan.md#24-hadithapicom--fallback--alternative-hadith-provider)) |
| `SYNC_*_RPS`, `SYNC_MAX_REQUESTS_PER_RUN`, `SYNC_MAX_DURATION_MINUTES`, `SYNC_MAX_RECORD_FAILURES`, `SYNC_STALE_AFTER_MINUTES` | 5 | no | rate/backoff budgets |
| `SEED_ALLOW_PRODUCTION` | 2 | no | absent everywhere except a deliberate one-off |

### 5.2 Frontend variables

| Variable | Phase | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | 1 ✅ exists | **→ `http://localhost:3001`** locally; the staging/production API origin otherwise. `NEXT_PUBLIC_*` is **compiled into the client bundle — never put a secret here.** |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | 3 | `ar` |
| `NEXT_PUBLIC_SITE_URL` | 3 | canonical URL for metadata/OG |
| *(server-only, phase 4)* `AUTH_COOKIE_SECRET` | 4 | **secret**, no `NEXT_PUBLIC_` prefix — used by the session route handler ([frontend-plan §6.5](./frontend-plan.md#65-authsession-on-the-client-phase-4)) |

### 5.3 Practices

- **Store of record:** the hosting platform's secret manager (Railway/Fly/Vercel env vars). GitHub Actions reads them from repository/environment secrets; production secrets live in a protected GitHub **Environment** with required reviewers.
- **Fail fast:** `ConfigModule.forRoot({ validate })` rejects a missing or malformed variable at boot ([backend-plan §6](./backend-plan.md#6-maints-bootstrap-target)). A missing `JWT_ACCESS_SECRET` must crash on start, not on the first login.
- **Never log a secret:** pino `redact` covers `authorization`, `password`, `refreshToken`; provider adapters must scrub `apiKey` from URLs before logging or persisting.
- **Rotation:** JWT secrets and provider keys rotate on exposure and at least annually. Rotating `JWT_REFRESH_SECRET` logs everyone out — acceptable, but announce it. A DB-backed refresh-token table would make rotation granular ([backend-plan §9](./backend-plan.md#9-proposed-schema-additions)).
- **Templates stay current:** adding a variable without adding it to the matching `.env.example` in the same PR is a review failure.
- **No secret in a client bundle, ever** — the `NEXT_PUBLIC_` prefix is a public marker.

---

## 6. Health checks and rollback

### 6.1 Health

| Probe | Path | Semantics |
| --- | --- | --- |
| Liveness | `GET /health` | Process is up. **No DB call** — a DB blip must not trigger an instance restart loop. Returns `{ status: 'ok', uptime, version }`. |
| Readiness | `GET /health/ready` | `SELECT 1` through Prisma. `503` when the DB is unreachable, so the platform stops routing traffic without killing the process. |

Both are unprefixed (excluded from `/v1`) so the platform probe URL never changes with an API version
([backend-plan §1.11](./backend-plan.md#111-health)). Platform config: liveness every 30 s with 3 failures to
restart; readiness every 10 s. Deploy gate: a new release is only promoted after `/health/ready` returns `200`
and the `smoke` job passes.

What to watch beyond the probes: `5xx` rate, p95 latency on `GET /v1/sins/:slug/quotes` (the core loop — if
*anything* is slow, this is what matters), Postgres connection count, and **`SyncLog` rows with
`status = FAILED`** — pipeline failures are invisible in HTTP metrics by design, so alert on the table (or on
the `error`-level log emitted alongside it).

### 6.2 Rollback

| Failure | Action |
| --- | --- |
| Bad backend release, schema unchanged | Redeploy the previous image/release via the platform (Railway/Fly keep prior releases). Fastest path; **this is why additive migrations matter** — the old code still runs against the new schema. |
| Bad backend release, schema changed | Roll the app back first (if additive, it still works). If the migration itself is the problem, write a **forward** migration that reverses it (§4, rule 10) — never hand-edit history. Restore from the pre-migration snapshot only as a last resort, accepting the data loss window. |
| Bad frontend release | Vercel "Instant Rollback" to the previous deployment. Near-zero risk since the frontend is stateless. |
| Provider breaking change / runaway sync | `SYNC_ENABLED=false` + restart. The core loop is unaffected because reads never touch a provider ([content-pipeline-plan §1](./content-pipeline-plan.md#1-principles-inherited-not-re-decided)) — this is the main operational payoff of "cache, don't proxy". |
| Bad ingested content | Delete the affected `Quote` rows (cascades clean up `Translation`/`QuoteTag`/links/`Favorite`) and fix the mapper. `rawPayload` means the correct data can be re-derived **without re-fetching**. |
| Database incident | Restore from the automated backup/PITR. **Test the restore path once in staging** — an untested backup is not a backup. |
| Bad mobile release (phase 7) | OTA rollback by republishing the previous `expo-updates` bundle; a native-level bug needs a new store build. |

Release discipline: one deployable change at a time during early phases, deploy in working hours, and write the
rollback step **in the PR description** for anything touching migrations, auth, or the sync pipeline.
