# Pending Work — Approvals + Cursor Prompt

Fill in **Part A** first (tick `[x]` what you approve). Then paste **Part C** into Cursor at the repo root.
Cursor does only what is ticked. Anything unticked stays logged in `BLOCKERS.md`.

---

## Part A — Approvals (owner ticks)

### A-1 · Seed content corrections (P0-4)
Only tick rows you (or a qualified person) have verified.
- [ ] Q11 → new `Sunan Abi Dawud` source, grade `DAIF`
- [ ] Q16 → new `Musnad Ahmad` source, grade `HASAN`
- [ ] Q14, Q15 → grade `SAHIH`
- [ ] Q17 → re-attribute to ʿAlī ibn Abī Ṭālib
- [ ] Q18 → remove it (no replacement text is invented)
- [ ] Q19, Q20 → keep as-is

### A-2 · Phase 4b — Silat ar-Rahim & forgotten deeds (`docs/plan/silat-rahim-plan.md`)
- [ ] Build Phase 4b at all (if unticked, skip everything below)
- [ ] Schema §4 (`add_kinship_reminders` migration, additive)
- [ ] New backend module `modules/kinship/` + frontend slice `features/kinship` (Cursor updates both `.cursorrules`)
- [ ] S1 "forgotten" deed = linked quote tagged `forgotten-deeds` (no schema change)
- [ ] S2 relations list per §4.1, in-laws under `OTHER`
- [ ] S3 reminders only for forgotten deeds
- [ ] S4 dependency `ical-generator` (unticked = hand-written ICS serializer)
- [ ] S5 dependency `qrcode.react` for the subscribe QR (unticked = no QR, copy buttons only)
- [ ] S6–S12 use the plan defaults (09:00 alarm, reject contact details, `…On` names, caps 200/50,
      keep 50 contact logs, monthly day ≤ 28, feed language baked into the link)

### A-3 · Test tooling (new dev dependencies)
- [ ] `@playwright/test` + `@axe-core/playwright` (frontend e2e + accessibility)
- [ ] `msw` (frontend hook tests with a mock API)

---

## Part B — Owner-only actions (Cursor can't do these; it prepares and documents them)

| # | Action | Unblocks |
| --- | --- | --- |
| O-1 | Create a GitHub repo, `git remote add origin …`, push | CI actually runs |
| O-2 | Vercel project (frontend) + Railway project with Postgres (backend), env vars from devops-plan §5 | Staging |
| O-3 | Provider keys: Quran Foundation (quran.com) API client, Sunnah.com API key; set `SYNC_ENABLED=true` in staging | Real content |
| O-4 | Apple Developer + Google Play + Expo accounts, `eas credentials`, `EXPO_TOKEN` secret (see `mobile/RELEASE.md`) | App store builds |
| O-5 | Real brand palette + fonts | Phase 8 design swap |
| O-6 | Real-device check of the calendar feed on iOS + Google Calendar (only if A-2 is approved) | Phase 4b "done when" |

---

## Part C — Prompt for Cursor (repo root)

```
Finish all pending Thekra work. Do not ask me questions — everything you need is in
docs/build/PENDING_WORK_PROMPT.md. Do only what Part A ticks; log everything unticked in BLOCKERS.md and move on.
Keep going until every step below is done or blocked, then give one final report.

Rules: same as docs/AUTONOMOUS_BUILD_PROMPT.md §3–§5 (gates after every step, one commit per step,
Conventional Commits, never weaken a test, product-safety rules, never invent religious text/references/grades).

Steps, in order:

1. Clean tree. There are ~33 uncommitted files (frontend auth routes, api-client, curation views, plan docs,
   new lib/api/fetch-auth-me.ts + map-auth-user.ts). Review them, finish them, run all gates, and commit them in
   logical commits. If a change is broken and can't be finished, revert just that file and log it in DECISIONS.md.

2. Fix the tracking docs.
   - BLOCKERS.md lost the earlier items. Rebuild it as the single list: B-01/B-02 (mobile) plus every item in
     Part B (O-1…O-6) and every unticked item in Part A. Each entry: what's blocked, what's already built, the exact
     owner steps.
   - PROGRESS.md: Phase 4b is ticked [x] but not built — untick it (or tick it only after step 5).
   - FINAL_REPORT.md: point to the rebuilt BLOCKERS IDs.

3. Seed (A-1). Apply only the ticked rows. Add new sources with fixed UUIDs. Run `pnpm db:seed` twice (same
   counts), keep ghibah ≥10 visible quotes by default, update the e2e fixtures/assertions that depend on these rows.

4. Missing tests required by the roadmap (only if A-3 is ticked; otherwise log it).
   - Playwright (`frontend/e2e/`, `playwright.config.ts`, runs against a seeded backend):
     guest picks الغيبة → ≥10 reminders → type filter → "another reminder" reorders → alternatives →
     حفظ اللسان reward; Quran browse by surah; quote detail; ar↔en switches `dir`; guest favorite → sign-in
     prompt → register → favorite persists after reload; USER on /admin → blocked; an expired token degrades
     the reminder page to anonymous.
   - axe: run @axe-core/playwright on every route in ar and en; zero serious/critical violations.
   - msw: hook tests for useSinQuotes (ordering, pagination, shuffle), useToggleFavorite (optimistic + rollback),
     and the api-client envelope unwrap + ApiError mapping.
   - Mobile: tests for the core flow screens' hooks and the offline persister allow-list.
   - Add the Playwright job to ci.yml (Postgres service + seeded backend).

5. Phase 4b (only if A-2 "Build Phase 4b" is ticked). Follow silat-rahim-plan.md §12 steps 1–8 exactly, using
   the ticked choices in A-2 (unticked S4 → hand-written ICS serializer; unticked S5 → no QR). First update
   backend/.cursorrules and frontend/.cursorrules as §14 "Owner actions" describes. Seed only the `forgotten-deeds`
   tag + dev relatives — no invented religious content. Step 9 (real devices) stays in BLOCKERS as O-6.
   Then run every §13 "done when" check you can run locally.

6. Self-audit phases 3–8 against roadmap.md "done when" (like docs/reviews/phase-2-backend-review.md did for
   Phase 2): for each criterion, the command or test that proves it and the actual output. Every gap you find,
   fix it with a test. Write the result to docs/reviews/phases-3-8-audit.md.

7. Final report: steps 1–6 done/blocked with commits and gate output, and the rebuilt BLOCKERS list.
```
