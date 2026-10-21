# Security review — pre-deployment hardening (Vercel + Neon)

Scope: focused hardening of the deployable web stack — `backend/` (NestJS + Prisma
API) and `frontend/` (Next.js 16 App Router). `mobile/` is not deployed and was
only considered for dependency classification. This is a source review plus
local checks (unit/e2e tests, a local production build with Playwright). No live
or deployed endpoints were probed. Public UI was not changed.

## 1. What was checked

| Area | Checked |
| --- | --- |
| Rate limiting | Throttler registration, per-route limits, client-IP keying behind a proxy |
| Authorization | Guards on every mutating route (admin, review, favorites) |
| Auth tokens | JWT secrets / production defaults, refresh-cookie flags, token storage in the browser |
| Data exposure | Can a route return `passwordHash` or other internal fields; error-envelope leakage |
| Browser headers | CSP and the other security headers on the Next.js app; API helmet/CORS |
| Dependencies | `pnpm audit --prod`, classified by workspace and reachability |

## 2. Findings and fixes

### F1 — Rate limiting was not enforced anywhere except the report route (fixed)

- `ThrottlerModule` was configured, but `ThrottlerGuard` was not registered as a
  global guard. `@Throttle()` on `AuthController` only sets metadata, so
  `/auth/login` and `/auth/register` had **no** rate limit (password guessing,
  sign-up spam). Only `POST /quotes/:id/reports` used `@UseGuards(ThrottlerGuard)`.
- Fix:
  - `ThrottlerGuard` registered as `APP_GUARD` — [app.module.ts:118](../../backend/src/app.module.ts).
    Global default 120 req/min per client IP — [app.module.ts:47-56](../../backend/src/app.module.ts).
  - `/auth/*`: 5 req/min — [auth.controller.ts:23,32](../../backend/src/modules/auth/auth.controller.ts).
    `/auth/refresh`: 30 req/min — [auth.controller.ts:29,58](../../backend/src/modules/auth/auth.controller.ts)
    (the Next `/api/auth/refresh` route calls it on every full page load of a signed-in admin;
    it also requires a valid signed refresh token).
  - Public mistake report «أبلغ عن خطأ» `POST /quotes/:id/reports`: 5 req/min (was 8), now via the
    global guard — [quotes.controller.ts:50](../../backend/src/modules/quotes/quotes.controller.ts).
  - Throttling is skipped only when `NODE_ENV=test` (the suites log in far more than a real
    client), and a spec can opt back in with `THROTTLE_IN_TEST=true` —
    [app.module.ts:53](../../backend/src/app.module.ts). Never skipped in development or production.
  - New e2e spec proves the guard is global and the limits hold (login 6th → 429, report 6th →
    429, `/health` 121st → 429) — [throttle.e2e-spec.ts](../../backend/test/throttle.e2e-spec.ts).

### F2 — Behind a proxy every visitor would share one rate-limit bucket (fixed, needs env)

- The throttler keys on `req.ip`. Express only derives it from `X-Forwarded-For` when
  `trust proxy` is set; nothing set it, so on a platform proxy all users would share the
  proxy's IP — the global 120/min would then throttle the whole site at once.
- Fix: new optional `TRUST_PROXY` env ([env.validation.ts:205-214](../../backend/src/config/env.validation.ts)),
  applied in [configure-app.ts:10-31](../../backend/src/config/configure-app.ts). Set it to the
  number of proxy hops in front of the API (usually `1`). Leave unset if clients reach the API directly.
- Accepted limitation: login/register/refresh from the browser go through Next route handlers
  (`/api/auth/*`), so the API sees the **Vercel function's** IP for those calls, not the visitor's.
  The 5/min auth limit is therefore shared by everyone signing in through the web app at the same
  moment. Acceptable now (only a few admins; public accounts are off). If public accounts are
  enabled, forward the client IP from the route handlers with a shared secret, or add a per-email
  login limit.

### F3 — JWT secrets: production defaults (hardened)

- Before: production boot already failed if either secret equalled its built-in default, but a
  short secret, or the same value for both, was accepted. `AuthService` and both strategies keep
  `?? 'thekra-…-change-in-production'` fallbacks ([auth.service.ts:70-75](../../backend/src/modules/auth/auth.service.ts),
  [jwt.strategy.ts:19-21](../../backend/src/modules/auth/strategies/jwt.strategy.ts),
  [jwt-refresh.strategy.ts:19-21](../../backend/src/modules/auth/strategies/jwt-refresh.strategy.ts)).
  Those fallbacks are unreachable in production because env validation runs first.
- Fix: `assertProductionJwtSecrets` fails fast at boot in production unless both secrets are set,
  non-default, ≥ 32 characters and different — [env.validation.ts:230-266](../../backend/src/config/env.validation.ts).
  Unit tests: [env.validation.spec.ts](../../backend/src/config/env.validation.spec.ts).
- `JwtModule.register({ secret: 'placeholder' })` ([auth.module.ts:20](../../backend/src/modules/auth/auth.module.ts))
  is never used to sign or verify: every `sign()`/`verify()` passes its own secret. No change.

### F4 — Refresh cookie flags (confirmed, small hardening)

- The API itself sets **no** cookies: it returns tokens in the JSON body. The browser keeps the
  access token in memory only ([api-client.ts:32-41](../../frontend/src/lib/api-client.ts)) and
  sends it as a Bearer header. The refresh token lives in a cookie set by the Next route handlers:
  `httpOnly: true`, `sameSite: 'lax'`, `path: '/api/auth'`, 30 days —
  [session/route.ts:22-31](../../frontend/src/app/api/auth/session/route.ts),
  [refresh/route.ts:23-32](../../frontend/src/app/api/auth/refresh/route.ts),
  [register/route.ts:17-26](../../frontend/src/app/api/auth/register/route.ts).
- `secure` was derived only from `request.url.startsWith('https')`. Now it is also forced on when
  `NODE_ENV=production` ([session/route.ts:92,137](../../frontend/src/app/api/auth/session/route.ts),
  [refresh/route.ts:83](../../frontend/src/app/api/auth/refresh/route.ts),
  [register/route.ts:96](../../frontend/src/app/api/auth/register/route.ts)).
- CSRF: the cookie is `SameSite=Lax` and only read by `POST` handlers, so cross-site POSTs do not
  carry it; the response (access token) is not readable cross-origin (no CORS on Next routes).

### F5 — Authorization on mutating routes (verified, no change)

Every admin controller applies the guards at **class** level, so they cover every method; there is
no `@Public`/skip-auth mechanism and no method-level `@Roles()` override. `RolesGuard` reads
`@Roles` handler-then-class and 403s on a missing user/role
([roles.guard.ts:24-44](../../backend/src/modules/auth/guards/roles.guard.ts)). Routes importing
from `common/guards/admin.guard.ts` get the same real guards (it is a re-export,
[admin.guard.ts:9-11](../../backend/src/common/guards/admin.guard.ts)). e2e coverage exists for 401/403
(e.g. [auth.e2e-spec.ts:250,265](../../backend/test/auth.e2e-spec.ts), [admin-content.e2e-spec.ts:55,64](../../backend/test/admin-content.e2e-spec.ts),
[admin-classification.e2e-spec.ts:41-57](../../backend/test/admin-classification.e2e-spec.ts)).

| Controller (file:line of guards) | Mutating routes (`/v1/...`) | Guard |
| --- | --- | --- |
| `sins.admin.controller.ts:33-35` | `POST /admin/sins`, `PATCH /admin/sins/:id`, `DELETE /admin/sins/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `good-deeds.admin.controller.ts:21-23` | `POST /admin/good-deeds`, `PATCH …/:id`, `DELETE …/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `sources.admin.controller.ts:21-23` | `POST /admin/sources`, `PATCH …/:id`, `DELETE …/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `tags.admin.controller.ts:21-23` | `POST /admin/tags`, `PATCH …/:id`, `DELETE …/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `iman-branches.admin.controller.ts:23-25` | `POST /admin/branches`, `PATCH …/:id`, `DELETE …/:id`, `PUT …/:id/practices` | JwtAuthGuard + RolesGuard, ADMIN |
| `quotes.admin.controller.ts:43-45` | `POST /admin/quotes`, `POST …/:id/text-verification`, `PATCH …/:id`, `DELETE …/:id`, `PUT …/:id/translations/:languageCode`, `POST …/:id/translations`, `DELETE …/:id/translations/:languageCode`, `PUT …/:id/tags` | JwtAuthGuard + RolesGuard, ADMIN |
| `classification.admin.controller.ts:31-33` | `POST /admin/sin-quotes`, `PATCH …/:id`, `DELETE …/:id`, `POST …/bulk`, `POST …/revoke` | JwtAuthGuard + RolesGuard, ADMIN |
| `classification.admin.controller.ts:86-88` | `POST /admin/good-deed-quotes`, `PATCH …/:id`, `DELETE …/:id`, `POST …/bulk`, `POST …/revoke` | JwtAuthGuard + RolesGuard, ADMIN |
| `branch-quotes.admin.controller.ts:23-25` | `POST /admin/branch-quotes`, `PATCH …/:id`, `DELETE …/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `chapter-maps.admin.controller.ts:34-36` | `POST /admin/chapter-maps`, `PATCH …/:id`, `DELETE …/:id` | JwtAuthGuard + RolesGuard, ADMIN |
| `content-sync.admin.controller.ts:31-33` | `POST /admin/content-sync/runs` | JwtAuthGuard + RolesGuard, ADMIN |
| `review.controller.ts:9-11` | `POST /review/matches/:id/confirm`, `…/reject`, `POST /review/flags/:id/resolve`, `…/dismiss` | JwtAuthGuard + RolesGuard, ADMIN or REVIEWER |
| `favorites.controller.ts:23-24` | `POST /favorites`, `DELETE /favorites/:quoteId` | JwtAuthGuard; scoped to `user.sub` (own rows only) |
| `auth.controller.ts` | `POST /auth/register`, `/login`, `/refresh` (public, throttled); `POST /auth/logout` | JwtAuthGuard on logout |
| `quotes.controller.ts:48-51` | `POST /quotes/:id/reports` (public by design) | Throttle 5/min, DTO-validated |

Notes (accepted): the role is read from the access token, so a demoted admin keeps access until the
token expires (`ACCESS_TTL`, default 15 min); logout is stateless (no refresh-token revocation,
[auth.controller.ts:92-98](../../backend/src/modules/auth/auth.controller.ts)).

### F6 — Data exposure (verified; minor items accepted)

- `passwordHash` cannot reach a response: register/login return `safeUser()` (id, email,
  displayName, role) — [auth.service.ts:182-194](../../backend/src/modules/auth/auth.service.ts);
  `GET /auth/me` returns a fixed field list for the caller only —
  [auth.controller.ts:65-82](../../backend/src/modules/auth/auth.controller.ts). The only relation
  to `User` is `Favorite`; no response includes a `user` relation.
- Quote responses go through `mapQuoteToDto` (no `rawPayload`, legacy grades, or `matnAr`) —
  `backend/src/common/mappers/quote.mapper.ts:159-238`. Explanation `rawPayload` is never returned.
  The hadith-api key is stripped before storing payloads — `content-sync/providers/hadith-api.provider.ts:155-177`.
- Error envelope never includes stack traces; unknown errors → generic `INTERNAL_ERROR`.
  *Low, accepted:* Prisma P2002/P2003/P2025 return Prisma's `error.meta` (constraint/field names)
  as `details` — `backend/src/common/filters/all-exceptions.filter.ts:179-193`. Non-secret schema names.
- *Informational:* `GET /branches/:number/quotes` returns the raw link `note`
  (`iman-branches.service.ts:422`), while sins/good-deeds filter generated notes through
  `readerLinkNote()`. Curator-authored content, not a trust-boundary issue; left for the content owner.
- *Informational:* `GET /sources` includes `apiBaseUrl` (a public provider URL, not a secret).
- Reviewer routes return whole `QuoteFlag` rows (including `note`, `resolvedBy` user id) — expected
  for ADMIN/REVIEWER.

### F7 — `/auth/register` is open although public accounts are off (accepted, recommendation)

`NEXT_PUBLIC_ACCOUNTS_ENABLED=false` only hides the UI ([accounts.ts:6](../../frontend/src/lib/accounts.ts));
`POST /v1/auth/register` still creates `USER` accounts. A `USER` can only manage its own favorites,
and the route is now throttled at 5/min/IP, so the impact is junk rows. Recommendation for later:
gate register behind a backend flag (e.g. `ACCOUNTS_ENABLED`) until the accounts phase.

### F8 — No security headers on the web app (fixed)

[next.config.ts](../../frontend/next.config.ts) now sets, for every path:

- `Content-Security-Policy` (production value as served by `pnpm start`):
  `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <NEXT_PUBLIC_API_URL origin>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self'`
  plus `upgrade-insecure-requests` when the API URL is https.
  - No external hosts are needed: all fonts are self-hosted by `next/font` (Amiri Quran / Geist
    Mono via `next/font/google`, the rest `next/font/local`), images are same-origin, LogoLoop
    renders text logos only (`components/home/SourceStrip.tsx`), no third-party scripts/iframes.
    `api.quran.com` is fetched server-side only (`lib/texts/edition.ts`), so it is not in `connect-src`.
  - `'unsafe-eval'` and `ws:`/`wss:` (HMR) are added only under `next dev`.
  - *Accepted:* `script-src 'unsafe-inline'` — Next's inline RSC/bootstrap scripts and the
    next-themes no-flash script need it unless nonces are used, and nonces force every page to
    dynamic rendering (no static/ISR). XSS sinks were checked instead: no `dangerouslySetInnerHTML`,
    `eval`/`new Function`, or raw HTML injection in `frontend/src`. Revisit with nonces if
    user-generated HTML is ever rendered.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`,
  `Strict-Transport-Security: max-age=63072000; includeSubDomains` (not under `next dev`), and
  `poweredByHeader: false`.
- zod v4 probes `Function('')` to enable its JIT; under the production CSP that probe produced a
  `script-src eval` violation on `/admin`. Fixed by importing zod through
  [lib/zod.ts](../../frontend/src/lib/zod.ts) which sets `z.config({ jitless: true })`; the 8 form
  components now import `z` from `@/lib/zod`.
- Verification: [security-headers.spec.ts](../../frontend/e2e/security-headers.spec.ts) loads `/`,
  `/good-deeds/dhikr`, `/en`, `/admin` and fails on any CSP console message or
  `securitypolicyviolation` event, and checks the headers.

API side (no change): helmet on, with its default CSP in production only
([configure-app.ts:33-42](../../backend/src/config/configure-app.ts)); CORS allow-list from
`CORS_ORIGINS` with credentials ([configure-app.ts:60-66](../../backend/src/config/configure-app.ts));
`ValidationPipe` whitelist + forbidNonWhitelisted.

## 3. Dependencies (`pnpm audit --prod`)

Before: **6 vulnerabilities (3 high, 3 moderate)**. After: **5 (2 high, 3 moderate)** — all remaining
paths are in `mobile/` or in the `shadcn` CLI, none in code that is deployed or reachable at runtime.

| Advisory | Package (version) | Workspace / path | Exploitable here? | Action |
| --- | --- | --- | --- | --- |
| GHSA-ggr8-5vv4-36mx (high) | deepmerge-ts 7.1.5 | backend › @prisma/client › prisma › @prisma/config | No — merges the trusted `prisma.config.ts` at CLI time, not request data | **Fixed**: pnpm override `@prisma/config>deepmerge-ts: 8.0.2` (the version Prisma 7's config uses; same `deepmerge()` API). `prisma validate`/`generate` re-run OK. Remove when upgrading Prisma. |
| GHSA-vfj7-8cjw-p6xm (high) | braces 3.0.3 | frontend › shadcn (CLI) › fast-glob › micromatch; mobile › metro | No — `shadcn` is a component-generator CLI run by developers; not bundled into the Next app or run on Vercel at request time | **Accepted**: no fixed `braces` release is published (latest is 3.0.3). Recheck later; consider moving `shadcn` to devDependencies. |
| GHSA-86w9-cpqp-85rv (high) | node-forge 1.4.0 | mobile › expo › @expo/cli | No — mobile tooling, not deployed | Documented (mobile) |
| GHSA-w5hq-g745-h8pq (moderate) | uuid 7.0.3 | mobile › expo › xcode | No — mobile build tooling | Documented (mobile) |
| GHSA-vcc3-ghjq-m6fr (moderate) | decode-uri-component 0.2.2 | mobile › expo-router › query-string | No — mobile app only | Documented (mobile) |
| GHSA-hp3w-g68c-fv3c (moderate) | sprintf-js 1.0.3 | mobile › react-native › jest-preset (test tooling) | No — test tooling | Documented (mobile) |

Lockfile note: `pnpm install` also re-normalized one unrelated snapshot key
(`eslint-import-resolver-typescript`) in `pnpm-lock.yaml`; versions are unchanged.

## 4. Deployment environment checklist

API (NestJS):

- [ ] `NODE_ENV=production` — enables the JWT secret checks and helmet's CSP; throttling is never skipped.
- [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — two different random values, ≥ 32 chars
      (e.g. `openssl rand -base64 48`). Boot fails otherwise.
- [ ] `CORS_ORIGINS` — exactly the Vercel frontend URL(s), comma-separated, e.g.
      `https://thekra.vercel.app` (add the custom domain if any). No wildcards, no localhost.
- [ ] `TRUST_PROXY` — number of proxies in front of the API (usually `1`), so rate limits key on
      the real client IP. Leave unset only if clients connect directly.
- [ ] `DATABASE_URL` / `DIRECT_URL` — Neon pooled / direct URLs with `sslmode=require`.
- [ ] `ATHAR_PUBLIC_ENABLED=true` (owner-approved athar).
- [ ] `SYNC_ENABLED` — leave `false` unless the cron sync is wanted; provider keys only if used.
- [ ] `LOG_LEVEL=info` (pino redacts `authorization`, `password`, `refreshToken`).
- [ ] Remove `ADMIN_API_KEY` (unused).

Web (Next.js on Vercel):

- [ ] `NEXT_PUBLIC_API_URL` — the API's public https URL (it is baked into the CSP `connect-src`
      at build time, so rebuild after changing it).
- [ ] `NEXT_PUBLIC_ACCOUNTS_ENABLED=false`.
- [ ] After the first deploy, check the response headers of `/` and the browser console on `/admin`
      for CSP reports.

## 5. Not covered / limits

- No live or deployed-environment testing; proxy/header behaviour of the real Vercel/API host must
  be confirmed after deploy (headers, `TRUST_PROXY`, cookie `Secure`).
- Admin flows were checked for CSP on the login page only (no admin credentials used); the admin
  pages after login use the same API origin and zod forms, but were not exercised in the browser.
- Throttler storage is in-memory per API instance; with several instances the effective limit is
  per instance. Use a shared store (e.g. Redis) if the API is scaled out.
