# Deploy Thekra on Vercel + Neon (owner steps)

Hobby plan is fine for **non-commercial** personal use. Two Vercel projects share this
monorepo; Postgres lives on Neon (Vercel Marketplace).

The API does **not** use Vercel's zero-config `nestjs` preset. It ships as one Node.js
Vercel Function (`backend/api/index.mjs`) that serves a pre-built esbuild bundle of the
Nest app, because the preset deploys `node_modules` unbundled and crashes on Nest 12
(see [§ Why the API is bundled](#why-the-api-is-bundled-requireesm)). If a deploy fails on
native modules (`argon2`) or the 250 MB Function limit, host the API on
[Render free](https://render.com/) instead and keep only the frontend on Vercel — see § Fallback.

## 1. Neon via Vercel Marketplace

1. In the Vercel dashboard → **Storage** / Marketplace → create **Neon Postgres**.
2. Copy both connection strings from Neon:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no pooler) → `DIRECT_URL`
3. Keep them handy for both projects and for `scripts/release-db.sh push` (direct URL only).

## 2. Import the repo twice

Create **two** Vercel projects from the same GitHub repo:

| Project   | Root Directory | Framework preset | Notes |
| --------- | -------------- | ---------------- | ----- |
| `thekra-web` | `frontend`  | Next.js          | Uses `frontend/vercel.json` |
| `thekra-api` | `backend`   | Other            | Uses `backend/vercel.json` (`framework: null`; `prisma migrate deploy` in build). If the project still says NestJS, `vercel.json` overrides it. |

Enable **Include source files outside of the Root Directory** on both (pnpm workspace).

Node: set **Node.js 24.x** (matches root `engines`) in each project’s Settings → General.

## 3. Environment variables

### Frontend (`thekra-web`)

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Production API origin, **no** trailing slash (e.g. `https://thekra-api.vercel.app`) |

### Backend (`thekra-api`)

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL (migrations) |
| `JWT_ACCESS_SECRET` | Long random secret (required in production) |
| `JWT_REFRESH_SECRET` | Different long random secret |
| `CORS_ORIGINS` | Frontend origin(s), comma-separated (e.g. `https://thekra.vercel.app`) |
| `NODE_ENV` | `production` |
| `PORT` | Optional; Vercel sets this |

Optional: `ACCESS_TTL`, `REFRESH_TTL`, `LOG_LEVEL`, `VARIETY_SCORE_FLOOR` — see `backend/.env.example`.

## 4. First migration + data

1. Push to `master` (or trigger Deploy). The API build runs:
   `prisma generate` → `prisma migrate deploy` → `pnpm run build` (`nest build`, then
   `scripts/bundle.mjs` writes `dist/bundle/*.mjs`).
2. Copy the content into Neon with the release pipeline. The full guide (what is removed
   and why, and every check) is [docs/build/RELEASE_DB.md](../build/RELEASE_DB.md).
   `scripts/db-push-to-neon.sh` is superseded: it copied the development accounts, and it
   now refuses to run.

```bash
scripts/release-db.sh build                              # local → cleaned thekra_release → /tmp/thekra-release.dump
export NEON_DATABASE_URL='postgresql://…neon-direct…'    # direct host, not -pooler; never printed
scripts/release-db.sh push                               # type PUSH (or --yes); verifies Neon afterwards
DATABASE_URL="$NEON_DATABASE_URL" ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='<16+ chars>' \
  pnpm --filter backend admin:create                     # again after every push
```

   These are one-off command inputs, not API config: `NEON_DATABASE_URL`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, and the optional `LOCAL_DATABASE_URL`, `PG_BIN` and `PG_CONTAINER`.
   Do not add them to the Vercel project or to CI.

3. Confirm `GET https://<api>/health/ready` returns `database: up`, and that
   `/v1/sources?limit=5` reports `meta.total` 88.

## 5. Custom domain

- Frontend project → Domains → add `thekra.example` (and `www` if desired).
- Point DNS as Vercel instructs.
- Set backend `CORS_ORIGINS` to the final frontend URL(s) and redeploy the API.
- Update frontend `NEXT_PUBLIC_API_URL` if the API also gets a custom host.

## 6. Local verify

```bash
pnpm --filter frontend build
pnpm --filter backend build
pnpm --filter backend gate:vercel   # the Vercel gate, see below (needs the local DB from backend/.env)
```

## Why the API is bundled (require(esm))

`@nestjs/common`, `core`, `platform-express`, `config`, `jwt`, `passport`, `schedule`,
`cache-manager`, `axios` and `mapped-types` 12.x are ESM-only (`"type": "module"`).
`@nestjs/throttler` 6.7.1 (its latest release) is still CommonJS and `require()`s
`@nestjs/common`. Node 22.12+ allows `require()` of an ES module by default, so
it works locally. Vercel's function loader (`/opt/rust/nodejs.js`, which wraps
`Module._load`) does not, and every request died with:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module …/@nestjs/common/index.js from
…/@nestjs/throttler/dist/throttler.decorator.js not supported.
```

(Vercel's docs confirm the default: require(esm) is disabled unless the project sets
`NODE_OPTIONS=--experimental-require-module`
— [Advanced Node.js usage](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).
That env var would also work, but it depends on a platform-side default we do not
control; the bundle does not.)

The build therefore bundles the compiled app (`dist/`, which already carries the
decorator metadata) with esbuild, which links CommonJS and ESM at build time so no
runtime `require()` of an ES module is left:

| Piece | Role |
| --- | --- |
| `backend/scripts/bundle.mjs` | `dist/main.js` → `dist/bundle/main.mjs` (plain server) and `dist/serverless.js` → `dist/bundle/serverless.mjs` (Vercel). Kept external (`scripts/bundle-externals.mjs`): `argon2`, `@prisma/client`, `pino-http` (native binding / generated client / pino's worker-thread files) and the optional, uninstalled Nest transports. Plugin `embed-taxonomy` inlines `prisma/taxonomy/taxonomy.yaml` and `topic-themes.yaml` (topic pairs and themes, read by the sins and good-deeds pages): the function does not ship `prisma/`. Unbundled code (`dist/main`, vitest, import scripts) reads them from disk relative to `src/modules/taxonomy/taxonomy-files.ts`, never `process.cwd()`. |
| `backend/src/serverless.ts` | Default-exports `(req, res)`. Creates the Nest app once per function instance (`configureApp` + `app.init()`, no port), reuses it for every invocation, and clears the cache if boot fails. |
| `backend/api/index.mjs` | The Vercel Function entry; re-exports the bundled handler. |
| `backend/vercel.json` | `framework: null`, rewrite of **every** path to `/api` (so `/health` and `/v1/*` keep their paths), `includeFiles: package.json` (the health endpoint reads its version from it at runtime, which file tracing cannot see), `outputDirectory: public`. |
| `backend/public/.gitkeep` | Vercel refuses a build with no output directory (`STATIC_BUILD_NO_OUT_DIR` / `STATIC_BUILD_EMPTY_OUT_DIR`). The placeholder is the only static file served. |

`pnpm --filter backend start:bundle` runs the bundled server (`node dist/bundle/main.mjs`);
`start:prod` (`node dist/main`) is unchanged and fine on Node 24, where require(esm) works.

### The gate

`--no-experimental-require-module` is the local stand-in for Vercel's loader. Any
change to the API's build or dependencies must pass:

```bash
pnpm --filter backend gate:vercel
# = pnpm run build && node scripts/gate-vercel.mjs
```

It boots the bundle with the flag (once with `backend/.env` as is, once with
`NODE_ENV=production` and throwaway JWT secrets) and once without it, checks
`/health`, `/v1/sins`, `/v1/good-deeds/dhikr/quotes` and a themed
`/v1/sins/tark-as-salah/quotes?theme=…` return 200 with non-empty data (and non-empty
`meta.themes` on the quote pages) plus the helmet headers, and calls `api/index.mjs`
through a plain `http` server on several requests and asserts the Nest app was created
once. It does that last leg twice: from the repo, and from a temporary replica of the
function tree holding only `api/index.mjs`, the serverless bundle, `includeFiles` from
`vercel.json` and the externals linked into `node_modules`, with the cwd at the tree root
(as `/var/task` is). Only that replica catches a runtime read of a file Vercel does not
ship; the repo legs run with every source file in reach. Last, a negative control: un-bundled `dist/main.js`
under the flag must still fail with `ERR_REQUIRE_ESM`. Manual equivalent:

```bash
cd backend && pnpm build && PORT=3098 node --no-experimental-require-module --env-file=.env dist/bundle/main.mjs
```

The gate cannot prove the Vercel runtime itself. What was checked beyond it (2026-10-22,
Vercel CLI 65.1.0): `vercel build` on a copy of the repo produced a 25 MB function with
the bundle, `package.json`, the Prisma engine, `argon2` prebuilds and `pino-http`'s
dependencies; that function tree ran under the flag, including with Vercel's request/response
helpers (`res.status/json/send`, lazy `req.query`/`req.body`) applied. Not checked: a
real deployment, and Prisma's Linux engine (the local machine is macOS; Vercel's build
runs `prisma generate` on Linux, and file tracing includes whichever engine it generates).

## Fallback — Render free for the API

If the Function route fails (native `argon2`, bundle size, long-lived `@nestjs/schedule`
jobs), create a Render **Web Service** (Node 24: require(esm) works, so `node dist/main` or
`dist/bundle/main.mjs` both run):

- Root directory: `backend`
- Build: `pnpm install && pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm run build`
- Start: `pnpm run start:prod`
- Same env vars as §3 (use Neon pooled + direct URLs).

Keep the Next.js app on Vercel; set `NEXT_PUBLIC_API_URL` to the Render URL and
`CORS_ORIGINS` on Render to the Vercel frontend URL.

## Hobby / non-commercial note

Vercel Hobby and Neon free tiers are for personal, non-commercial projects. Do not
rely on them for paid traffic or SLA-backed production without upgrading.
