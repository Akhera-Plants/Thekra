# Thekra — Autonomous Build Progress

> Resume from the first unchecked item. Tick only after gates are green **and** the step is committed.
> Started at HEAD `6fb761e`. Sources: `docs/AUTONOMOUS_BUILD_PROMPT.md`, `docs/plan/roadmap.md`.

## Bootstrap

- [x] Create `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md` — `b7329f0`

## Phase 2 leftovers

- [x] P2-1 — extract shared link-quote query builders into `QuotesService` — `dd04f28`
- [x] P2-4 — `@ValidQuoteShape()` → 400 on create/update quote DTOs — `dd04f28`
- [x] Cheap P3 — appliedFilters echo, tag orderBy slug, `setCreated`, source external-api fields, TODO(phase-5), backend README notes — `dd04f28`
- [x] P0-4 seed corrections — **skipped** (no D-5 ticks; see BLOCKERS)

## DevOps (no accounts)

- [x] `.github/workflows/ci.yml` (lint, typecheck, prisma+drift, unit, e2e+Postgres, build) — `a0dab98`
- [x] `backend/Dockerfile` — `a0dab98`
- [x] Root scripts as needed — `a0dab98`
- [ ] Staging / remotes — **blocked** (see BLOCKERS)

## Phase 3 — Frontend MVP (§10 steps)

- [x] Step 1 — `src/lib` env/api/types/query/providers *(pre-existing)*
- [x] Step 2 — shadcn + tokenized `globals.css` *(pre-existing)*
- [x] Step 3 — next-themes + ThemeToggle *(pre-existing)*
- [x] Step 4 — next-intl `[locale]` *(pre-existing)*
- [x] Step 5 — AppShell, SiteHeader, LocaleSwitcher, Empty/Error/ArabicText
- [x] Step 6 — QuoteCard, skeleton, GradeBadge, SourceAttribution
- [x] Step 7 — sin-reminder + `/sins`, `/sins/[slug]`
- [x] Step 8 — good-deed-motivation mirror + RewardCallout
- [x] Step 9 — `/` home wired to both pickers
- [x] Step 10 — browse + quran surah + quote detail
- [x] Step 11 — `/feelings/[tagSlug]`
- [x] Phase 3 done-when evidence recorded below

## Phase 4 — Auth + Favorites

- [x] Additive User schema migration — `49af73e`
- [x] auth / users / favorites modules + endpoints #19–#27 — `49af73e`
- [x] OptionalJwtAuthGuard + isFavorite; RolesGuard; remove AdminApiKeyGuard — `49af73e`
- [x] Throttler on `/auth/*`; seed hashed users — `49af73e`
- [x] Frontend step 12 — login/register/favorites/session/FavoriteButton
- [x] Phase 4b — **blocked** pending owner approval (see BLOCKERS)

## Phase 5 — content-sync

- [ ] ContentProvider + providers (fixture-tested)
- [ ] Run executor, scheduler, SyncLog, endpoints #58–#60
- [ ] Arabic trigram index, CacheModule, helmet/compression
- [ ] Live provider keys — **blocked** without env (see BLOCKERS)

## Phase 6 — Admin / curation UI

- [ ] `/admin` curation slice (dashboard, linking workspace, sync console)

## Phase 7 — Mobile

- [ ] Add `mobile` to pnpm-workspace; Expo scaffold
- [ ] Core screens (guest flows + favorites)
- [ ] EAS / store — **blocked** (see BLOCKERS)

## Phase 8 — a11y + i18n polish

- [ ] a11y + ar/en key parity CI; no invent palette (see BLOCKERS)
- [ ] Final report

---

## Done-when evidence

_(Append actual command output under each phase as it completes.)_

### Phase 3
- `pnpm --filter frontend lint` → exit 0
- `pnpm --filter frontend exec tsc --noEmit` → clean
- `NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm --filter frontend build` → 10 app routes
- `pnpm --filter frontend test` → 4 passed
- Commit: (see feat(frontend) Phase 3 MVP)


### Phase 4
- Backend: 173 unit + 243 e2e green; commit `49af73e`
- Frontend: lint/tsc/build/test green; auth routes + cookie refresh
- Phase 4b skipped → BLOCKERS B-002
