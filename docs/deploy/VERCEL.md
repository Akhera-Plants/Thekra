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
| `NEXT_PUBLIC_API_URL` | Production API origin, **no** trailing slash: `https://thekra.vercel.app` |

### Backend (`thekra-api`)

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL (migrations) |
| `JWT_ACCESS_SECRET` | Long random secret (required in production) |
| `JWT_REFRESH_SECRET` | Different long random secret |
| `CORS_ORIGINS` | Browser origins allowed to call the API, comma-separated — paste the value below |
| `NODE_ENV` | `production` |
| `PORT` | Optional; Vercel sets this |

Optional: `ACCESS_TTL`, `REFRESH_TTL`, `LOG_LEVEL`, `VARIETY_SCORE_FLOOR` — see `backend/.env.example`.

#### `CORS_ORIGINS` (production value)

**Built in since 2026-10-23:** `https://thekra-web.vercel.app` and the `thekra-web-*` preview pattern are always
allowed (`BUILT_IN_CORS_ORIGINS` in `backend/src/config/cors-origins.ts`), so the live site works even when this
variable is missing. Use `CORS_ORIGINS` only to *add* origins (localhost, a future custom domain).

Paste exactly, then redeploy the API (env changes apply to new deployments only):

```
https://thekra-web.vercel.app,https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app,http://localhost:3000
```

| Entry | Allows |
| --- | --- |
| `https://thekra-web.vercel.app` | The production site. Exact match. |
| `https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app` | `thekra-web` preview deployments (`…-git-<branch>-…`, `…-<hash>-…`). The `*` matches `[a-z0-9-]+` only: no dot, slash, port or scheme change, so `https://thekra-web-x.vercel.app.evil.com` and `http://…` do not match. |
| `http://localhost:3000` | **Temporary.** Lets `pnpm dev:web:prod-api` ([LOCAL_DEV.md](../build/LOCAL_DEV.md)) make browser-side calls to production. Any page served from your own `localhost:3000` is trusted by the API, so remove this entry (and redeploy) once that mode is no longer needed. |

Rules (enforced in `backend/src/config/cors-origins.ts`): each entry is an exact origin
(`scheme://host[:port]`, lowercase, no trailing slash) or one pattern with a single `*` in the
leftmost host label. A bare `*`, `null`, a whole-label `*.vercel.app`, or a malformed entry
makes the API **fail at boot** (every request fails; the error names the bad entry),
because the API answers with `Access-Control-Allow-Credentials: true`. Empty entries are
skipped. Requests without an `Origin` header (server-side rendering, curl) are unaffected.
Without a matching entry, browser-side calls (topic tabs, «عرض المزيد», theme chips) are
blocked; server-rendered pages still load.

Residual risk of the pattern: it trusts any host on `vercel.app` with that name shape. Vercel
hands out `<project>.vercel.app` names first come, first served; whether it would give another
account a name ending in this team's `-almekdadmohammadgmailcoms-projects` suffix is not
verified. The API authenticates with bearer tokens, not cookies, so a hostile origin that
matched could read only what is already public. On a custom domain, prefer exact origins.

Verify after the redeploy:

```bash
for o in https://thekra-web.vercel.app \
         https://thekra-web-git-master-almekdadmohammadgmailcoms-projects.vercel.app \
         http://localhost:3000 https://evil.example; do
  echo "== $o"; curl -si -X OPTIONS https://thekra.vercel.app/v1/sins \
    -H "Origin: $o" -H 'Access-Control-Request-Method: GET' | grep -i '^access-control-allow'
done
```

The first three print `access-control-allow-origin: <origin>` and
`access-control-allow-credentials: true`; `https://evil.example` prints no `allow-origin` line.

## Latency: function region and CDN cache

**Region.** `backend/vercel.json` sets `"regions": ["fra1"]` so the API runs in Frankfurt, next to the
Neon database (`aws-eu-central-1`). Vercel's default for new projects is `iad1` (Washington), which put
a transatlantic round trip (~90 ms) in front of every database query. Vercel's docs
([Configuring regions](https://vercel.com/docs/functions/configuring-functions/region), read 2026-10-23)
list Hobby as "Single region", so one region in `vercel.json` is allowed on Hobby; more than one fails the
deployment before the build. If the project dashboard has a region set (Settings → Functions → Function
Regions), keep it equal to `fra1`; if Neon is ever moved, change both together.

**CDN cache.** Public read routes send `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`
(presets in `backend/src/common/http/public-cache.ts`). Vercel's CDN does not cache a request that has an
`Authorization` header, and the API answers `private, no-store` to any request with a bearer token or a
cookie, so a signed-in reader is never served from or written to the shared cache. `Vary: Origin` (CORS) and
`Vary: Authorization` are sent. Vercel strips `s-maxage` and `stale-while-revalidate` from the response it
forwards to the browser, so `curl` against production shows `public` only; use `x-vercel-cache` (HIT / STALE /
MISS) to see the CDN state. No new environment variable is involved.

How long a change takes to show: the preset's `s-maxage` (topic pages and catalogues 300 s, one text and its
explanations 120 s, sources 600 s, text of the day 300 s, search 60 s) plus at most one stale answer inside
`stale-while-revalidate`. A `release-db.sh push` or an admin edit needs no action. To show a change sooner:
redeploy the API (Vercel's cache key includes the deployment, so a new deployment starts empty;
[cache keys](https://vercel.com/docs/caching/cdn-cache/purge)), or shorten the preset in `public-cache.ts`.
Purging by tag needs a `Vercel-Cache-Tag` response header, which this API does not send yet.

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
- Add the final frontend origin(s) to backend `CORS_ORIGINS` as exact entries (e.g.
  `https://thekra.example,https://www.thekra.example`) and redeploy the API.
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
`start:prod` and `start:dev` now run the bundle (`dist/bundle/main.mjs`): plain Node cannot load the `@thekra/practice-core` TypeScript source, and esbuild compiles it in.

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
