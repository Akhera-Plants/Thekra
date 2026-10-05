# Thekra — Autonomous Build Decisions

Decisions made without stopping for the owner. Format: context → options → choice → why → plan section.

---

## D-BUILD-001 — Skip P0-4 seed corrections

- **Context:** Follow-up D-5 requires owner ticks; all P0-4 rows are unticked.
- **Options:** (a) invent corrections, (b) skip and block, (c) wait.
- **Choice:** (b) skip; log in BLOCKERS.
- **Why:** Non-negotiable — never invent religious content/grades/references.
- **Plan:** AUTONOMOUS_BUILD_PROMPT §2.1, follow-up D-5.

## D-BUILD-002 — Skip Phase 4b until owner approval

- **Context:** silat-rahim-plan requires owner-approved schema + `ical-generator`.
- **Options:** (a) implement proposed schema anyway, (b) block.
- **Choice:** (b) block Phase 4b; continue 5→8.
- **Why:** Roadmap entry condition explicitly requires approval.
- **Plan:** roadmap Phase 4b; silat-rahim-plan §12.

## D-BUILD-003 — Neutral tokens through Phase 8

- **Context:** Phase 8 wants real palette/fonts; owner has not provided them.
- **Options:** (a) invent brand, (b) keep neutral + block.
- **Choice:** (b).
- **Why:** Prompt forbids inventing brand palette/fonts.
- **Plan:** AUTONOMOUS_BUILD_PROMPT §2.8, Phase 8.


## D-BUILD-004 — Phase 3 FE implementation choices

- **proxy.ts** is the next-intl edge entry (no middleware.ts).
- Browse `force-dynamic` page omits `setRequestLocale` (Turbopack client mis-classify).
- Vitest node env + enum smoke only (vite version split blocks @vitejs/plugin-react for now).
- Cross-slice `session-intent.store` shared by sin and good-deed pickers.

## D-BUILD-005 — B-03 was a false blocker

- **Context:** BLOCKERS claimed the API only sets an httpOnly refresh cookie and mobile could not refresh.
- **Reality:** Cookie jar lives in the **Next.js** `/api/auth/*` route handlers. The Nest API already returns
  `{ accessToken, refreshToken, expiresIn }` in the body and `POST /v1/auth/refresh` accepts `{ refreshToken }`
  (see `auth.e2e-spec.ts`). Mobile already persists `refreshToken` in SecureStore.
- **Choice:** Close B-03; add mobile `performRefresh` unit tests; add `jti` on refresh JWTs so rotated tokens
  are observably unique within the same second.
- **Plan:** BLOCKERS_RESPONSE B-03; backend-plan §7.1 transport.

