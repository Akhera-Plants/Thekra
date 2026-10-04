# Thekra (تذكرة) — Technical Implementation Plan

**Thekra** answers two requests at the exact moment they happen: *"I feel tempted to commit a sin"* → return
Quran verses, authentic Hadith and scholarly words that **discourage that specific sin** and point to the way
back; and *"I want to do a good deed"* → return content that **motivates and rewards that specific deed**. The
whole system is therefore one job: resolve **an intent** (a `Sin` or a `GoodDeed`) into **a ranked set of
trustworthy quotes**, Arabic-first, with provenance and authenticity intact. The data model that makes this
possible is already final — a single unified `Quote` table discriminated by `type`/`origin`, attributed through
`Source`, translated through `Translation`, and connected to intents by the two curator-written join tables
`SinQuote` and `GoodDeedQuote` whose `relevanceScore` *is* the ordering the user experiences. These documents
plan the code that turns that schema into a product: a NestJS API, a Next.js web client, a content pipeline that
caches external Quran/Hadith APIs without ever proxying them, and later an Expo mobile app.

> **Scope of this plan set:** phase 2 onward. Phase 1 — the monorepo, the tooling and the Prisma schema — is
> done. This is **documentation only**; no code in `backend/`, `frontend/` or `mobile/` was created or changed.
> For the data model and its rationale, read [ARCHITECTURE.md](./ARCHITECTURE.md) — it is the authority and is
> not repeated here. For the product concept, read [README.md](../README.md). The authoritative schema is
> [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

---

## Table of contents

| Document | What it covers |
| --- | --- |
| [plan/backend-plan.md](./plan/backend-plan.md) | The NestJS module map over the existing `backend/src/modules/*` placeholders, the complete `/v1` REST spec (61 endpoints with auth, params, response shapes and status codes), DTO/validation conventions, the `{ data, meta }` envelope, error shape, pagination, the JWT auth sketch, and the Vitest testing strategy. |
| [plan/frontend-plan.md](./plan/frontend-plan.md) | The Next.js App Router route map over the existing `frontend/src/features/*` slices, the shadcn/ui setup for **Tailwind v4**, the CSS-variable theming plan that keeps the future palette a token change, the `next-intl` Arabic-first RTL plan, the TanStack Query + axios + Zustand data layer, and accessibility for the sensitive "pick a sin" flow. |
| [plan/content-pipeline-plan.md](./plan/content-pipeline-plan.md) | Concrete provider integrations (Quran.com, alquran.cloud, Sunnah.com, HadithAPI.com) with field-by-field mappings to `Quote`/`Source`/`Translation`, `externalId` semantics per provider, grade normalisation, the cron-based idempotent sync with `SyncLog` bookkeeping, backoff and partial-failure handling, the human curation workflow, and the `prisma/seed.ts` specification. |
| [plan/mobile-plan.md](./plan/mobile-plan.md) | The Expo + `expo-router` plan for the reserved `mobile/` folder: screen map mirroring the web routes, how it shares the API contract (not code) with the web client, the offline strategy for favorites, and why it stays a **later phase** that must not be scaffolded now. |
| [plan/devops-plan.md](./plan/devops-plan.md) | Local/staging/production environments, the GitHub Actions job breakdown (including the Prisma migration drift check), deployment recommendations for the API+Postgres and the web app, the `migrate dev` → `migrate deploy` workflow, the full environment-variable inventory, and health-check/rollback procedures. |
| [plan/roadmap.md](./plan/roadmap.md) | Phases 2–8 with goal, concrete scope (modules, endpoints, routes, pipeline pieces) and a "done when" acceptance criterion for each: Core API → Frontend MVP → Auth/Favorites → Content-sync → Curation UI → Mobile → Design swap-in. |

**Suggested reading order for implementation:** `roadmap.md` (what to build when) → `backend-plan.md` (phase 2) →
`content-pipeline-plan.md` §5 (the seed, needed by phase 2) → `frontend-plan.md` (phase 3) → `devops-plan.md`
(continuously) → `content-pipeline-plan.md` §§1–4 (phase 5) → `mobile-plan.md` (phase 7).

---

## Open Decisions / Assumptions

Every judgment call this plan made that the user or Cursor may reasonably want to revisit. **None of these is a
blocker** — each has a chosen default, so the plan is immediately implementable. Revisit any row by changing it
here first, then in the linked section.

### A. API shape & conventions

| # | Question | Decision | Why (and what changes if revisited) | Where |
| --- | --- | --- | --- | --- |
| A1 | **REST or GraphQL?** | **REST** | The client needs are few, fixed and read-heavy; the core screen is one endpoint, so GraphQL's flexibility buys little while adding a schema layer, N+1 risk and caching complexity — and REST stays trivially cacheable and `curl`-testable before any UI exists. | [backend §3](./plan/backend-plan.md#3-rest-api-spec) |
| A2 | **Pagination: offset or cursor?** | **Offset (`page`/`limit`)**, cap 100 | The catalogues are tiny and the phase-6 curation UI needs page numbers and totals; cursor pagination is noted as a phase-5+ upgrade for `/v1/quotes` only, once `API_CACHED` volume makes `COUNT(*)` expensive. | [backend §2.3](./plan/backend-plan.md#23-pagination--page--limit-offset) |
| A3 | **Response envelope?** | **Always `{ data }`, plus `meta` for collections** | Clients never branch on array-vs-object, and pagination/locale metadata can be added later without breaking a consumer. Revisiting means touching one interceptor and one axios interceptor. | [backend §2.2](./plan/backend-plan.md#22-response-envelope) |
| A4 | **API versioning** | **URI prefix `/v1`**, `/health` excluded | Debuggable from a browser and CDN-friendly; the probe path stays stable across versions. | [backend §2.1](./plan/backend-plan.md#21-versioning) |
| A5 | **`relevanceScore` range** | **0–100**, enforced in the DTO | The schema leaves `Int?` unbounded, so the range is an API contract; 0–100 reads as "how on-point" and leaves room between neighbours. A published rubric keeps scores comparable between curators. | [backend §5.2](./plan/backend-plan.md#52-linksinquotedto-endpoint-48--the-curation-dto), [pipeline §4.2](./plan/content-pipeline-plan.md#42-linking-a-quote-to-an-intent--the-editorial-act) |
| A6 | **Mixed quote types in one response** | **One flat `items[]` of `{ link, quote }`**, with `meta.countsByType` | Ranking is cross-type by design — bucketing by type would destroy the `relevanceScore` order that *is* the product; keeping `link` separate from `quote` stops a client caching a quote with a per-intent score baked in. | [backend §3.2](./plan/backend-plan.md#3-get-sinsslugquotes--the-core-endpoint-of-the-product) |
| A7 | **Embed `alternatives` in the sin response?** | **Yes, capped at 3** | The product's answer to temptation is "do this instead"; a second round-trip would make the constructive half arrive late or not at all. | [backend §3.2](./plan/backend-plan.md#3-get-sinsslugquotes--the-core-endpoint-of-the-product) |
| A8 | **Tie-breaking after `relevanceScore`** | `grade asc` (PG enum order puts `SAHIH` first), then `createdAt desc`, then `id` | Among equally relevant reminders, show the more authentic one; the `id` tail guarantees a total order so offset pagination is coherent. Non-hadith rows have `grade = null` and sort last within a score band — accepted, revisit with a computed rank if it misorders in practice. | [backend §3.2](./plan/backend-plan.md#3-get-sinsslugquotes--the-core-endpoint-of-the-product) |
| A9 | **Repeat variety ("another reminder")** | **Seeded deterministic shuffle** within the high-score band only | Pure randomness would bury the best reminder; a seed keeps offset pagination coherent and makes a screen reproducible for review. | [backend §4.2](./plan/backend-plan.md#42-shuffle--variety-mode) |
| A10 | **Separate `GET /hadith/:id`?** | **No** — `GET /quotes/:id` serves it | One resource should not have two URLs; the unified `Quote` table is the whole point. | [backend §3.6](./plan/backend-plan.md#36-hadith) |

### B. Auth & access

| # | Question | Decision | Why | Where |
| --- | --- | --- | --- | --- |
| B1 | **Auth-required or guest-first?** | **Guest-first.** Browsing sins/deeds and reading quotes needs no account; login exists only to sync `Favorite`s | The product serves a moment of temptation or intention — any friction there defeats it, and a sign-up wall in front of a shame-adjacent action is actively harmful. Also means phases 2–3 ship with no auth at all. | [backend §3.8](./plan/backend-plan.md#38-auth-phase-4) |
| B2 | **Session mechanism** | **JWT access (15 min) + rotating refresh (30 d)**, two separate secrets | Stateless, no session store, and ready for the Expo client; separate secrets stop an access token being replayed as a refresh token. | [backend §7.1](./plan/backend-plan.md#71-decisions) |
| B3 | **Password hashing: bcrypt or argon2?** | **argon2** (`argon2id`, OWASP baseline params) | Current recommendation and memory-hard where bcrypt is not; bcrypt cost 12 is the documented fallback if the native build fights the deploy target. | [backend §7.1](./plan/backend-plan.md#71-decisions) |
| B4 | **Token storage on the web client** | Access token **in memory**; refresh token in an **httpOnly cookie** set by a Next route handler | `localStorage` is readable by any XSS; this keeps the long-lived credential out of JS entirely. | [frontend §6.5](./plan/frontend-plan.md#65-authsession-on-the-client-phase-4) |
| B5 | **Global auth guard?** | **No** — opt in per controller with `@UseGuards` | With ~18 public endpoints and 3 protected ones, opting in is clearer than a global guard plus `@Public()` everywhere. A `@Public()` decorator still exists for a future flip. | [backend §7.2](./plan/backend-plan.md#72-pieces) |
| B6 | **Server-side logout / token revocation** | **Not in phase 4** — `/auth/logout` tells the client to drop tokens | A DB write on every refresh is poor value for a single-user-per-device app; the optional `RefreshToken` table is a clean, additive phase-5+ upgrade. Documented honestly rather than implying revocation that does not exist. | [backend §3.8](./plan/backend-plan.md#38-auth-phase-4), [§9](./plan/backend-plan.md#9-proposed-schema-additions) |
| B7 | **Admin access model** | A `role` field on `User` + `RolesGuard`, no separate admin app | One user table, one auth flow; the phase-6 curation UI is just role-guarded routes in the same Next app. | [backend §7.2](./plan/backend-plan.md#72-pieces) |

### C. Proposed schema additions

Phase 1's schema is treated as final. These are the **only** changes this plan proposes, all additive.

| # | Addition | Status | Why | Where |
| --- | --- | --- | --- | --- |
| C1 | **`User.passwordHash String?`** | **Required for phase 4** | The current `User` model has **no credential field at all**, so `POST /auth/login` is literally unimplementable. Nullable, so existing/seeded rows and a future OAuth-only user stay valid. | [backend §9](./plan/backend-plan.md#9-proposed-schema-additions) |
| C2 | **`User.role UserRole @default(USER)`** + `enum UserRole { USER ADMIN }` | **Required for phase 4** | Every `/v1/admin/*` endpoint is role-guarded; without it, admin routes are either unprotected or gated by an env-var whitelist hack. | [backend §9](./plan/backend-plan.md#9-proposed-schema-additions) |
| C3 | `User.lastLoginAt DateTime?` | Optional — **drop it if a minimal diff is preferred** | Cheap and useful for support; nothing depends on it. | [backend §9](./plan/backend-plan.md#9-proposed-schema-additions) |
| C4 | `RefreshToken` model | **Deferred** (not proposed now) | Would make logout a real revocation and enable "sign out everywhere", at the cost of a write per refresh. Revisit if multi-device security becomes a requirement. | [backend §9](./plan/backend-plan.md#9-proposed-schema-additions) |
| C5 | `SyncLog.stats Json?` | **Deferred** — per-run counters go into `errorMessage` as a one-line summary for now | `recordsImported` is a single `Int?`, so `created/updated/skipped/failed` have nowhere structured to live. The summary string plus structured logs covers phase 5; add the column if the curation UI needs the numbers queryably. Flagged as the least elegant compromise in this plan. | [pipeline §3.4](./plan/content-pipeline-plan.md#34-synclog-bookkeeping) |
| C6 | Normalised-text column + `pg_trgm` GIN index | **Phase 5, as a raw-SQL migration** | Not expressible in the Prisma schema, and unnecessary until `API_CACHED` volume makes `ILIKE` slow. | [backend §4.4](./plan/backend-plan.md#44-arabic-text-search) |
| C7 | Mapping Sunnah.com's `chapterTitle` onto a `Quote` column | **No** — keep it in `rawPayload` only | `pageOrChapter` is a book/scholar field; overloading it with hadith chapter semantics muddies the model, and `hadithReference` already covers citation. Easy to revisit since `rawPayload` retains the data. | [pipeline §2.3](./plan/content-pipeline-plan.md#23-sunnahcom-api--primary-hadith-provider) |

### D. Content pipeline

| # | Question | Decision | Why | Where |
| --- | --- | --- | --- | --- |
| D1 | **Queue technology: cron or BullMQ+Redis?** | **`@nestjs/schedule` in-process cron for phase 5**; BullMQ+Redis noted as a later-scale upgrade | No new infrastructure for a handful of slow, idempotent, low-frequency batch imports; `SyncLog` already provides the run history a queue dashboard would give. `triggerRun()` returns a `SyncLog` handle immediately, so moving execution into a queue later changes only *who calls the executor*. | [pipeline §3.1](./plan/content-pipeline-plan.md#31-scheduler-choice--nestjsschedule-cron-now-bullmq-later) |
| D2 | **Multi-instance cron duplication** | **Postgres advisory lock + a `SyncLog` `PENDING`/`RUNNING` guard** | Makes a duplicate firing harmless without adding Redis; **verify it before scaling past one API instance**. | [pipeline §3.3](./plan/content-pipeline-plan.md#33-run-lifecycle) |
| D3 | **Primary providers** | **Quran.com** (Quran) and **Sunnah.com** (Hadith); **alquran.cloud** and **HadithAPI.com** as configured fallbacks | Canonical referencing from the primaries; the fallbacks have different auth and failure domains, and HadithAPI.com's `status` filter is the fastest path to a `Sahih`-only starter library. | [pipeline §2](./plan/content-pipeline-plan.md#2-provider-integrations) |
| D4 | **Provider auth uncertainty** | Adapters take an **optional** token/key from config and treat `401`/`403` as a configuration error | Quran.com's hosted API has been moving toward issued client credentials; the adapter must not fail mid-run over it. **Verify the current requirement at integration time.** | [pipeline §2.1](./plan/content-pipeline-plan.md#21-qurancom-api--primary-quran-provider) |
| D5 | **Same ayah from two providers** | **Two `Quote` rows** (`externalId` is namespaced by `apiProvider`); a config-driven preference picks one for the detail endpoint | Different orthography and different provenance are genuinely different rows; cross-provider deduplication should be an explicit product decision, not an accident of the key. | [pipeline §2.5](./plan/content-pipeline-plan.md#25-externalid-semantics--the-idempotency-key) |
| D6 | **Can a curator edit `API_CACHED` text?** | **No** — provider-owned fields are read-only; a curator **forks** to a `LOCAL` quote | Otherwise the next sync silently overwrites the edit. Enforced with `422 FIELD_OWNED_BY_PROVIDER`. | [pipeline §1](./plan/content-pipeline-plan.md#1-principles-inherited-not-re-decided) |
| D7 | **Automated classification?** | **Never writes a link.** Suggestions may shortlist candidates; a human writes every `SinQuote`/`GoodDeedQuote` | Directly inherited from [ARCHITECTURE §2](./ARCHITECTURE.md#2-dynamic-content-strategy); the sin→reminder mapping is editorial judgment and is the product's quality core. | [pipeline §4](./plan/content-pipeline-plan.md#4-curation-workflow-human-editorial-step) |
| D8 | **Conflicting hadith grades** | **Take the weakest** (`DAIF` beats `SAHIH`); unmapped strings → `UNGRADED` and logged | Under-claiming authenticity is the safe failure mode; `MAWDU` is never served and never linkable. | [pipeline §2.6](./plan/content-pipeline-plan.md#26-grade-normalisation-hadithgrade) |
| D9 | **Weak/ungraded narrations in the default feed** | Default `grades = SAHIH,HASAN`; `DAIF` opt-in; `UNGRADED` excluded by default | `API_CACHED` rows often arrive ungraded, and showing them in a reminder would misrepresent authenticity. | [backend §4.3](./plan/backend-plan.md#43-grade-policy-moduleshadithgrade-policyts) |
| D10 | **Search for Arabic text** | **Normalise (tashkeel/hamza/alef folding) + `ILIKE`** in phase 2; `pg_trgm` in phase 5; **no dedicated search engine** | Postgres has no Arabic stemming dictionary, and the corpus is small; Meilisearch/OpenSearch is real infrastructure for a problem that does not exist yet. | [backend §4.4](./plan/backend-plan.md#44-arabic-text-search) |
| D11 | **Seed script runner** | `node prisma/seed.ts` (Node 24 strips types natively), registered via **`prisma.config.ts`**; `tsx` only if that fails | The backend is ESM and Prisma 6.19 prefers `prisma.config.ts` over the legacy `package.json#prisma` key — **verify against the installed CLI**, and keep only one registration. | [pipeline §5.1](./plan/content-pipeline-plan.md#51-mechanics) |

### E. Frontend

| # | Question | Decision | Why | Where |
| --- | --- | --- | --- | --- |
| E1 | **Tailwind v3-style config or v4 CSS-first?** | **v4 CSS-first — do not create `tailwind.config.ts`** | The repo already runs `tailwindcss@^4` via `@tailwindcss/postcss` with tokens in `globals.css`'s `@theme inline`. shadcn's `components.json` must therefore set `tailwind.config: ""`; pointing it at a non-existent config is the most likely setup mistake. **This is the single biggest deviation from most shadcn tutorials.** | [frontend §0](./plan/frontend-plan.md#0-ground-truth-about-the-scaffolded-frontend-verified-do-not-re-derive), [§3.1](./plan/frontend-plan.md#31-init) |
| E2 | **Theming before the real palette exists** | **shadcn CSS variables with `cssVariables: true` and `baseColor: neutral`**, plus custom `--grade-*` / `--intent-*` tokens | Components reference only semantic utilities, so the designer's palette lands as values in one CSS block; reserving grade/intent tokens now prevents a component rewrite when hadith grades and the two flows get visual identity. | [frontend §4](./plan/frontend-plan.md#4-theming-plan--deferring-the-real-palette-) |
| E3 | **Add dark mode now or later?** | **Now, with `next-themes` and neutral colours** | Retrofitting dark mode after the palette lands is the expensive order; doing it now means the designer fills in one extra column of values. Also replaces the generator's `prefers-color-scheme` block, which a user toggle cannot override. | [frontend §4.2](./plan/frontend-plan.md#42-lightdark-now-colours-later) |
| E4 | **i18n library** | **`next-intl`** | The App-Router-native option: locale-segment routing, server *and* client translations from one catalogue, and ICU plurals — which Arabic's six plural categories actually need. | [frontend §5.1](./plan/frontend-plan.md#51-library-next-intl) |
| E5 | **When to introduce the `[locale]` segment?** | **Early in phase 3, before routes are built** | It moves `app/layout.tsx` and `app/page.tsx` under `app/[locale]/`; doing it in phase 8 would mean relocating a dozen route files. | [frontend §5.2](./plan/frontend-plan.md#52-files) |
| E6 | **Default locale / URL shape** | **`ar` default, `localePrefix: 'as-needed'`** (`/sins/ghibah`, `/en/sins/ghibah`) | Arabic is the audience's and the content's language; clean Arabic URLs, prefixes only for English. | [frontend §5.2](./plan/frontend-plan.md#52-files) |
| E7 | **UI language vs content language** | UI locale switches labels and `dir`; **`textAr` is always shown**, with a translation attached beneath | The Arabic text is the source of truth; silently substituting a translation for scripture is unacceptable. Enforced on both the API and the client. | [frontend §5.5](./plan/frontend-plan.md#55-content-vs-ui-language--the-critical-distinction) |
| E8 | **Arabic font** | **Placeholder `Noto Naskh Arabic`** via a `--font-arabic` variable, final choice with the design | Naskh is the appropriate register for scripture; the variable means the swap is a one-line font declaration. Amiri / KFGQPC Uthmanic are the realistic alternatives for verse display. | [frontend §4.3](./plan/frontend-plan.md#43-typography-placeholder-) |
| E9 | **Where composed components live** | `components/ui/*` generated and **not hand-edited**; `QuoteCard` and friends in `components/shared/quote/`; flow-specific pieces in `features/<slice>/components/` | Four slices render quotes identically, so the card must not live inside one of them; keeping the primitives regenerable keeps `shadcn add` usable later. | [frontend §3.3](./plan/frontend-plan.md#33-where-composed-components-live--the-rule-that-protects-the-design-swap) |
| E10 | **Server or client rendering for the core screens** | **Server-render the intent header, client-render the quote list**, with server prefetch + `HydrationBoundary` | The header is stable and SEO-relevant; the list is interactive and personalised by `isFavorite`. Prefetching means the first reminders paint with no spinner. | [frontend §2.1](./plan/frontend-plan.md#21-rendering-strategy-per-route) |
| E11 | **Zustand's scope** | **Only** picker open/mode, last-viewed intent, variety seed, and persisted device preferences | Anything answerable by a query or readable from the URL does not belong in a client store; duplicating server state there is the usual source of drift. | [frontend §6.6](./plan/frontend-plan.md#66-zustand--deliberately-tiny) |
| E12 | **`refetchOnWindowFocus`** | **Off** | Refetching would reshuffle a reminder screen someone is actively reading — actively bad for this product, even though it is a sensible default elsewhere. | [frontend §6.4](./plan/frontend-plan.md#64-query-conventions) |
| E13 | **Frontend test runner** (none configured today) | **Vitest + Testing Library + `msw`**, Playwright for E2E from phase 4 | Matches the backend's runner, so one mental model; `msw` fixtures are copied from this plan's response examples and double as a contract check. | [frontend §9](./plan/frontend-plan.md#9-testing-frontend) |
| E14 | **Numerals in Arabic (`٤٩:١٢` vs `49:12`)** | **Arabic-Indic by default in `ar`**, user-switchable in `/settings` | A genuine product preference with no objectively right answer; making it a setting costs one token and avoids guessing. | [frontend §5.3](./plan/frontend-plan.md#53-dir-handling) |

### F. Mobile

| # | Question | Decision | Why | Where |
| --- | --- | --- | --- | --- |
| F1 | **When to build it** | **Phase 7**, after the API has been stable for a full phase | An app-store client cannot be redeployed like a web page; shipping it before response shapes settle guarantees a `/v2`. `mobile/` stays README-only until then. | [mobile §1](./plan/mobile-plan.md#1-why-mobile-is-phase-7-not-earlier) |
| F2 | **Offline storage: `expo-sqlite` or `AsyncStorage`?** | **`AsyncStorage` + the TanStack Query persister** | The offline set is favorites plus a few viewed intents — tens of documents, nothing to join; persisting the existing query cache costs ~20 lines and no new data-access layer, where SQLite would mean a second schema and a read-through layer under every hook. Upgrade trigger: a real "download a collection and search it offline" feature. | [mobile §6](./plan/mobile-plan.md#6-offline-strategy) |
| F3 | **Code sharing with the web** | **Contract and conventions only in phase 7**; `packages/shared-types` is a documented future option, not built | A shared package earns its cost only with two real consumers and a settled contract; until then the duplicated `types/api.ts` is cheap and visible. | [mobile §5](./plan/mobile-plan.md#5-relationship-to-the-web-frontend) |
| F4 | **Generate types from the API?** | **Recommended when mobile starts** — `@nestjs/swagger` → OpenAPI → `openapi-typescript` into `@thekra/shared-types` | Turns contract drift into a failing build instead of a runtime bug; premature before a second client exists. | [mobile §5.2](./plan/mobile-plan.md#52-packagesshared-types--a-future-option-not-built-now) |
| F5 | **Push notifications** | **Out of scope** | The product is on-demand by definition — a content push contradicts the premise in [README.md](../README.md). Revisit only as a user-configured intention reminder. | [mobile §3.1](./plan/mobile-plan.md#31-mobile-only-affordances-justified-not-gratuitous) |
| F6 | **Mobile component kit** | RN primitives, optionally `react-native-reusables`; **not** shadcn/ui | shadcn is Radix + DOM. Shared token *names* carry the design system across; components do not. | [mobile §2](./plan/mobile-plan.md#2-stack) |

### G. DevOps

| # | Question | Decision | Why | Where |
| --- | --- | --- | --- | --- |
| G1 | **Backend + Postgres host** | **Railway** recommended; **Fly.io** the alternative; **not AWS** at this stage | Lowest operational overhead for a small team, with Postgres, private networking and a release command for `prisma migrate deploy` in one project. A committed `backend/Dockerfile` keeps the choice cheap to reverse. **Recommendation, not a commitment.** | [devops §3.1](./plan/devops-plan.md#31-backend--postgres--railway-recommended-flyio-as-the-alternative) |
| G2 | **Frontend host** | **Vercel** | First-party Next 16 support and per-PR previews — genuinely valuable when the palette lands late and every preview is a review artifact. | [devops §3.2](./plan/devops-plan.md#32-frontend--vercel-recommended) |
| G3 | **Redis / caching layer** | **None until phase 5**, then in-memory `CacheModule` + `Cache-Control`; Redis only once there are multiple instances | The catalogues are tiny and Postgres is adjacent; Redis is infrastructure without a current problem. | [backend §4.5](./plan/backend-plan.md#45-caching) |
| G4 | **CI coverage gate** | **Not a gate before phase 5**; target 80 % on services | Gating coverage during early scaffolding produces test theatre; the named must-have test cases are the real bar. | [backend §11.2](./plan/backend-plan.md#112-e2e-tests) |
| G5 | **Migration drift protection** | **`prisma migrate diff --exit-code` in CI** | Catches the most common real mistake — editing `schema.prisma` without committing a migration. Highest-value Prisma guard available. | [devops §2.1](./plan/devops-plan.md#21-ciyml--on-pull_request-and-on-push-to-main) |
| G6 | **Observability** | **`nestjs-pino`** + a `/health` + `/health/ready` pair; metrics deferred | Nest's built-in logger emits unstructured strings, unusable for querying on a hosted platform — and this app has an auditable pipeline worth correlating against. | [backend §8](./plan/backend-plan.md#8-observability) |
| G7 | **Where sync jobs are first enabled** | **Staging**, never locally or in CI (`SYNC_ENABLED=false` by default) | Real provider auth, rate limits and payload drift are the pipeline's highest-variance risks and cannot be rehearsed locally; CI must never call an external API. | [devops §1](./plan/devops-plan.md#1-environments) |

### H. Repo-state findings that need an action (not open questions — just do them)

| # | Finding | Action | Where |
| --- | --- | --- | --- |
| H1 | **`backend/.env.example` sets `PORT=3000` and `frontend/.env.example` points at `http://localhost:3000`** — which is also `next dev`'s port | Move the API to **3001** and update both `.env.example` files in one commit at the start of phase 2. | [devops §0](./plan/devops-plan.md#0-repo-facts-this-plan-must-respect) |
| H2 | **The project is not a git repository yet** (`git status` → *not a git repository*) | `git init`, first commit, remote — a prerequisite for any CI work in phase 2. | [devops §0](./plan/devops-plan.md#0-repo-facts-this-plan-must-respect) |
| H3 | The existing `backend/test/app.e2e-spec.ts` asserts `GET /` returns `Hello World!` | Adding the `/v1` global prefix breaks it. Update or delete it **in the same commit** that adds the prefix. | [backend §11.2](./plan/backend-plan.md#112-e2e-tests) |
| H4 | `frontend/src/app/globals.css` sets `body { font-family: Arial, Helvetica, sans-serif }` | Remove it during the shadcn step — it silently overrides the font variables. | [frontend §4.3](./plan/frontend-plan.md#43-typography-placeholder-) |
| H5 | `frontend/AGENTS.md` is auto-written by `next dev` and instructs readers to check `node_modules/next/dist/docs/` | Keep the block (deleting it just re-creates the diff) and **follow it**: this Next version post-dates most training data, so verify API details against the bundled docs. | [frontend §0](./plan/frontend-plan.md#0-ground-truth-about-the-scaffolded-frontend-verified-do-not-re-derive) |
| H6 | The backend is **ESM** (`"type": "module"`, `nodenext`) and lints with **oxlint**, not ESLint | Every relative import needs a `.js` extension; do not add Jest or an ESLint config to `backend/`. | [backend §0](./plan/backend-plan.md#0-ground-rules-taken-from-the-existing-repo-do-not-re-derive) |
| H7 | `pnpm-workspace.yaml` uses an **`allowBuilds`** allow-list and the root `engines.node` is `>=24` | CI must run Node 24; a blocked install script is fixed by adding the package to `allowBuilds`, not by disabling the check. | [devops §0](./plan/devops-plan.md#0-repo-facts-this-plan-must-respect) |
| H8 | No dependency required by this plan is installed yet (`@nestjs/jwt`, `@nestjs/schedule`, `nestjs-pino`, `next-intl`, `next-themes`, shadcn's deps…) | Each phase's implementing commit installs its own list. **No install was run in this planning task.** | [backend §10](./plan/backend-plan.md#10-dependencies-to-add-none-installed-in-this-task), [frontend §8](./plan/frontend-plan.md#8-dependencies-to-add-nothing-installed-in-this-task) |

### I. Standing assumptions

1. **Arabic is primary** everywhere — `textAr` is required and never hidden, `ar` is the default locale, RTL is the default direction. English is a secondary UI language with optional translations attached.
2. **The data model in [ARCHITECTURE.md](./ARCHITECTURE.md) is final for phase 1** and was not redesigned. Only the additions in §C are proposed, and each is additive.
3. **Existing folder names are fixed** — `backend/src/modules/{quran,hadith,sins,good-deeds,classification,content-sync}` and `frontend/src/features/{sin-reminder,good-deed-motivation,quran-hadith-browser,favorites}` are filled in place, never renamed.
4. **Cache, don't proxy** — a user request never triggers an outbound provider call. This is why a provider outage cannot break the core loop, and why disabling sync is a safe incident response.
5. **The core loop outranks everything.** When a trade-off appears, `GET /v1/sins/:slug/quotes` and `GET /v1/good-deeds/:slug/quotes` win: they get the most detail, the most tests, and the performance attention.
6. **Content integrity is a correctness guarantee, not a preference.** `MAWDU` is never served; `DAIF` only on explicit opt-in; provenance always travels with the text.
7. **Privacy of intent.** A user's sin selection is never attributed to an account and never sent to analytics. It is a trust requirement for this product and is called out in both the frontend plan and phase 8.
8. **A single API instance** is assumed until there is load; scaling past one requires verifying the sync advisory lock first.
9. **One curator initially.** The curation flow is designed for a human with a REST client in phase 5 and a UI in phase 6 — no multi-curator review workflow, approval queue, or audit trail beyond `SyncLog` is planned.
10. **No analytics, payments, social features, or user-generated content** are in any planned phase.
