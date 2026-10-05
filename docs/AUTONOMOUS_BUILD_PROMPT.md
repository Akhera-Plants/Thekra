# Autonomous Build Prompt — everything, one run

Open Cursor at the **repo root** (`Thekra/`), agent mode, then paste the block below.
If Cursor stops (context or run limit), paste the **same block** again — it resumes from `docs/build/PROGRESS.md`.

---

```
You are building the whole Thekra product end to end: backend, frontend, and mobile, to production quality.
Do NOT stop to ask me questions. Do NOT stop between phases. Keep working until every phase in
docs/plan/roadmap.md (2 → 8) is done or explicitly blocked, then give one final report.

## 0. Resume first
If docs/build/PROGRESS.md exists, read it and continue from the first unchecked item. Never redo checked items.
If it does not exist, create these three files before writing any code:
- docs/build/PROGRESS.md  — checklist of every phase and every numbered build-order step from the plans below.
  Tick an item only after its gates (§3) are green and it is committed.
- docs/build/DECISIONS.md — every decision you make on your own: context, options, choice, why, plan section.
- docs/build/BLOCKERS.md  — anything that needs me (credentials, accounts, content sign-off). For each: what is
  blocked, what you built instead (stub/fixture/feature flag), and the exact step I must do.

## 1. Sources of truth (read before each phase, they win over your memory)
- Order and "done when" criteria: docs/plan/roadmap.md
- Backend: docs/plan/backend-plan.md (+ backend/.cursorrules — read it, it does not auto-load from the root)
- Content sync + seed: docs/plan/content-pipeline-plan.md
- Frontend: docs/plan/frontend-plan.md (+ frontend/.cursorrules, frontend/.cursor/rules/design-system.mdc,
  frontend/AGENTS.md — Next.js 16: verify APIs in frontend/node_modules/next/dist/docs/)
- Mobile: docs/plan/mobile-plan.md · DevOps: docs/plan/devops-plan.md
- Data model: docs/ARCHITECTURE.md + backend/prisma/schema.prisma · Decisions: docs/TECHNICAL_PLAN.md
- Open backend items: docs/reviews/phase-2-backend-review-followup.md ("Still open")

## 2. Order of work
1. Phase 2 leftovers: P2-1, P2-4, cheap P3 items from the review. P0-4 seed corrections: apply ONLY rows
   ticked in the follow-up file; if none are ticked, log it in BLOCKERS.md and move on.
2. DevOps that needs no account: .github/workflows/ci.yml (lint, typecheck, prisma validate + drift check,
   unit, e2e with a Postgres service, build — for backend and frontend), backend/Dockerfile, root scripts.
3. Phase 3 — Frontend MVP, following frontend-plan.md §10 steps 1–11 in order, against the real API on :3001.
4. Phase 4 — Auth + favorites: the additive schema migration (backend-plan §9), auth/users/favorites modules,
   OptionalJwtAuthGuard + isFavorite, RolesGuard on all /admin/* (then remove the temporary AdminApiKeyGuard),
   throttler, seed users with hashed dev passwords, then the frontend part (frontend-plan §10 step 12).
5. Phase 5 — content-sync: providers, run executor, scheduler, SyncLog, endpoints #58–#60, Arabic trigram index,
   cache, helmet/compression. Every provider is tested with fixtures only — never call a real API in tests.
6. Phase 6 — Admin/curation UI in the frontend.
7. Phase 7 — Mobile (Expo) per mobile-plan.md §7; add `mobile` to pnpm-workspace.yaml.
8. Phase 8 — a11y + i18n completeness + polish. Do NOT invent a brand palette or fonts — keep the neutral
   tokens and log "real palette/fonts" in BLOCKERS.md.

## 3. Gates — after every step, before committing
- Backend: pnpm --filter backend lint · exec tsc --noEmit -p tsconfig.json · test · test:e2e · exec prisma validate
- Frontend: pnpm --filter frontend lint · build · tsc --noEmit · test (once tests exist)
- Mobile: pnpm --filter mobile lint · tsc --noEmit · test
If a gate is red, fix it before moving on. Never skip, disable, or weaken a test or lint rule to get green.
Commit after each green step: Conventional Commits, scope = package/module, e.g. `feat(frontend): add QuoteCard`.
At the end of each phase, run that phase's "done when" checks from roadmap.md and record the actual command
output in PROGRESS.md. A phase is not done on "should work".

## 4. When you would normally stop and ask — decide instead
- Plan vs. reality conflict (deprecated API, missing file, version mismatch): choose the option closest to the
  plan's intent, log it in DECISIONS.md, continue.
- Missing dependency not listed in the plan: add it only if it is the standard, maintained choice for that
  job; log it in DECISIONS.md.
- Needs a human (API keys, Vercel/Railway/EAS/App Store accounts, a git remote, real palette, Islamic-content
  sign-off): build everything up to that point behind env vars / feature flags / fixtures, log it in BLOCKERS.md,
  continue with the next item. Never fake a credential and never commit a secret.
- Never stop because a phase is "big". Split it into the plan's build-order steps and keep going.

## 5. Non-negotiables (correctness, not style)
- Hadith grade policy everywhere: MAWDU never served; DAIF/UNGRADED only on explicit opt-in. Grade filters
  never drop Quran verses.
- textAr always returned; a translation never replaces Arabic. rawPayload and passwordHash never serialised.
- Guest-first: the sin and good-deed flows never require an account.
- content-sync never writes SinQuote/GoodDeedQuote. Users never hit external providers; they read Postgres only.
- Do not change existing schema semantics. Additive migrations only, each with its own migration file.
- Never invent Quran text, hadith text, references, or grades. New religious content comes only from
  providers (Phase 5) or from me.
- Frontend/mobile: semantic colour tokens only, RTL-first with logical properties, ar default + en.
- Privacy: a sin selection is never tied to an account or sent to analytics.
- Every new endpoint ships with a unit test and an e2e test in the same commit.

## 6. Final report (only when everything is done or blocked)
Per phase: done / partially done / blocked, the "done when" checks with real output, commit range.
Then the full BLOCKERS.md list with the exact actions I need to take, and the DECISIONS.md summary.
```

---

## Before you paste

- **Tick the P0-4 seed rows** in `docs/reviews/phase-2-backend-review-followup.md` that you've verified. Rows
  you don't tick won't be applied.
- **Local only for now:** Postgres up (`docker compose up -d`), backend on `:3001`.
- **Optional keys** (put them in `backend/.env`, never commit them): Quran.com / Quran Foundation API client,
  Sunnah.com API key. Without them, Phase 5 is built and tested on fixtures, and live sync waits in BLOCKERS.md.
- **Accounts Cursor can't create:** a GitHub remote (for CI to actually run), Vercel, Railway, Expo/EAS, Apple,
  Google Play. Everything up to that point gets built, and the deploy steps get listed for you.
