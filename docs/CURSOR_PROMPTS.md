# Cursor Kickoff Prompts

Two reusable prompts — one per package. Paste the matching one into Cursor's agent/auto mode **each time you
start or resume implementation work**, in that package's own Cursor window (`backend/` and `frontend/` are each
opened as their own Cursor project root).

They are deliberately **phase-agnostic**: instead of hardcoding "do Phase 2", each prompt tells Cursor to figure
out what's already built and what the next roadmap phase is, every time. Re-use the same prompt at every session.

Both rely on files already in the repo and already auto-loaded by Cursor for that package
(`.cursorrules`, and for the frontend also `.cursor/rules/design-system.mdc`) — the prompts reinforce and
activate that discipline at the start of a session rather than repeating it.

---

## Backend — paste in the `backend/` Cursor window

```
You are implementing the Thekra backend (NestJS + Prisma + PostgreSQL). This is a real product being built to
production quality, not a prototype or a demo.

Before writing any code, do this in order:
1. Re-read `.cursorrules` in this folder. It governs HOW you write code here and is not optional guidance.
2. Read `../docs/plan/roadmap.md`. Inspect the actual repo state (`src/modules/*`, `prisma/schema.prisma`,
   installed dependencies, existing tests) to determine which phase is genuinely next and what is already done —
   don't assume a phase number from memory or from a previous summary.
3. Tell me, before writing code, which phase you believe is next and why, in one or two sentences. If it isn't
   obvious, ask me instead of guessing.
4. Read `../docs/plan/backend-plan.md` in full for that phase's scope. Follow its "Build order for Cursor"
   section (§12) exactly, one numbered step at a time — do not reorder it, do not skip ahead to a module whose
   listed dependencies aren't built yet.
5. Read `../docs/ARCHITECTURE.md` and `prisma/schema.prisma` before touching the data model. You should almost
   never need to change it — see "Schema Changes Are Exceptional" in `.cursorrules`.

Execution discipline, every step:
- After each step: run `pnpm --filter backend lint`, `pnpm --filter backend test` for the module you touched,
  and `pnpm --filter backend exec prisma validate` if the schema changed. Do not start the next step while any
  of these are red.
- Implement the "must-have test cases" table in backend-plan.md §11 as real tests for every module you build — a
  module is not done without them.
- Follow the REST spec in backend-plan.md §3 exactly: path, auth requirement, request/response shape, status
  codes. Never invent a different envelope, pagination style, or error shape for a single endpoint.
- Treat the product-safety rules in `.cursorrules` (hadith grade policy, upsert-only curation links,
  content-sync never writing a SinQuote/GoodDeedQuote link, Arabic text always returned, `rawPayload`/password
  hashes never serialized) as correctness bugs if violated — not style preferences.
- Commit after each completed, green step with a Conventional Commit message (e.g. `feat(sins): add GET
  /v1/sins/:slug/quotes`). If this isn't a git repository yet, `git init` and make an initial commit of the
  current tree before your first change.
- Never add a dependency outside backend-plan.md §10's list for the current phase without asking me first.
- If you hit a real conflict between a plan document and the actual repo/framework behavior (a deprecated API, a
  missing file, a decision that doesn't fit reality), STOP, state the conflict and your recommended resolution,
  and wait for my answer — do not silently pick one and keep going.

When you believe the phase is complete: tell me exactly which of roadmap.md's "done when" criteria for that
phase are met, how you verified each one (the command you ran and its actual result — not "it should work"),
and what, if anything, you deliberately deferred.
```

---

## Frontend — paste in the `frontend/` Cursor window

```
You are implementing the Thekra frontend (Next.js 16 + Tailwind v4 + shadcn/ui). This is a real product being
built to production quality, not a prototype or a demo. No final color palette/branding exists yet — build
against the neutral placeholder theme and never invent or guess at final colors/fonts.

Before writing any code, do this in order:
1. Re-read `.cursorrules` (general code style, this project's facts) and `.cursor/rules/design-system.mdc`
   (visual/motion/performance/component-architecture standards) in this folder. Both govern this session and are
   not optional guidance.
2. Read `../docs/plan/roadmap.md`. Inspect the actual repo state (`src/components/ui/*`, `src/features/*`,
   installed dependencies, `src/app/globals.css`) to determine which phase is genuinely next and what is already
   done — don't assume a phase number from memory or from a previous summary.
3. Tell me, before writing code, which phase you believe is next and why, in one or two sentences. If it isn't
   obvious, ask me instead of guessing.
4. Read `../docs/plan/frontend-plan.md` in full for that phase's scope. Follow its "Build order for Cursor"
   section (§10) exactly, one step at a time.
5. If the phase needs real data from the backend, confirm with me whether the backend's corresponding phase is
   actually running locally. If it isn't, build against the documented response shapes in
   `../docs/plan/backend-plan.md` §3 and say so explicitly rather than inventing different shapes.

Execution discipline, every step:
- After each step: run `pnpm --filter frontend lint` and `pnpm --filter frontend build`. Do not start the next
  step while either is red.
- Follow `design-system.mdc` strictly and treat its "Never do this" checklist (§8) as a pre-commit gate for every
  component you touch: semantic color tokens only (no raw palette classes or hex/oklch literals — this is what
  keeps the real palette a values-only swap later), `lucide-react` only for icons, the Core Web Vitals rules
  (server-rendered intent header, skeletons matching real content geometry, debounced search, respecting
  `prefers-reduced-motion`), and the component patterns (one config-map lookup for a discriminated type instead
  of scattered conditionals; shared components stay presentational with explicit loading/empty/error states;
  `class-variance-authority` for 3+ visual variants).
- Everything you build must work in both `ar` (RTL, default) and `en` (LTR) — use logical Tailwind utilities
  (`ps-*`/`pe-*`/`ms-*`/`me-*`) in shared/cross-direction code, never `pl-*`/`pr-*`/`ml-*`/`mr-*` there.
- Next.js 16 is newer than your training data. Verify any App Router / Image / routing API you're unsure of
  against `node_modules/next/dist/docs/` before using it, per `.cursorrules`. Already-known deprecations to
  apply, not rediscover: `middleware.ts` is now `proxy.ts`; `next/image`'s `priority` prop is now
  `preload`/`fetchPriority`.
- Commit after each completed, green step with a Conventional Commit message. If this isn't a git repository
  yet, `git init` and make an initial commit of the current tree before your first change.
- Never add a dependency outside frontend-plan.md §8's list for the current phase without asking me first.
- Don't build ahead into a later phase's scope (e.g. auth screens, favorites persistence, or the admin UI before
  their phase) even if it seems convenient while you're in a related file.
- If you hit a real conflict between a plan document and the actual repo/framework behavior, STOP, state the
  conflict and your recommended resolution, and wait for my answer — do not silently pick one and keep going.

When you believe the phase is complete: tell me exactly which of roadmap.md's "done when" criteria for that
phase are met, how you verified each one (command + result, and what you checked manually in the browser in
both locales), and what, if anything, you deliberately deferred.
```
