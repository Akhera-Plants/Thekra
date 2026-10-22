# Thekra — Delivery Roadmap

> Phased delivery from **phase 2 onward**. Phase 1 (monorepo structure, tooling, and the Prisma data model) is
> **done** — see [README.md](../../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).
> Each phase below is independently shippable and independently verifiable.
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [backend-plan.md](./backend-plan.md) ·
> [frontend-plan.md](./frontend-plan.md) · [content-pipeline-plan.md](./content-pipeline-plan.md) ·
> [mobile-plan.md](./mobile-plan.md) · [devops-plan.md](./devops-plan.md) · [silat-rahim-plan.md](./silat-rahim-plan.md)
> Vision v2 (three paths, شعب الإيمان, explanations, book import; lettered Phases **3b** and **5b**, Phase 4b
> amended): [vision-v2-plan.md](./vision-v2-plan.md)

---

## Overview

| Phase | Name | Goal in one line | Primary artifact |
| --- | --- | --- | --- |
| 1 ✅ | Structure & schema | Monorepo, tooling, authoritative data model | `schema.prisma` |
| 2 | Core API + seed data | The core loop answerable over HTTP, testable with a REST client | Working `/v1` API |
| 3 | Frontend MVP | The two core flows usable in a browser, neutral theme | Web app |
| 3b | Three paths & شعب الإيمان | A third guest path (شعب الإيمان), sin rank (كبيرة/صغيرة), تفسير/شرح explanations, Dorar "read more" links — **proposed** | Branches + explanations |
| 4 | Auth + Favorites | Saved quotes that survive a device change | Accounts |
| 4b | Silat ar-Rahim & forgotten deeds | Private kinship reminders via an in-app due list + calendar feed; a guest-visible forgotten deed of the week | Kinship list + ICS feed |
| 5 | Automated content-sync | Real external content replacing seed data | Populated library |
| 5b | Book corpus import & tafsir | Classical works imported from clean digital texts (never PDFs/OCR) + cached tafsir — **proposed** | Imported library |
| 6 | Admin / curation UI | Curating without a REST client | Curation UI |
| 7 | Mobile app | The product where the moment of need actually happens | iOS + Android |
| 8 | Design system swap-in | Real palette/branding/fonts + a11y + i18n completeness | Shipping product |

Sequencing rules that justify this order: **the data must exist before the UI** (2 before 3); **the UI must be
proven before accounts** (3 before 4, since favorites are the only reason to sign in); **the API must be stable
before an app-store client** (4 before 7); **the design swap is last** because phases 3–7 are explicitly built to
make it a token change ([frontend-plan §4.4](./frontend-plan.md#44--exactly-what-changes-on-design-day)).
**Phase 4b comes after 4** because it is the second (and only other) feature that needs an account; it is
lettered rather than numbered so that every existing "phase 5…8" reference stays valid.
**Phase 3b follows 3** because it adds a third guest-first intent on top of the shipped core loop and needs no
account; **Phase 5b follows 5** because it is content ingestion reusing Phase 5's `SyncLog`, grade mapper and
providers (and 3b's schema for branch linking and tafsir). Both are lettered for the same reason as 4b. Repo fact:
phases 3–8 are already largely built, so 3b and 5b are built on top of shipped code
([vision-v2-plan §11](./vision-v2-plan.md#11-phase-placement)).

---

## Phase 2 — Core API + seed data

**Goal:** `GET /v1/sins/:slug/quotes` and `GET /v1/good-deeds/:slug/quotes` return correctly ranked, mixed-type
content from a seeded database. No UI yet; everything verifiable with a REST client.

| Area | Scope |
| --- | --- |
| Infrastructure | `prisma/` module (`PrismaService`, `@Global()`); `common/` (`PaginationQueryDto`, `LocaleQueryDto`, `ResponseEnvelopeInterceptor`, `AllExceptionsFilter`, `arabic-normalizer`, `TransformToArray`); `main.ts` bootstrap (`/v1` prefix, `ValidationPipe`, CORS, shutdown hooks); env validation; `nestjs-pino`; `health/` module. Fix the existing `app.e2e-spec.ts` when the prefix lands. |
| Backend modules | `quotes`, `sources`, `tags`, **`sins`**, **`good-deeds`**, `quran`, `hadith` (+ `GradePolicy`), `classification` (admin), plus admin CRUD controllers. |
| Endpoints | #1–#18 (public reads), #28–#47 (admin content CRUD), #48–#57 (`SinQuote`/`GoodDeedQuote` linking), #61 (`/health`). **Not** #19–#27 (auth/favorites) and **not** #58–#60 (sync). |
| Database | First migration (`init`) committed; `prisma/seed.ts` per [content-pipeline-plan §5](./content-pipeline-plan.md#5-development-seed-plan-prismaseedts) — 5 `Source`, 8 `Sin`, 8 `GoodDeed`, ~12 `Tag`, ~20 `Quote`, ~15 `Translation`, ~30 links, 3 `SyncLog`. |
| Pipeline | None. The `content-sync` folder stays a placeholder. |
| DevOps | `git init` + remote (prerequisite); `ci.yml` (`lint`, `typecheck`, `prisma` + drift check, `test-unit`, `test-e2e`, `build`); backend `PORT` → 3001 and the matching `frontend/.env.example` update; `backend/Dockerfile`; staging environment. |
| Testing | Unit specs per service with the non-negotiables in [backend-plan §11.1](./backend-plan.md#111-unit-tests) — especially nulls-last ordering and "the grade filter must not drop Quran verses". E2E per controller against a real Postgres. |

**Done when:** `pnpm db:seed` then a REST client walkthrough shows — `GET /v1/sins` lists 8 sins with
`quoteCount`; `GET /v1/sins/ghibah/quotes` returns ≥10 items in descending `relevanceScore` with mixed
`QuoteType`, correct `meta.countsByType`, and a non-empty `alternatives`; `?grades=SAHIH` still includes Quran
verses; `?lang=en` attaches translations and never hides `textAr`; `rawPayload` appears in no response;
`POST /v1/admin/sin-quotes` creates a link and re-posting the same pair updates it; every error matches the
`{ error: { code … } }` shape; `/health/ready` is green; CI is green on a PR.

---

## Phase 3 — Frontend MVP (neutral theme)

**Goal:** a person can open the site, pick a sin or a good deed, and read ranked reminders in Arabic, RTL — with
a deliberately neutral visual theme.

| Area | Scope |
| --- | --- |
| Setup | `shadcn init` for **Tailwind v4** (`tailwind.config: ""`, `cssVariables: true`, `baseColor: neutral`) + the first `add` batch ([frontend-plan §3.2](./frontend-plan.md#32-primitives-to-install-up-front)); `globals.css` restructured into the 🎨 swap-point token block; `next-themes`; **`next-intl` with `app/[locale]/` — done before routes are built**. |
| Data layer | `src/lib`: `env.ts`, `api-client.ts` (envelope unwrap, typed `ApiError`, `lang` injection), `api/*.ts`, `types/api.ts` + `types/enums.ts`, `query-keys.ts`, `query-client.ts`, `providers.tsx`. |
| Routes | `/`, `/sins`, **`/sins/[slug]`**, `/good-deeds`, **`/good-deeds/[slug]`**, `/quotes/[id]`, `/browse`, `/browse/quran/[surahNumber]`, `/feelings/[tagSlug]`, plus `loading.tsx`/`error.tsx`/`not-found.tsx`. |
| Features | `sin-reminder` (picker Sheet/Dialog + `Command` search, `SinHeader`, `ReminderList`, `ReminderTypeFilter`, `AnotherReminderButton`, `AlternativeDeedsBlock`); `good-deed-motivation` (mirror + `RewardCallout`); `quran-hadith-browser` (`BrowseTabs`, filters, `InfiniteQuoteList`, `QuoteDetail`); shared `QuoteCard`/`GradeBadge`/`SourceAttribution`/`QuoteCardSkeleton`. |
| Backend | No new endpoints — only fixes exposed by real client use. |
| i18n | `messages/ar.json` (primary) + `en.json`; `dir` from the locale on `<html>`; logical Tailwind utilities; `<bdi>` for LTR runs. |
| DevOps | Vercel staging + per-PR previews; the `design-tokens` and `rtl-lint` CI jobs; frontend Vitest + `@testing-library/react` with `msw`. |

**Done when:** against the seeded API, a user can go home → pick `الغيبة` → read ≥10 ranked reminders with
visible grade/provenance; filter by type; tap "another reminder" and see a different ordering; follow
`alternatives` to `حفظ اللسان` and read its reward and motivations; browse Quran by surah and open a quote
detail; switch `ar`↔`en` with correct `dir` and translations attached under (never replacing) the Arabic.
`pnpm --filter frontend build` and `tsc --noEmit` are clean, no literal colour exists outside `globals.css`, and
both directions have been eyeballed on every route.

---

## Phase 3b — Three paths, branches of faith, explanations

**Goal:** the owner's updated vision — three guest-first paths (sins with their rank كبيرة/صغيرة, good deeds, and
the new **شعب الإيمان** path based on al-Bayhaqi's «الجامع لشعب الإيمان» with a شرح chosen by the owner), تفسير/شرح
explanations under quotes and branches, and "read more" links to Dorar's «موسوعة الأخلاق والسلوك».
Full design: [vision-v2-plan.md](./vision-v2-plan.md).
Entry condition: owner approval of the proposed schema (four migrations), the new `iman-branches` module and slice,
and the `.cursorrules` updates ([vision-v2-plan §15](./vision-v2-plan.md#15-owner-decisions)). Islamic content
(ranks, شعب, شرح) is entered and verified by the owner — nothing is invented.

| Area | Scope |
| --- | --- |
| Schema | **Proposed, requires owner approval:** `SinRank` + `Sin.rank`/`rankSourceId`/`rankReference`; `ImanBranch`, `ImanBranchQuote`, `ImanBranchGoodDeed`, `ImanBranchSin`; `ExplanationKind` + `Explanation`; `ExternalReference` — four migrations, each its own commit, with raw-SQL CHECKs ([vision-v2 §6](./vision-v2-plan.md#6-proposed-schema-additions)). `Sin.severity` is kept. |
| Backend | New module `iman-branches` (#84–#86 public, #88–#90 and #96 admin); `classification` gains branch links (#91–#95); `quotes` gains explanations (#87, #97–#100); `sources` gains external refs (#101–#103); additive `rank`, `externalRefs`, `relatedBranches` on #1–#3/#6; grade policy on every new read. |
| Frontend | New slice `features/iman-branches` + `/branches`, `/branches/[number]`; third entry card on `/`; rank badge on sins; explanation accordion on `/quotes/[id]` and branch pages; "read more" links; admin screens for branches, explanations, external refs and sin rank. Contract mirrored in `mobile/src/lib/types/api.ts`. |
| Content | Owner: path names, the chosen شرح, sin-rank source and each rank, branch titles/summaries, Dorar links; curator links texts. |

**Done when:** see [vision-v2-plan §13](./vision-v2-plan.md#13-done-when) — three entry points in `ar`/`en`;
`/branches/[n]` shows summary, attributed شرح, ranked texts under the same grade policy as sins, linked deeds and
sins, and a Dorar link; ranked sins show كبيرة/صغيرة and unranked sins show nothing; quote detail shows تفسير/شرح on
expand; all admin curation works in the browser; every new endpoint has unit + e2e tests; all gates green.

---

## Phase 4 — Auth + Favorites

**Goal:** an optional account that makes saved quotes durable across devices, without adding any friction to the
guest flows.

| Area | Scope |
| --- | --- |
| Schema | The additive migration from [backend-plan §9](./backend-plan.md#9-proposed-schema-additions): `UserRole` enum, `User.passwordHash`, `User.role`, `User.lastLoginAt`. **`passwordHash` does not exist today — phase 4 cannot start without it.** |
| Backend | `auth` (JWT access + rotating refresh, argon2, `JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`, `@CurrentUser()`, `@Roles()`), `users`, `favorites`; endpoints #19–#27; `@nestjs/throttler` on `/auth/*`; `isFavorite` enrichment on #3/#7/#8/#9; **all `/admin/*` routes actually locked behind `ADMIN`** (until now they were role-less). |
| Frontend | `/login`, `/register`, `/favorites`, `/settings`; the httpOnly refresh-cookie route handler; in-memory access token + single-flight refresh; `favorites` slice with `useToggleFavorite` (optimistic + rollback + `sonner`); `FavoriteButton` wired everywhere `QuoteCard` renders; `SignInPrompt` instead of a redirect. `react-hook-form` + `zod` via `shadcn add form`. |
| Seed | Two users (`user@`/`admin@thekra.local`) with hashed dev passwords; 3 favorites. |
| DevOps | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_COOKIE_SECRET` in every environment; pino redaction verified; Playwright E2E for guest → favorite → sign-in prompt. |

**Done when:** every phase-3 flow still works with **no** account; registering/logging in works; favoriting
persists across a browser restart and a different browser; a second favorite of the same quote is a clean `409`
with no duplicate row; a `USER` token gets `403` on `/v1/admin/*` and no token gets `401`; an expired token
degrades endpoints #3/#7 to anonymous instead of `401`; no token or password appears in any log.

---

## Phase 4b — Silat ar-Rahim & forgotten deeds

**Goal:** a signed-in user keeps a private list of relatives (صلة الرحم) with a contact rhythm, sees who is due
or overdue, and gets reminded by the phone's own calendar via a private subscription feed — no push server, no
scheduler, no third-party cost. Everyone (guest-first) sees a deterministic "forgotten good deed of the week".
Full design: [silat-rahim-plan.md](./silat-rahim-plan.md).
Entry condition: Phase 4 shipped, and the owner has approved the proposed schema, the new module/slice and the
`ical-generator` dependency ([silat-rahim-plan §12](./silat-rahim-plan.md#12-build-order-for-cursor)).

| Area | Scope |
| --- | --- |
| Schema | **Proposed, requires owner approval:** `Relative`, `ContactLog`, `DeedReminder`, enums `KinRelation`/`ReminderFrequency`/`Weekday`/`ContactMethod`, `User.calendarFeedTokenHash`, `User.calendarShowNames` — one migration `add_kinship_reminders` in its own commit ([silat-rahim-plan §4](./silat-rahim-plan.md#4-data-model--proposed-schema-additions)). Forgotten deeds need **no** schema change (a `THEME` tag `forgotten-deeds` on quotes). |
| Backend | New module `kinship` (endpoints #62–#80: relatives, contacts + undo, due list, deed reminders, feed settings/token, the `text/calendar` feed); `good-deeds` gains the `tag` filter on #5 and `GET /good-deeds/spotlight` (#81); `auth` gains `GET /auth/me/export` and `DELETE /auth/me` (#82–#83); feed-token masking in logs. `nextDueOn` computed on write — **no cron**. |
| Frontend | New slice `features/kinship` + `/kinship`, `/kinship/[relativeId]`, `/kinship/calendar`; `ForgottenDeedSpotlight` on `/`; forgotten-deeds filter on `/good-deeds`; export/delete in `/settings`; `SignInPrompt` promoted to `components/shared/auth`. |
| Content | The `forgotten-deeds` tag and the forgotten-deed `GoodDeed`s/quotes — **curated and verified by the owner**; nothing invented. The motivating صلة الرحم text reuses the existing `silat-ar-rahim` deed and endpoint #7. |
| Privacy | Minimum data (nickname, relation, rhythm, optional short note — no phone/address/email); never logged or in error payloads; generic calendar titles by default; feed token 256-bit, hashed, rotatable, `404` when unknown; cascade delete + export. |
| DevOps | `PUBLIC_API_URL`, `PUBLIC_SITE_URL` in every environment; no new infrastructure. |

**Done when:** a user adds a relative, sees them due, marks "contacted", undoes it — in `ar` and `en`; the
`webcal://` feed subscribed in iOS Calendar and Google Calendar shows generic recurring reminders that move after
"contacted" without duplicating; revoking the link makes it `404`; a guest sees the same forgotten deed of the
week as everyone else; export returns all kinship data and account deletion leaves none; no token or relative
name appears in any log; every guest flow still works with no account
([silat-rahim-plan §13](./silat-rahim-plan.md#13-done-when)).

---

### Phase 4b amendment (vision v2)

Reminders are for **any** `GoodDeed` — صلة الرحم per named relative **and** الصدقة and other acts of worship the
owner adds — not only forgotten deeds (silat-rahim open decision S3 resolved; no schema change; `422
DEED_NOT_ELIGIBLE` removed). Added done-when check: a signed-in user puts «الصدقة» on a weekly reminder from
`/good-deeds/sadaqah` and it appears in the due list and the feed
([vision-v2-plan §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment)).

---

## Phase 5 — Automated content-sync (real data)

**Goal:** the library is populated from real providers, idempotently and auditably, with seed data no longer
doing the work.

| Area | Scope |
| --- | --- |
| Backend | `content-sync`: the `ContentProvider` interface, `QuranComProvider`, `AlQuranCloudProvider`, `SunnahProvider`, `HadithApiProvider`, `normalizeGrade`, the run executor (advisory lock, batching, per-record try/catch, budgets, backoff), `ContentSyncScheduler` (`@nestjs/schedule`), `SyncLogService`, stale-run reconciliation; endpoints #58–#60. |
| Guards | `PATCH /v1/admin/quotes/:id` rejects edits to provider-owned fields on `API_CACHED` rows; the admin link endpoints reject a `MAWDU` quote. |
| Curation | Triage flow over the admin API: `GET /v1/admin/quotes?unlinkedOnly=true&origin=API_CACHED` → `POST /v1/admin/sin-quotes/bulk`. Scoring rubric documented. |
| Performance | The Arabic trigram/search raw-SQL migration; `CacheModule` + `Cache-Control` on public reads; cursor pagination for `/v1/quotes` if `COUNT(*)` becomes the bottleneck. |
| Testing | Fixture-driven mapper tests per provider; the **curation-survival** regression test (re-sync must not touch `SinQuote`/`relevanceScore`); partial-failure, backoff, lock and stale-reconciliation tests. **No test touches a real provider.** |
| DevOps | Provider keys in staging first; `SYNC_ENABLED` per environment; alerting on `SyncLog.status = FAILED`; `helmet`/`compression`. |

**Done when:** a manual `POST /v1/admin/content-sync/runs` imports a surah and a hadith book, producing a
`SUCCESS` `SyncLog` with a correct `recordsImported`; re-running creates **zero** duplicates and leaves existing
`SinQuote` links and scores untouched; a mid-run provider `429` is retried with backoff and the run still
completes; one malformed record is counted as `failed` without aborting the run; a record with no Arabic text is
`skipped`; grades are normalised correctly and no `MAWDU` row is linkable; the cron fires on schedule in
staging; the frontend renders `API_CACHED` content with full provenance and no `rawPayload` leak.

---

## Phase 5b — Book corpus import and tafsir

**Goal:** the classical works in the owner's book folder enter the library **from clean digital Unicode texts**
(OpenITI versions matched to the owner's editions where possible), with the PDFs kept only as verification copies,
and tafsir is cached from Quran.com — idempotently, auditably, and without ever writing a link.
Full design: [vision-v2-plan §4–§5](./vision-v2-plan.md#5-book-import-pipeline-phase-5b).
Entry condition: Phase 3b's schema shipped; owner decisions on editions, licences (OpenITI CC BY-NC-SA 4.0),
import keys/origin, Albani grades and tafsir resources ([vision-v2 §15](./vision-v2-plan.md#15-owner-decisions)).

| Area | Scope |
| --- | --- |
| Importers | `backend/prisma/imports/<work>/` (pure `parse.ts` + synthetic fixtures + spec), shared stream reader/batch upsert/`SyncLog` helper, runner script `import:book`, `--dry-run` sampling for the owner. Pilot work first, then «شعب الإيمان» (~11k narrations, streamed). |
| Mapping | One `Source` per work + edition; narrations → `HADITH` `Quote` (`UNGRADED` unless a licensed graded collection), keys `book:<work>` / `<edition>:<number>`; prose works → curated `BOOK_EXCERPT`s only; chapter in `rawPayload` + admin `chapter` filter. |
| Guards | **No PDF/OCR input**; importers never write `SinQuote`/`GoodDeedQuote`/`ImanBranchQuote`/`QuoteTag`; imported text read-only for curators (owner decision on the §2.5 amendment); re-import never overwrites a curator's grade. |
| Tafsir | `content-sync` `ExplanationProvider` + `QuranComTafsirProvider` → `Explanation` (`API_CACHED`), fixture-tested, manual trigger via #58. |
| Curation aid | Dorar hadith-search CLI (`dorar:lookup`), manual use only, never in a request path. |

**Done when:** a dry run's samples are checked by the owner against the PDF; a real run gives one `SUCCESS`
`SyncLog` and a second run creates **zero** rows; imported narrations are invisible on public endpoints by default;
no link or tag row was written by an importer; a curator filters by source + chapter, grades with a citation and
links; a tafsir run caches the chosen resource and `/quotes/[id]` shows it; no test touched the network.

---

## Phase 6 — Admin / curation UI

**Goal:** a curator can do the editorial work — the thing that actually makes the product good — without a REST
client.

| Area | Scope |
| --- | --- |
| Frontend | New slice `src/features/curation` + `/admin` routes: dashboard (coverage gaps: sins/deeds with few or zero links), quote list with filters (`unlinkedOnly`, `origin`, `missingTranslation`), quote create/edit form, the **linking workspace** (pick a sin → search quotes → set `relevanceScore` with the rubric visible → write `note` → save; bulk-link a triage batch), `Sin`/`GoodDeed`/`Source`/`Tag` CRUD, translation editor, tag assignment, and a sync console (trigger a run, watch `SyncLog`, read failure summaries). |
| Components | `shadcn add table` plus `data-table`, `date-picker`, `command` reuse; admin-only layout. |
| Backend | Mostly none — phase 2/5 already defined the endpoints. Likely additions: `GET /v1/admin/stats` (coverage counts), server-side sorting the table needs, and `GET /v1/admin/sin-quotes` filter refinements. |
| Access | `ADMIN` role enforced server-side (phase 4) **and** route-guarded client-side; admin routes `noindex`. |

**Done when:** a curator with an `ADMIN` account can create a `LOCAL` quote with a source and translation, link
it to a sin with a score and a note, see it appear at the right position on the public `/sins/[slug]` screen,
triage a batch of freshly ingested quotes, fix a wrong score, delete a bad link, and trigger + inspect a sync run
— all in the browser, with no `curl`.

---

## Phase 7 — Mobile app

**Goal:** the product on the device where the moment of need actually happens.
Entry condition: phases 2–4 shipped and `/v1` unchanged for a full phase.

| Area | Scope |
| --- | --- |
| Scaffold | Official Expo TS template in [`mobile/`](../../mobile/) (first code there — it stays README-only until this phase); `mobile` added to `pnpm-workspace.yaml`; `expo-router`; `scheme` + bundle ids. |
| Screens | Home, Sin picker, Reminders, Deed picker, Motivations, Browse, Quote detail, Emotion entry, Favorites, Settings, Login/Register ([mobile-plan §3](./mobile-plan.md#3-screen-map)). |
| Platform | `nativewind` with the same semantic token names; `expo-font` with the Arabic family; RTL via `I18nManager` **including the reload-on-locale-change UX**; `i18next` + `expo-localization` over ICU catalogues. |
| Offline | TanStack Query + `AsyncStorage` persister with an allow-listed key set; `expo-secure-store` for the refresh token; NetInfo → `onlineManager`; paused mutations replayed on reconnect (safe because the favorites endpoints are idempotent). |
| Native | Share sheet, haptics, deep/universal links, optional keep-awake. **No push notifications** — they contradict the on-demand premise. The one exception is **on-device local notifications** (`expo-notifications`) for the user-configured Phase 4b kinship/deed reminders ([mobile-plan §3.2](./mobile-plan.md#32-phase-4b-reminders--on-device-local-notifications)) — no push server. |
| Backend | Ideally zero changes. Anything required is additive and versionless. |
| DevOps | EAS Build/Submit, `expo-updates` channels, `mobile-release.yml`. |

**Done when:** a TestFlight/internal-track build lets a user complete both core flows in Arabic RTL on iOS and
Android; favorites sync with the web account; airplane mode still shows saved favorites and the last-viewed
reminders; a shared quote link deep-links to the right screen; the `ar`/`en` × iOS/Android × online/offline QA
matrix passes; VoiceOver and TalkBack read Arabic content correctly.

---

## Phase 8 — Design system swap-in, a11y & i18n completeness

**Goal:** replace the neutral placeholder theme with the real brand, and close the quality gaps that were
deliberately deferred. **This phase is the test of whether phases 3–7 were built correctly.**

| Area | Scope |
| --- | --- |
| Design swap 🎨 | Real palette into the `:root`/`.dark` variable block in `globals.css` (including the Thekra-specific `--grade-*` and `--intent-*` tokens); final Arabic + Latin fonts into the two `next/font` slots; `components.json` `baseColor`; logo/favicon/OG; the mobile token module. **Expected diff: one CSS block, the font declarations, and assets — nothing under `components/ui/`, `features/`, or any route file.** If a component needs editing, that is a bug logged against the phase that introduced it. |
| Accessibility | Full keyboard pass; focus management on the picker Dialog/Sheet and the post-selection heading focus; `aria-live` announcements for shuffle/filter; `aria-pressed` on favorites; contrast verified against the **real** palette (AA: 4.5:1 body, 3:1 large); `prefers-reduced-motion`; `axe` clean on every route; screen-reader pass in Arabic on web and both mobile platforms. |
| i18n completeness | No hard-coded string outside `messages/*`; `ar.json`/`en.json` key parity check in CI; ICU plurals exercised for Arabic's six categories; Arabic-Indic vs Western numeral preference; date/number formatting per locale; every screen reviewed in both directions. |
| Polish | Arabic typography (line height, verse sizing, no justification), empty/error/loading states, `generateMetadata` + OG images for shareable routes, performance pass (p95 on the core endpoint, bundle size, image optimisation), dark-mode review with the real palette. |
| Privacy | Explicit copy confirming that a sin selection is never attributed to an account and never sent to analytics — a trust requirement for this product, not a legal checkbox. |

**Done when:** the real palette is live on web and mobile with the diff limited to tokens/fonts/assets; every
route passes an `axe` audit and a manual keyboard + screen-reader pass in Arabic; a CI check proves `ar`/`en` key
parity; and nothing structural changed to get there.

---

## Cross-cutting, every phase

| Discipline | Standing rule |
| --- | --- |
| Schema changes | Additive-first, migration committed with the schema change, CI drift check green ([devops-plan §4](./devops-plan.md#4-migration-workflow)). |
| API compatibility | No breaking change to a shipped `/v1` response shape — add a field, never repurpose one. Once phase 7 ships, an app-store client is pinned to that contract. |
| Content integrity | `MAWDU` is never served; `DAIF` only on explicit opt-in; provenance always rendered. The one correctness guarantee that outranks every feature. |
| Theming | No literal colour outside `globals.css`. Enforced in CI from phase 3. |
| RTL | Logical properties only; every PR reviewed in both directions. |
| Guest-first | No feature may gate the two core flows behind an account. |
| Curation | No automation writes a `SinQuote`/`GoodDeedQuote` row. Ever. |
| Tests | A new endpoint ships with a service unit test and a controller e2e test in the same PR. |
