# Local development

Two modes. Default is fully local; the second runs only the website locally, against the
production API. Setup (install, Postgres, `backend/.env`) is in the root [README](../../README.md#setup).

| Mode | Web | API | Database |
| --- | --- | --- | --- |
| A. Local (default) | `http://localhost:3000` | `http://localhost:3001` | local Postgres (`docker compose up -d db`) |
| B. Web → production API | `http://localhost:3000` | `https://thekra.vercel.app` | production Neon, through the API only |

## A. Local (default)

```bash
docker compose up -d db
pnpm dev:backend     # API on :3001 (backend/.env: PORT=3001)
pnpm dev:frontend    # web on :3000
```

- `frontend/.env`: `NEXT_PUBLIC_API_URL="http://localhost:3001"` (copy of `frontend/.env.example`).
- `backend/.env`: `CORS_ORIGINS` must allow `http://localhost:3000`. That is the default when
  the variable is unset, and the value in `backend/.env.example`.

## B. Web against the production API

Use this to check the site with production content without running the API or a database.

```bash
pnpm dev:web:prod-api
```

The script sets `NEXT_PUBLIC_API_URL=https://thekra.vercel.app` for that process only; a
variable already in the environment wins over every `.env*` file, so nothing on disk changes.
To switch back, stop it and run `pnpm dev:frontend`.

The same with a file, if you prefer one: create `frontend/.env.local` with
`NEXT_PUBLIC_API_URL=https://thekra.vercel.app` (it overrides `frontend/.env`; `.env.local` is
gitignored at the root and by `frontend/.gitignore`). To switch back, delete the file. Either
way, restart `next dev` after a change: `NEXT_PUBLIC_*` values are compiled into the bundle.

Requirements and limits:

- Server-side fetches (the first render of each page) work regardless. Browser-side calls
  (topic tabs, «عرض المزيد», theme chips) work only while the production `CORS_ORIGINS`
  includes `http://localhost:3000` (see [VERCEL.md § 3](../deploy/VERCEL.md#3-environment-variables)).
  Without it the browser console shows a CORS error and those widgets stay empty.
- Sign-in, registration and admin actions in this mode act on **production** accounts and data.
  Do not create test accounts or edit content from it.

## Never point local tools at the production database

Do not put a Neon URL in `backend/.env`, `backend/.env.test`, or a shell running
`pnpm dev:backend`, Prisma, the import scripts or the e2e tests. Content reaches production
only through `scripts/release-db.sh` ([RELEASE_DB.md](RELEASE_DB.md)), which builds a cleaned
copy and verifies it; `admin:create` is the one documented command that takes the Neon URL,
inline, after a push.

## Checking CORS by hand

```bash
curl -si -X OPTIONS https://thekra.vercel.app/v1/sins \
  -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: GET' \
  | grep -i '^access-control-allow'
```

An allowed origin gets `access-control-allow-origin: <that origin>` and
`access-control-allow-credentials: true`; any other origin gets no `access-control-allow-origin`.
