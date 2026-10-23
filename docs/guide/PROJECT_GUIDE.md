# Thekra (ذكرى) — Project Guide for Claude

> Snapshot: 2026-10-23, `master` = `main`. This is the "read first" file. Its companion
> [PROJECT_HISTORY_AND_LESSONS.md](./PROJECT_HISTORY_AND_LESSONS.md) holds the timeline, the owner's
> requests in his own words, every mistake we made and the rule each one produced. Read both before
> changing anything. When this file and the code disagree, the code wins — then fix this file.
>
> Root [AGENTS.md](../../AGENTS.md) is the short binding rule set (installed-version docs first,
> `pnpm deprecations`, env vars in three places). This guide explains the whole project around it.

## 0. Reading order

1. This file (what the product is, the non-negotiable rules, how to work, how to deploy).
2. [PROJECT_HISTORY_AND_LESSONS.md](./PROJECT_HISTORY_AND_LESSONS.md) (why things are the way they are).
3. Before touching the UI: [docs/handoff/ui-port-session-context.md](../handoff/ui-port-session-context.md).
4. Before touching content/linking: [docs/methodology/hadith-methodology.md](../methodology/hadith-methodology.md), [docs/taxonomy/apply-report.md](../taxonomy/apply-report.md).
5. Before deploying: [docs/deploy/VERCEL.md](../deploy/VERCEL.md), [docs/build/RELEASE_DB.md](../build/RELEASE_DB.md).

## 1. What Thekra is

An **Arabic-first Islamic reminder web app**. A visitor picks a sin to leave («ساعدني أترك معصية»), a good
deed to do («ساعدني أعمل طاعة»), or reads the 77 **شعب الإيمان** (branches of faith). Each topic page shows
the Quran verses, authentic hadith and (clearly labelled) sayings of the Companions/senior Successors that
the scholars' own chapters tie to that topic. The tagline is «لِمَن كَانَ لَهُۥ قَلْبٌ» (Qaf 50:37).

Owner goals (his words are in the history file): **scholar-sourced, correctly classified, publishable**
texts; a **polished public UI**; nothing forced — a text is linked to a topic **only when it truly relates**;
security taken seriously; fast and error-free deployment.

Status: public site live on Vercel (web `https://thekra-web.vercel.app`, API `https://thekra.vercel.app`), content in Neon
Postgres (Frankfurt). Accounts/login are **hidden for now** (next phase). The reviewer platform and
«التحقيق» features are **deferred**. `mobile/` (Expo) exists but is **not deployed**.

## 2. The owner and how he wants to work

- **Reply language: Arabic**, plain/simple, short updates ("keep me updated in simple short things in
  Arabic"). He has rebuked English replies. Technical terms, commands, paths and identifiers stay in
  English/inline code. A per-message `Reply language:` line may say otherwise — honour the most recent
  explicit instruction, but default to Arabic for this owner.
- **"Don't stop until it is fully done"**: he expects end-to-end work (implement → verify → commit → push →
  tell him what he must still do), not questions at every step. Ask only about material choices that
  inspection cannot settle (e.g. a scholarly decision, a destructive action, a paid service).
- **Delegate implementation to workers**, review diffs, run the checks yourself, only then say "done".
  (See §12.) Use the project's skills where they fit.
- **Security is serious**: "make sure not importing random skills or wrong implementation". Never install
  an unverified skill/dependency/codemod to clear a warning. We wrote our own `deprecation-guard` skill.
- **Never reveal or reuse secrets**: he once pasted a Neon password into chat → tell him to rotate it; never
  write secrets into files or commits.
- **He wants explanations of causes**, not guesses: "حدد المشكلة لا تقعد تهلس" — find the real cause,
  reproduce it, prove the fix. No third blind retry of the same idea.
- **No errors in deployment from now on**: reproduce Vercel conditions locally (see the `gate:vercel`
  script) before pushing.
- He pastes screenshots/logs/DOM selectors; read them literally and map each to a file.
- Typing in Arabic on an English keyboard happens («fvd hufd…»); decode it, answer the question, say if
  you could not decode.
- He is non-commercial/personal-scale (Vercel Hobby, Neon free tier). Respect free-tier limits.

## 3. Content rules (never break these)

These come from the owner and from the scholarly requirements of the project.

1. **Quran text comes only from the database/API** (the stored text), never typed or generated.
2. **No machine translation.** English text is only what a source supplies (HadeethEnc, Tafsir Center…) or
   transliterated names. If English is missing, hide the line or list it for the owner; never invent.
3. **No al-Albani gradings are published.** 874 stored rows carry his grade and **0** are public
   (`AUTHORITY_LEGACY`). Bashar ʿAwwād's grading was removed. **Ibn Rajab** is a *selection aid only*, never
   a book-level link (`IBN_RAJAB` grade is not public).
4. **Athar** (sayings of Companions/senior Successors) are published only if: `ATHAR_PUBLIC_ENABLED=true`,
   the speaker is in `backend/prisma/taxonomy/athar-speakers.yaml`, and the reviewer decision is `KEEP`.
   They are always labelled «أثر، وليس حديثًا» (neutral «أثر» badge) — never shown as hadith.
5. **Excluded**: Isra'iliyyat; calls upon anyone other than Allah; anything that fails the athar rubric
   ([docs/taxonomy/athar-review-rubric.md](../taxonomy/athar-review-rubric.md)).
6. **Contemporary topics carry no fatwa wording** (references only).
7. **Western digits (0–9)** everywhere, in both languages.
8. The **intention line** is kept exactly: «لا أنوي هذا العمل لغير الله، وإلا ضاع التعب والحسنات وتعاقبت عليه.»
9. **Sahihayn hadith are classified only when they truly relate** to a topic («ما ابدي نحطهم بالقوة بس اذا
   الهم علاقة نضيفهم»). Do not re-review hadith already in use. Be careful with شعب الإيمان links.
10. A **paired sin/deed is one page** (e.g. «الصلاة» = tark-as-salah + salah), with themes from both sides —
    this is the owner's confirmed model (41 pairs in `taxonomy.yaml`).
11. **Publishing gate** (code: `backend/src/modules/hadith/grade-policy.ts`, `GradePolicy`):
    - public hadith: `gradeSource` ∈ `SAHIHAYN`, `AUTO_SAHIHAYN`, `SUNAN_TAHQIQ`, `HADEETHENC`, `MANUAL`;
    - OCR text needs `textVerifiedAt`; an OPEN `HIGH` `QuoteFlag` hides a quote;
    - listing pages additionally require grade `SAHIH`/`HASAN`;
    - links must be `ACCEPTED`; a link note starting «باب …» (auto chapter note) is not shown;
    - `ATHAR_PUBLIC_ENABLED` defaults **off in code** — production must set it to `true` explicitly.
    - An athar (`isAthar=true`) answers to the athar rule **alone**, whatever its grade source or type: a
      Sahihayn/HadeethEnc/tahqiq grade never publishes an athar without a listed speaker and `KEEP`
      (closed 2026-10-23; it hid 4 graded athar — 2 DROP, 2 undecided HadeethEnc rows from al-Adhkar — and 5 unlinked
      Minhaj excerpts). The same rule lives in `publishableClause`, `isPublishable` and the raw SQL of `shuffleLinksPage`.

## 4. Architecture

```
Thekra/                       pnpm workspace (Node 24 target; local machine has 22.19 — see §9)
├─ backend/                   NestJS 12 (ESM), Prisma 6.19.3, Postgres 16 (local) / 18 (Neon)
│  ├─ prisma/schema.prisma + migrations (31)  · prisma/taxonomy/*.yaml (reviewer files)
│  ├─ prisma/imports/…        importers per book, taxonomy, themes, cleanup commands
│  ├─ prisma/release/         clean.sql + verify.sql for the production copy
│  ├─ src/modules/…           sins, good-deeds, iman-branches, quotes, quran, hadith, sources, taxonomy, auth, favorites, review…
│  ├─ src/config/             configure-app.ts (helmet, CORS, pipes), cors-origins.ts
│  ├─ src/common/http/public-cache.ts   per-route CDN cache decorator
│  ├─ src/serverless.ts + api/index.mjs + scripts/bundle.mjs + scripts/gate-vercel.mjs   Vercel entry
│  └─ scripts/admin/          admin:create
├─ frontend/                  Next.js 16 App Router, React 19, Tailwind v4, next-intl (ar default at `/`, en at `/en`),
│                             TanStack Query, shadcn (rtl), Radix, LogoLoop (React Bits)
├─ mobile/                    Expo — not deployed
├─ scripts/                   release-db.sh, check-deprecations.sh, check-i18n-keys.mjs
├─ docs/                      everything below (see §14)
└─ books/, thekra-source/     source corpora / prototype (do not commit generated output)
```

- **API shape**: all under `/v1`; `/health`, `/health/ready` outside. Reader endpoints:
  `GET /v1/{sins|good-deeds}/:slug/quotes?kind=verse|hadith|athar&theme=<key>&limit≤50` →
  `meta.countsByKind`, `meta.themes`, `meta.theme`. `GET /v1/topic-themes` is the theme search index.
  `GET /v1/branches/:number/quotes`, `/v1/sources`, `/v1/quotes/:id`, `/v1/quotes/:id/explanations`.
- **Data model highlights**: `Quote` (type VERSE/HADITH, `isAthar`, `gradeSource`, `textSource`), `Explanation`
  (kinds TAFSIR, SHARH, FAWAID, GHARIB, BRANCH_SHARH), `Source` (88 canonical), link tables `SinQuote`,
  `GoodDeedQuote`, `ImanBranchQuote` (+ `ImanBranchSin/GoodDeed`), `QuoteFlag`, `ReferenceHadith` (+trgm index),
  `HadithMatch`, `ChapterEntityMap`, taxonomy tables. A custom SQL function `thekra_normalize_ar` and the
  `pg_trgm` extension are required.
- **Auth**: JWT access+refresh (stateless), argon2, global ThrottlerGuard 120/min, `/auth/*` and report
  endpoint 5/min, `/auth/refresh` 30/min (skipped when `NODE_ENV=test`). Production refuses to boot unless
  both JWT secrets are ≥32 chars and different. `TRUST_PROXY` env for the client IP.
- **Security headers**: helmet (API), Next CSP (no `unsafe-eval` in prod) + others; zod runs `jitless`.
  Security review: [docs/security/REVIEW.md](../security/REVIEW.md).

## 5. Content pipeline (how texts get to the pages)

1. **Import books** (`pnpm --filter backend import:book <key>`): Bukhari, Muslim, Riyad al-Salihin, al-Adhkar
   (al-Nawawi), al-Adab al-Mufrad, Targhib (OCR), Zuhd (Ibn al-Mubarak), Kabair (al-Dhahabi), Minhaj, Shuab al-Iman
   (al-Bayhaqi), Ibn Abi al-Dunya (63 books), HadeethEnc, Quran + tafsirs. Importers are idempotent.
2. **Classify** with reviewer files in `backend/prisma/taxonomy/` (`taxonomy.yaml`, `sahihayn-map.yaml`,
   `ibn-abi-dunya-map.yaml`, `adhkar-map.yaml`, `topic-themes.yaml`, `athar-speakers.yaml`) and decision sheets in
   `docs/taxonomy/*.tsv`. Apply with `pnpm --filter backend import:taxonomy` (**second run must write 0**) and
   `taxonomy:themes`.
3. **Chapter maps vs per-hadith maps**: chapters (bab→topic) are the default mechanism; the per-hadith Sahihayn
   map has high/low confidence (high applied, low **not** published); athar and ayah have explicit keep/drop sheets.
4. **Numbers to remember** (database, 2026-10-22; re-run `docs/methodology/queries.sql`): 36,850 hadith
   (14,322 published), 5,111 athar (550 published), 6,236 verses (989 linked to topics), 89 Source rows,
   84 sins, 80 good deeds, 77 branches, 31 migrations.
5. **Release copy** for production: `scripts/release-db.sh build` → clean (removes User/Favorite/SyncLog) →
   verify (87 checks) → `/tmp/thekra-release.dump`; `push` restores to Neon after a typed confirmation.
   Details: [docs/build/RELEASE_DB.md](../build/RELEASE_DB.md).

## 6. Frontend rules

- **Read `frontend/node_modules/next/dist/docs/` before any Next API** (Next 16 differs from memory;
  `middleware` is `proxy.ts`). See [frontend/AGENTS.md](../../frontend/AGENTS.md).
- **The public UI is final — extend, don't redesign.** Do not revert: DirectionalArrow, the «En» switcher,
  quiet focus, LogoLoop (source strip), tagline, no shuffle/«تذكرة أخرى» button, no public «تصنيف المراجعة».
  Full list: [docs/handoff/ui-port-session-context.md](../handoff/ui-port-session-context.md) and
  `.cursor/rules/ui-port-preserve.mdc`.
  - **Owner override (2026-10-23):** the English face is now **Source Serif 4** (self-hosted), not Amiri.
- **Language/direction discipline**: Arabic view = Arabic only (no Latin except deliberate refs); English view =
  English only (Arabic only inside `lang="ar" dir="rtl"` for Quran/hadith/athar text and names). Use
  **logical properties** (`ms-/me-/ps-/pe-/start-/end-`, `inset-inline-*`). Radix is wrapped in
  `Direction.Provider` tied to the locale. Arrows use `DirectionalArrow`. Playwright specs `no-arabic-en`,
  `no-latin-ar`, `direction` enforce this — keep them green.
- **Loading & errors**: `BrandLoader`, route `loading.tsx` for every public segment, `NavigationProgress`, typed
  `ApiError` (`network|timeout|http|validation|parse`), `QueryErrorState`/`ServerErrorState` with retry,
  `error.tsx`/`not-found.tsx`/`global-error.tsx`. Every client fetch must surface errors with a localised retry —
  never an endless skeleton, never raw errors or URLs. See [docs/build/FEEDBACK_AND_ERRORS.md](../build/FEEDBACK_AND_ERRORS.md).
- **Caching/speed**: server reads use native `fetch` with `next.revalidate` (axios bypasses Next's cache);
  public pages are SSG/ISR (no `force-dynamic`); favorites/auth stay dynamic. A dead API at build time fails the
  deploy by design. Function region `fra1` (next to Neon).
- **Env**: `NEXT_PUBLIC_API_URL` (baked at build → rebuild after changing; part of the CSP),
  `NEXT_PUBLIC_ACCOUNTS_ENABLED=false`, optional `NEXT_PUBLIC_SITE_URL`.
- Components: Tailwind v4 tokens in `globals.css`; public look in `site-public.css` (very long lines — edit in
  small targeted edits). Do not add hard-coded colours (the CI `design-tokens` job fails on literals; the
  brand `icon.svg` is the one exception).

## 7. Backend rules

- **Prisma 6.19.3 is pinned** (exact). Prisma 7/8 migration is *planned, not done* — see
  [docs/build/DEPRECATIONS.md](../build/DEPRECATIONS.md). Run Prisma only via `pnpm exec prisma …` /
  `pnpm --filter backend …`; **never `npx prisma`** (resolves to the Prisma 8 RC CLI).
- `prisma.config.ts` disables Prisma's own `.env` loading → **CI and Vercel must provide every variable**
  (`DATABASE_URL`, `DIRECT_URL`). `DIRECT_URL` = Neon *unpooled* host (migrations); `DATABASE_URL` = pooled.
- **Vercel runtime cannot `require()` ESM.** NestJS 12 is ESM-only while `@nestjs/throttler` is CJS, so the app
  is bundled with esbuild (`scripts/bundle.mjs`) into `dist/bundle/serverless.mjs` and served via
  `api/index.mjs`. YAML taxonomy files are **embedded at build time** (never read from `process.cwd()` at
  runtime). helmet is loaded through `createRequire` (its types resolve differently per install layout).
  **Gate before pushing backend changes:** `pnpm --filter backend gate:vercel` (runs the handler under
  `--no-experimental-require-module` from a directory containing only what Vercel ships).
- **CORS** (`CORS_ORIGINS`): exact origins or one narrow `*` pattern in the leftmost label
  (`https://thekra-web-*-<team>-projects.vercel.app`); bare `*`/`null` fail the boot (credentials are on).
- **CDN cache**: `@PublicCache(preset)` per route; never on auth/admin/favorites/health; `private, no-store` when an
  Authorization header or cookie is present. A test walks all controllers so new routes default to *no* cache.
- **Latency**: Neon is in `eu-central-1`; API pinned to `fra1`. Avoid sequential DB round trips (parallel queries,
  fold counts, `QuotesService.hydrateLinks`). Topic quote endpoints ≈ 22 queries / 5 sequential steps.
- Production env (API): `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (distinct, ≥32 chars),
  `NODE_ENV=production`, `TRUST_PROXY=1`, `ATHAR_PUBLIC_ENABLED=true`, `CORS_ORIGINS`. Adding any env var means
  updating `.github/workflows/ci.yml`, `backend/.env.example` and `docs/deploy/VERCEL.md` in the same change.

## 8. Quality gates (what "done" means)

Run the **exact** command and see it pass before saying a check passed; name what you did not run.

| Area | Command |
| --- | --- |
| Backend types / units / e2e | `pnpm --filter backend exec tsc --noEmit -p tsconfig.json` · `pnpm --filter backend test` · `pnpm --filter backend test:e2e` |
| Vercel runtime parity | `pnpm --filter backend gate:vercel` |
| Frontend | `pnpm --filter frontend exec tsc --noEmit` · `pnpm --filter frontend lint` · `pnpm --filter frontend test` · `pnpm --filter frontend build` · `pnpm --filter frontend test:ar` (Playwright; use `--workers=2`) |
| Deprecations | `pnpm deprecations` (after touching deps/config) |
| i18n parity | `pnpm check:i18n` |
| Prisma / migrations | `pnpm prisma:validate` · migration drift check (see `ci.yml` job `prisma`) |
| Importer idempotency | run twice; second run writes 0 |
| Release DB | `scripts/release-db.sh build` (87 checks) |

CI (`.github/workflows/ci.yml`, runs on PR and push to `master`/`main`): lint, prisma, typecheck, test-unit,
test-e2e, design-tokens, rtl-lint, i18n-parity, build, mobile-check. All green as of the last push. CI uses
Node 24; this machine has Node 22.19 (pnpm warns "Unsupported engine") — flag anything that could differ on 24.

## 9. Local development

Full guide: [docs/build/LOCAL_DEV.md](../build/LOCAL_DEV.md).

```bash
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"     # this machine's Node (the shell's default Node 24 cannot load native addons here)
# DB: Docker container thekra-db-1 (Postgres 16), url in backend/.env: postgresql://thekra:…@localhost:5432/thekra
pnpm dev:backend                                  # or: cd backend && pnpm build && node --env-file=.env --enable-source-maps dist/main   (API :3001)
pnpm dev:frontend                                 # web :3000 → API :3001
pnpm dev:web:prod-api                             # web :3000 → https://thekra.vercel.app (production CORS must allow localhost)
```
The long-running local API (`dist/main` on :3001) and `next dev` (:3000) are the owner's working servers —
**do not kill them**; use free ports for your own runs, and if you must restart, restart exactly as before.
Playwright: import from `node_modules/.pnpm/@playwright+test@…/…/index.mjs` with Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (`headless: true`).
`pg_dump` on the host is v14 — use the Docker container's tools (the release script does).

## 10. Deployment (current state)

- **GitHub**: `git@github.com:Akhera-Plants/Thekra.git`. Work is pushed to `master`, then `master` is merged
  into `main` (`--allow-unrelated-histories` was needed once; now they stay identical). Vercel projects track
  one of them — keep both in sync so either deploys the same code.
- **Vercel (Hobby)**: project **`thekra`** = API (`https://thekra.vercel.app`, Root Directory `backend`,
  `framework: null`, rewrite everything to `/api`, region `fra1`); project **`thekra-web`** = Next.js
  (`https://thekra-web.vercel.app`, Root Directory `frontend`). A leftover duplicate `thekra-api` project should be
  deleted. Both enable "include files outside the Root Directory" and Node 24.x. Install is Vercel's own pnpm
  workspace install (a custom `cd ../..` install command broke it — don't add one).
- **Neon (free)**: Postgres 18, `eu-central-1`. Created through the Vercel integration; the integration's extra
  variables (`PG*`, `POSTGRES_*`) are unused — we use `DATABASE_URL` (pooled) and `DIRECT_URL` (= the unpooled
  string) only. Never attach the database to the frontend project.
- **Order for a content change**: edit local DB → `scripts/release-db.sh build` → `push` (needs the direct Neon URL
  in `NEON_DATABASE_URL`, never pasted into chat) → API CDN cache lasts ≤ `s-maxage` (≤ 10 min) → verify counts.
- **Production admin**: `DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=<≥16 chars> pnpm --filter backend admin:create`.
  The local seed accounts (`*@thekra.local`, password `password123456`) must never reach production — `clean.sql` removes them.
- **After every deploy verify from outside**: `/health`, `/health/ready` (`database: up`), `/v1/sins`,
  `/v1/good-deeds/dhikr/quotes`, a themed page, CORS preflight from `https://thekra-web.vercel.app` (must return
  `Access-Control-Allow-Origin`), security headers, and a real browser load with zero console errors.
- **Pending owner actions** are tracked in §13.

## 11. Dependencies, deprecations and "outdated" things

- Guard: `pnpm deprecations` (`scripts/check-deprecations.sh`, allowlist of known debt) and the global skill
  `deprecation-guard` (`~/Documents/Skills/skills/deprecation-guard`, symlinked into `~/.agents`, `~/.claude`, `~/.cursor`).
- Before using an API: `pnpm ls <pkg>`, read the installed version's docs/`.d.ts`, check `npm view <pkg> dist-tags`
  (latest may be a release candidate). Never silence a deprecation; record it in `docs/build/DEPRECATIONS.md`.
- Known planned work: Prisma 6 → 7 (ESM/driver adapter/config datasource), ESLint 9 → 10 (EOL), Vitest majors,
  Zod `.email()/.uuid()` deprecations, `actions/*@v4` → Node 24 runtimes, `@nestjs/throttler` CJS-only.
  **Never** bundle a major upgrade into an unrelated change; ask the owner before a major during a deploy window.

## 12. How we run work: Delegate mode

- You hold the shell for reading/verification; **workers implement**. Brief each worker with the goal, files,
  constraints, what must not change, and exact success commands. The worker does not see the conversation.
- The fleet has no default lane: call `delegate_choose_model` before every `delegate` (a confirmation covers one
  dispatch). Up to 3 attempts in parallel only when their file scopes are disjoint; say in each brief which
  areas belong to other workers; declare `scopes`.
- Workers sometimes fault (rate limits, no changes) — resume with `delegation_correct` or re-dispatch.
- Review: `delegation_review` → read the changed files → run the brief's commands via `delegation_verify` →
  `delegation_conclude`. A worker's report is a claim, not evidence; wrong or unproven claims have been caught
  this way many times (see history). Edit the workspace yourself only for a one-line unblock, a brief's own
  artifact, or a trivial change — and say so in the report.
- Commit + push after verification is the accepted workflow (the owner said "start implementing … don't stop").
  Never revert the owner's work; never `git reset --hard`/`checkout --` without explicit permission. Commits are
  scoped (don't sweep unrelated files; large screenshot folders stay untracked).

## 13. Open items and owner decisions

| Item | Owner/engineering | Notes |
| --- | --- | --- |
| Push the release copy to Neon (B01 English fix: 3,151 replaced, 1,223 added, 233 removed) | **owner** | `scripts/release-db.sh build` then `push`; see `docs/review/2026-10-23-audit-fixes.md` |
| Review `prisma/taxonomy/text-review.yaml` (818 possible fragments, audit B03) | owner/sheikh | COMPLETE or FRAGMENT; FRAGMENT needs the full matn from the cited edition |
| Switching back to Arabic lands on `/ar/...` (`e2e/direction.spec.ts` fails) | engineering | pre-existing on live |
| `NEXT_PUBLIC_API_URL` also for the **Preview** environment | owner | preview builds fail without it |
| Rotate the Neon owner password (was pasted in chat) | owner | then update `DATABASE_URL`/`DIRECT_URL` and redeploy |
| Delete the duplicate Vercel project `thekra-api` | owner | |
| 2 HadeethEnc athar from al-Adhkar (hidden since the athar fix; no speaker/decision) | owner/sheikh | review them in the athar sheet if they should return |
| Ibn Abi al-Dunya title «الشرف في المنازل» vs corpus «الإشراف في منازل الأشراف» | owner/sheikh | |
| Close `/auth/register` until the accounts phase? | owner | unanswered |
| «لماذا هذه الآية/الحديث؟» card: richer content | owner picks | proposals in history file §6 |
| English descriptions missing: 76/84 sins, 69/77 deeds, 0/77 branch summaries | owner/sheikh | no machine translation |
| Review low-confidence Sahihayn rows (667), unlinked published hadith (9,645) | sheikh + engineering | see methodology §6 |
| IIFA financial resolutions as references (no fatwa wording) | later | after deploy |
| Professions / محرمات التخصصات | deferred | owner to supply a source |
| Reviewer platform, accounts/login, التحقيق | deferred | next phase |
| Prisma 7 migration and other majors | planned | `DEPRECATIONS.md` |
| Weak link: army-instructions hadith → `tadhib-hayawan` | low | |
| Low security items: Prisma error details expose field names; `/branches/:number/quotes` link-note filter | low | |
| Dark-mode outline buttons have low-contrast green text; no `<Toaster/>` on public pages | low | noted by the direction worker |

## 14. Where everything lives

| Need | File |
| --- | --- |
| Binding agent rules | [AGENTS.md](../../AGENTS.md), `frontend/AGENTS.md`, `.cursor/rules/*.mdc`, `backend/.cursorrules`, `frontend/.cursorrules` |
| This guide + history | `docs/guide/` |
| UI contract (do-not-revert list) | `docs/handoff/ui-port-session-context.md` |
| Deploy, local dev, release DB | `docs/deploy/VERCEL.md`, `docs/build/LOCAL_DEV.md`, `docs/build/RELEASE_DB.md` |
| CI history and Vercel parity | `docs/build/CI_GREEN.md`, `docs/build/PERFORMANCE.md` |
| Errors/loading/caching design | `docs/build/FEEDBACK_AND_ERRORS.md` |
| Deprecations and upgrade plans | `docs/build/DEPRECATIONS.md`, `scripts/check-deprecations.sh` |
| Security review and env checklist | `docs/security/REVIEW.md` |
| Hadith/athar methodology (Arabic, for the sheikh) | `docs/methodology/hadith-methodology.md`, `shuab-al-iman.md`, `queries.sql` |
| Taxonomy decisions, rubrics, apply report | `docs/taxonomy/*` (esp. `apply-report.md`, `athar-review-rubric.md`) |
| Theme audit | `docs/build/THEME_AUDIT.md` |
| Direction/English font work | `docs/design/after/direction/README.md`, `english-font.md` |
| Older plans / build logs | `docs/ARCHITECTURE.md`, `TECHNICAL_PLAN.md`, `docs/build/STATUS.md`, `PROGRESS.md`, `DECISIONS.md`, `FINAL_REPORT.md`, `BACKLOG.md` |
