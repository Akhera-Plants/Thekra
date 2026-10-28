# Session hand-off for review — practice features, accounts, sync, web push (2026-10-28)

This file is for a reviewer (human or another Claude session) who did not see the conversation. It says what the
owner asked for, what was decided, what was built and changed (code, CI and the **production database**), what was
verified and what was not, and where a careful review should look first.

- Repository: `Akhera-Plants/Thekra` (pnpm monorepo: `backend/` NestJS 12 + Prisma 6.19.3, `frontend/` Next.js 16,
  `mobile/` Expo SDK 57, `extension/` MV3, `packages/practice-core/`).
- Working branch: `rrrr/ligmat-system-improvements-bd662f-e4dpmx`. `master` and `main` were fast-forwarded to it and
  all three are identical at the end of the session.
- **Review range:** `git diff 7d52c66..48c706f` (`7d52c66` = `master` before this session; `main` was `2f24b3d`,
  identical tree). About 313 files, +32.7k lines. Commits, oldest first: `git log --oneline 3dbe5d2^..48c706f`.
- Read first: `AGENTS.md`, `docs/guide/PROJECT_GUIDE.md` (owner preferences, content rules),
  `docs/guide/PROJECT_HISTORY_AND_LESSONS.md`.

## 1. Owner rules that applied throughout

- Replies to the owner in Arabic, short: done / verified / not verified / what he must do.
- AGENTS.md: read installed library docs before using an API; `pnpm deprecations` after dependency or config changes;
  new env vars in three places (`ci.yml`, `backend/.env.example`, `docs/deploy/VERCEL.md`); run tsc and tests.
- **Database constraint (owner's words):** take a backup first, keep it, and never remove or drop data without telling
  him and getting clear approval. The Neon database the session wrote to **is production** (the live site's).
  The owner allowed writing to it directly ("عادي ارفع مباشرة"). Credentials were never committed (they lived only in
  the session's scratchpad); the Neon password was pasted in chat and must be rotated by the owner.
- Islamic content rules (guide §3): only sahih/hasan texts publish; new guidance text is marked
  `review: pending-sheikh`; no fatwa wording.

## 2. What the owner asked for, and his decisions

Feature list (plan: `docs/plan/2026-10-features-roadmap.md`, decisions D1–D9 recorded there):

1. Periodic worship reminders (e.g. صلة الرحم) with a calendar (Hijri aware).
2. Browser extension (later to move to its own repo `Akhera-Plants/Thekra-extension`).
3. «أعِنّي على طاعة»: small, steady deeds; no excess; increase only gradually.
4. «ترك المعصية»: a gradual plan with follow-up and private notes. **D1:** gradual leaving allowed for some sins against
   Allah's right when leaving at once is very hard; sins against people's rights are left (or lightened) with strong
   effort plus restoring rights, never "permitted gradually".
5. React Native app with login (later its own repo `Akhera-Plants/Thekra-mobile`).
6. Social sharing for every unit (verse, hadith, athar).
7. Add the sin «الانتقاد» (`intiqad`) and the deed «جبر الخاطر/الذوق» (`jabr-al-khatir`) as a pair.
8. Use the lecture of **Anas Sheikh Akrim** (habit building, YouTube `4EkrbmmIlno`) as the method reference.
   **Owner's citation rule:** take every hadith he cited with the grade he stated; if he stated no grade, treat it as
   sahih unless he weakened it; use his wording.
9. Each repo independent later; all clients talk to the API.

Mid-session correction from the owner: features must use **login and real database tables** and be robust (an early
version kept data only on the device / in one JSON blob). Decisions then:
- Habits, kinship and settings live in real tables and sync across web, mobile and extension.
- The sin program must not be readable by anyone: stored as an **end-to-end encrypted vault** unlocked by a user
  «رمز الخصوصية» (hashing the sin slug was rejected: ~90 sins are trivially brute-forced).
- Merge to `master` and `main` after checks (approved).

Later: web push "temporarily on the free Vercel plan" until a move to Hetzner, **and remind him when that move starts**;
then: drop the leftover empty table after a backup (approved).

## 3. What was built (by area)

| Area | Where | Notes |
| --- | --- | --- |
| Lecture research | `docs/research/anas-sheikh-akrim/` (transcript, analysis, `citations.yaml`, `import-to-db.py`) | transcript made by the owner locally with tafrigh (YouTube blocked from the cloud IP) |
| Content | `backend/prisma/taxonomy/deed-schedules.yaml`, `sin-programs.yaml`, `taxonomy.yaml` (+intiqad, jabr-al-khatir, pair) | evidence ids are public Quote ids; `review: pending-sheikh` |
| Shared engine | `packages/practice-core/src/` (dates, hijri via Intl umalqura, rules, ICS RFC 5545, plan ladder/hold/adherence, sin-program, kinship, Store v2 with tombstones, sync merge, vault) | TS source with `.js` specifiers; consumed by all clients and the API |
| API | `backend/src/modules/practice/*`, `backend/src/modules/push/*`, auth `GET/DELETE /v1/auth/me` (export, delete) | migrations `20261028140000_add_practice_sync`, `20261028160000_add_web_push` |
| Sync contract | `docs/plan/2026-10-practice-sync-contract.md` | LWW by `clientUpdatedAt` incl. tombstones; logs = max; contacts union + tombstone; ≤500 items; any `programs` key → 400 |
| Sin vault | practice-core `vault.ts`; API `/v1/me/sin-vault` | PBKDF2-SHA256 210k + AES-256-GCM (`@noble/*` 2.x), 1 KB padding, optimistic `version` (409 on conflict); server checks shape only |
| Web | `frontend/src/app/[locale]/{calendar,practice,practice/kinship,practice/leave-sin}`, `frontend/src/features/practice`, `frontend/src/lib/practice`, `frontend/src/lib/push`, `public/sw.js`, sharing in `lib/share` | accounts gated by `NEXT_PUBLIC_ACCOUNTS_ENABLED` |
| Extension | `extension/` (MV3, Chrome/Edge/Firefox), optional sign-in, plan/log sync | `README.md`, `PRIVACY.md` |
| Mobile | `mobile/app/(tabs)/habits.tsx`, `mobile/app/practice/*`, `mobile/src/lib/practice/*` (local notifications planner `reminders.ts`, sync, vault with optional keystore) | Metro resolver for practice-core |
| Web push (temporary) | `docs/plan/2026-10-web-push.md`; API `backend/src/modules/push/`; web card `PushRemindersCard` | see §4 |
| CI | `.github/workflows/ci.yml` | `packages-check` job; design-token false positives cleared; **build job now runs the built API on an empty migrated Postgres** (it was red on `master` before this session because `next build` prerenders pages that call the API) |
| Docs | `docs/deploy/VERCEL.md`, `docs/deploy/MIGRATION_OFF_VERCEL.md`, `AGENTS.md` (§ Before moving off Vercel), guide §10/§13 | |

## 4. Web push design (temporary)

Vercel Hobby cron runs once a day (±59 min) and a per-minute timer would keep the free Neon database awake (it would
exhaust the free compute and stop the whole site). So: each browser's reminders for the next 48 h are published to
**Upstash QStash** with `notBefore`; QStash calls `POST /v1/push/deliver` (signature verified with the SDK `Receiver`,
URL checked), which sends the notification **without reading the database**: the endpoint, keys and text travel in
the message, sealed with AES-256-GCM, key = HKDF(VAPID private key). Re-plan after every sync that carried changes and
once a day (Vercel cron `GET /v1/push/refill`, `Authorization: Bearer $CRON_SECRET`); only changed reminders are
cancelled or published (`PushReminder.key` + `digest`). Planner mirrors the mobile planner. Kinship at 18:00 with a
count only; the sin program never appears. Push is **off** until all of `VAPID_*`, `PUSH_PUBLIC_API_URL`, `QSTASH_*`,
`CRON_SECRET` are set. Move-off plan: `docs/deploy/MIGRATION_OFF_VERCEL.md` (replace `PushScheduler` /
`DeliveryVerifier` in `push-transport.ts`, keep the VAPID keys).

## 5. Production database changes (all on Neon production)

| When | Change | How to undo / evidence |
| --- | --- | --- |
| Before any write | Full backup taken and sent to the owner (`neon-backup-2026-10-28.tar`) | — |
| Import batch `2026-10-anas-habits` | New `Quote` rows (the lecturer's hadith and athar in his wording, grade per the owner's rule), a `Source` row, topic links in `GoodDeedQuote` / `SinQuote` | revert SQL in the header of `docs/research/anas-sheikh-akrim/import-to-db.py`; nothing existing was changed |
| New topics | `intiqad`, `jabr-al-khatir` and their pair (through the taxonomy import) | taxonomy files |
| Migrations | `20261028140000_add_practice_sync`, `20261028160000_add_web_push` (additive, new empty tables) | applied by Vercel builds (`prisma migrate deploy`) |
| Accident | `20261028120000_add_user_practice_store` (an early JSON-blob design) was applied to production **by a Preview deploy of the branch** before it was removed from the repo | **Previews share the production `DATABASE_URL` and migrate it** — open item |
| Clean-up (owner approved) | Dropped the empty `UserPracticeStore` table and its `_prisma_migrations` row in one transaction that aborts if the table has any row | backup JSON (structure, 0 rows, history row, original `CREATE TABLE`) handed to the owner; `MIGRATION_OFF_VERCEL.md` §3 |

Read-only check after the clean-up: table and history row gone; `Quote` count unchanged (65,220); `User` = 0.

## 6. Git history note

`master`/`main` had 7 (resp. 14) commits that the branch did not have, but the branch already contained rebased
copies of them (`e612f26..bd39cab`) whose tree is **identical** to `master` (`git diff bd39cab 7d52c66` is empty;
`main` tree = `master` tree). Commit `0e5de46` is a `-s ours` merge of `origin/master` and `origin/main` (empty diff),
so both could fast-forward without rewriting their history. Worth confirming.

## 7. Verified vs not verified

Verified in the session (sandbox Node 22; target is 24):
- Backend tsc, unit tests (94 files), e2e (24 files, 333 tests, real Postgres), build; the bundle booted with push on:
  QStash signatures from the current/next key accepted, wrong key and changed body refused; refill works.
- `backend/test/practice-client-compat.e2e-spec.ts`: the real practice-core client against the real API (sync, vault).
- `backend/test/push.e2e-spec.ts`: subscribe, re-plan after sync (no churn when unchanged), delivery, gone browser,
  account move, validation, refill auth, account deletion cancels.
- Frontend tsc, 139 tests, lint, i18n parity, design-token and RTL checks, `next build` against a running API.
- practice-core 142 tests; extension 70 tests + build; mobile tsc + 52 tests; `pnpm deprecations` PASS.
- GitHub CI green on `master` and `main` at `8930426` (docs-only commit `48c706f` after it).

Not verified:
- The live sites (`thekra.vercel.app`, `thekra-web.vercel.app`) — not reachable from the sandbox.
- A real push notification in a real browser; real calls to QStash (`upstash.com` blocked).
- Mobile on a device / store builds; extension in a real browser store.
- QStash free-tier limits and Vercel/Neon plan numbers were taken from search results, not the vendors' pages.

## 8. Where a review should look first

1. **Religious content and the owner's grading rule** for the lecturer's hadith (`citations.yaml`,
   `import-to-db.py`, batch `2026-10-anas-habits`): "no grade stated → sahih" is the owner's rule, not a scholarly
   verification. Sin programs and deed schedules are `pending-sheikh`.
2. **Sin vault crypto** (`packages/practice-core/src/vault.ts`, web `lib/practice/vault-flow.ts`, mobile vault
   runner): KDF parameters, IV handling, padding, what (if anything) about the sin can leak through sizes, timing,
   logs, notifications or the export.
3. **Sync merge correctness** (`backend/src/modules/practice/practice-sync*.ts`, practice-core `sync.ts`): tie rules,
   tombstones, the `WHERE` guards in the set-based upserts, concurrent devices.
4. **Web push** (`backend/src/modules/push/`): signature/URL verification, payload sealing, the replan diff and its
   race handling, refill time budget, quota behaviour, the account-deletion and sign-out clean-ups; `public/sw.js`
   click handling (same-origin only).
5. **Preview deploys migrating production** (open; see `MIGRATION_OFF_VERCEL.md` §2).
6. Duplicate planner logic: `mobile/src/lib/practice/reminders.ts` and `backend/src/modules/push/push-planner.ts`
   follow the same rules in two copies.
7. CI build job change (runs the API with `NODE_ENV=test`) and the `ours` merge (§6).

## 9. Open items for the owner

- Set `NEXT_PUBLIC_ACCOUNTS_ENABLED=true` on `thekra-web` (Production + Preview) and redeploy.
- Rotate the Neon password; update `DATABASE_URL` / `DIRECT_URL`.
- Web push env vars (VERCEL.md § Web push); keys generated locally with `pnpm --filter backend push:keys`.
- Give previews their own database.
- Add `Thekra-extension` / `Thekra-mobile` repos to the Claude GitHub app; store accounts; Firefox data-collection
  declaration.
- Sheikh review of new content; password reset needs an email provider; other lectures later.
- **When moving the API to Hetzner or similar: `docs/deploy/MIGRATION_OFF_VERCEL.md` first (owner asked to be
  reminded).**
