# Thekra — agent rules

**Start with the full project guide: [docs/guide/PROJECT_GUIDE.md](docs/guide/PROJECT_GUIDE.md) and [docs/guide/PROJECT_HISTORY_AND_LESSONS.md](docs/guide/PROJECT_HISTORY_AND_LESSONS.md)** (owner preferences, content rules, deployment, past mistakes).

Applies to the whole monorepo (`backend/`, `frontend/`, `mobile/`, root tooling). Package rules still apply on top of these: `frontend/AGENTS.md` (Next.js 16 docs-first rule), `frontend/.cursorrules`, `backend/.cursorrules`, and `.cursor/rules/`.

## Before using a library API

- Check the installed version (`pnpm ls <pkg>`), then read the docs that ship with that version: the package's `README`, `docs/`, and `.d.ts` files. For Next.js, read `frontend/node_modules/next/dist/docs/`.
- Do not write from memory. If a major is behind, read its upgrade guide and do not write new code against APIs it deprecates for the next major.
- Never introduce an API that is deprecated in the next major without a note in `docs/build/DEPRECATIONS.md` (file:line and the migration step).

## Dependencies and config

- Run `pnpm deprecations` whenever you touch dependencies (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) or config (`backend/prisma/schema.prisma`, `backend/prisma.config.ts`, `frontend/next.config.ts`, `tsconfig*.json`, `.github/workflows/`, `backend/vercel.json`, `frontend/vercel.json`). Report its result.
- Do not upgrade a dependency's major version inside an unrelated change. Plan it in `docs/build/DEPRECATIONS.md`.
- Never silence a deprecation warning (no ignore flags, no suppress comments). Capture it and record it.
- Never add a dependency from an unverified source to clear a deprecation. Use the vendor's first-party migration path.
- Run Prisma through the pinned package: `pnpm exec prisma …` or `pnpm --filter backend …`. Never use bare `npx prisma`; on npm it now resolves to the Prisma 8 release-candidate CLI, which does not read `schema.prisma`.

## Environment variables

Every new environment variable that a config requires must be added in the same change to all three places:

1. `.github/workflows/ci.yml` (workflow-level or job-level `env`);
2. `backend/.env.example`;
3. `docs/deploy/VERCEL.md`.

Config files can disable automatic `.env` loading. Assume CI and deploy receive only what those three places list.

## Checks before declaring work done

- Backend: `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` and `pnpm --filter backend test`.
- Frontend: `pnpm --filter frontend exec tsc --noEmit` and `pnpm --filter frontend test`.
- When dependencies or config changed: `pnpm deprecations`, plus the build of each affected package.
- In your report, list what you ran and what you did not run.

## Repository hygiene

- Node 24 is the target: root `engines` and CI both pin it.
- Do not commit generated output or build artifacts (`.next/`, `dist/`, `node_modules/`, and the Prisma client once it moves to `backend/src/generated/`).
- Do not revert or overwrite uncommitted changes you did not make.
