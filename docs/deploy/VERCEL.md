# Deploy Thekra on Vercel + Neon (owner steps)

Hobby plan is fine for **non-commercial** personal use. Two Vercel projects share this
monorepo; Postgres lives on Neon (Vercel Marketplace).

Official NestJS support (checked 2026-10-20): [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
detects `backend/src/main.ts` and runs the app as one Fluid Function. No custom
serverless adapter is required. If a deploy fails on native modules (`argon2`) or
the 250 MB Function limit, host the API on [Render free](https://render.com/) instead
and keep only the frontend on Vercel — see § Fallback.

## 1. Neon via Vercel Marketplace

1. In the Vercel dashboard → **Storage** / Marketplace → create **Neon Postgres**.
2. Copy both connection strings from Neon:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no pooler) → `DIRECT_URL`
3. Keep them handy for both projects and for `scripts/db-push-to-neon.sh`.

## 2. Import the repo twice

Create **two** Vercel projects from the same GitHub repo:

| Project   | Root Directory | Framework preset | Notes |
| --------- | -------------- | ---------------- | ----- |
| `thekra-web` | `frontend`  | Next.js          | Uses `frontend/vercel.json` |
| `thekra-api` | `backend`   | Other            | Uses `backend/vercel.json` (`prisma migrate deploy` in build) |

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
   `prisma generate` → `prisma migrate deploy` → `nest build`.
2. Restore local content into Neon (once):

```bash
export LOCAL_DATABASE_URL='postgresql://…local…'
export NEON_DATABASE_URL='postgresql://…neon-direct…'   # not the pooler host
./scripts/db-push-to-neon.sh
```

3. Confirm `GET https://<api>/health` (and `/v1/…` for quotes).

## 5. Custom domain

- Frontend project → Domains → add `thekra.example` (and `www` if desired).
- Point DNS as Vercel instructs.
- Set backend `CORS_ORIGINS` to the final frontend URL(s) and redeploy the API.
- Update frontend `NEXT_PUBLIC_API_URL` if the API also gets a custom host.

## 6. Local verify (already run in Phase 4)

```bash
pnpm --filter frontend build
pnpm --filter backend build
```

## Fallback — Render free for the API

If NestJS on Vercel fails (native `argon2`, bundle size, long-lived `@nestjs/schedule`
jobs), create a Render **Web Service**:

- Root directory: `backend`
- Build: `pnpm install && pnpm exec prisma generate && pnpm exec prisma migrate deploy && pnpm run build`
- Start: `pnpm run start:prod`
- Same env vars as §3 (use Neon pooled + direct URLs).

Keep the Next.js app on Vercel; set `NEXT_PUBLIC_API_URL` to the Render URL and
`CORS_ORIGINS` on Render to the Vercel frontend URL.

## Hobby / non-commercial note

Vercel Hobby and Neon free tiers are for personal, non-commercial projects. Do not
rely on them for paid traffic or SLA-backed production without upgrading.
