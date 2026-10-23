# Thekra — History, Owner Requests and Lessons

> Companion of [PROJECT_GUIDE.md](./PROJECT_GUIDE.md). Written 2026-10-23 from the working sessions. Early
> phases are summarised from the session record and the older build docs (`docs/build/STATUS.md`,
> `PROGRESS.md`, `FINAL_REPORT.md`); where a detail is approximate it says so. The owner's own words are kept
> in Arabic/English exactly as typed (typos included) because tone and intent matter.

## 1. Timeline

| Phase | What happened | Key evidence |
| --- | --- | --- |
| **Foundation** | Monorepo (NestJS + Prisma + Postgres, Next.js, Expo). Autonomous build plans and Cursor prompts produced the first backend/frontend/mobile skeleton, auth, favorites, sins/good-deeds/branches APIs. | `docs/ARCHITECTURE.md`, `TECHNICAL_PLAN.md`, `AUTONOMOUS_BUILD_PROMPT.md`, `docs/build/*` |
| **Content import** | Quran + five tafsirs; Bukhari, Muslim, Riyad, Adhkar, Adab, Targhib (OCR), Zuhd, Kabair, Minhaj, Shuab al-Iman (al-Bayhaqi), 63 Ibn Abi al-Dunya books, HadeethEnc. | `docs/build/IMPORT_REPORT.md`, `ADHKAR_IMPORT.md` |
| **Classification** | Chapter maps for Bukhari/Muslim (661 chapters), Ibn Abi al-Dunya (131 rows), Adhkar (194 rows → 18 topics), topic themes (325 over 112 topics), 41 paired pages, athar review (1,259 rows: 544 keep / 708 drop), ayah review (250 keep / 241 drop), HadeethEnc map (198 applied), per-hadith Sahihayn map (566 high applied + 20 branch links; 667 low *not* published). | `docs/taxonomy/*`, `apply-report.md` |
| **UI port + polish** | Public UI ported from the `thekra-source` prototype; the owner declared it final and asked to protect it. | `docs/handoff/ui-port-session-context.md`, `.cursor/rules/ui-port-preserve.mdc` |
| **Study panel / sharh / athar** | Tafsir/sharh panel, athar labelled and gated, Riyad duplicate-number fix (`9ed6c8c`). | `docs/build/STUDY_PANEL_REPORT.md`, `SHUAB_ATHAR_REPORT.md` |
| **Security hardening** | Rate limiting, trust proxy, boot-time JWT secret checks, CSP and headers, zod jitless, `deepmerge-ts` override (`936014f`). | `docs/security/REVIEW.md` |
| **Deployment attempt 1** | Vercel root-directory picker showed no folders: default branch `main` held 3 unrelated files. Merged `origin/main` into `master` with `--allow-unrelated-histories` (`52f906a`). | |
| **CI + deprecations** | CI failed on `prisma validate` (`DIRECT_URL` missing). Fixed env, then audited the stack and built `deprecation-guard`, `pnpm deprecations`, root `AGENTS.md` (`011dd57`). Then every CI job was reproduced locally in a clean clone and made to actually run (`d88b239`). | `docs/build/DEPRECATIONS.md`, `CI_GREEN.md` |
| **Vercel API bring-up** | Sequence of real failures, each diagnosed from logs (see §5): framework preset (`7956051`), install command, helmet types (`eaeaeeb`, `eeaa2c1`), ESM `require` crash → esbuild bundle + serverless handler (`87ea4df`), weak JWT secret, taxonomy YAML missing in the function (`73b727b`). | `docs/deploy/VERCEL.md` |
| **Production data** | Release pipeline: clean copy without seed accounts, 87 verification checks, push to Neon, production admin command (`19e7b8f`). Pushed by the owner; all digests/counts matched. | `docs/build/RELEASE_DB.md` |
| **Reports for the sheikh** | Arabic methodology + شعب الإيمان reports from SQL (`2e194e9`). | `docs/methodology/` |
| **CORS + local dev** | Narrow preview-pattern CORS, `LOCAL_DEV.md` (`230862e`). | |
| **Speed and UX round** | API 4 s → fewer round trips + `fra1` + CDN headers + merged theme chips (`05c8188`); web loader/errors/ISR/direction/typography/English font (`7873df2`). | `PERFORMANCE.md`, `FEEDBACK_AND_ERRORS.md` |

## 2. The owner's requests, in his words

Grouped by theme; quote marks are his text. Treat these as standing requirements.

**How to work**
- «now you implement and do things don't stop until this is being done fully… no cursor keep me updated in simple short things in arabic response and md files»
- «جاوبني بالعربي دايما حتى لو هو بعث انجليزي» · «قلتللك اديما اوبني عربي» (after an English reply)
- «make sure not importing random skills or wrong implementation» — build our own skills; vet anything installed.
- «حل بطريقة ذكية وحدد المشكلة لا تقعد تهلس! ما بدي اي خطأ بالديبلويمنت بعد هلأ!» — diagnose properly, no more deployment errors.
- «give me two files … guide for every single thing that claude will need to know…» (this guide).

**Content and scholarship**
- «ما ابدي نحطهم بالقوة بس اذا الهم علاقة نضيفهم» — link Sahihayn hadith only when truly related; don't re-review those already in use; careful with شعب الإيمان.
- Scholar-sourced, correctly classified, publishable texts; no al-Albani; athar only from Companions/senior Successors and clearly marked; Isra'iliyyat out.
- The sin/deed pair is **one** page («الصلاة»), themes from both sides — he confirmed this model.
- «بدي منك تولدلي فايل … عن منهجيتنا بالاحاديث شو الي عملناه بكل كتاب … كتاب رياض الصالحين اخذنا منه عدد احاديث كذا … وتركنا كذا (بتحطلي امثلة عالي امترك وليش بأقصر طريقة)… على شيخ ومبرمج … وملف ثاني لشعب الايمان لحالها» → `docs/methodology/`.
- Deferred by him: professions/محرمات التخصصات (needs his source), IIFA financial resolutions (after deploy), reviewer platform, accounts/login, التحقيق.

**UI/UX (latest round, 13 items — all addressed)**
1. «لودر سفاح متناسب مع الهوية البصرية» — a branded loader wherever loading happens.
2. «الموقع كثير بطيء بالنفجيشن» — find out if it is the free plan; estimate hosting plans for a domain on Hetzner/DigitalOcean.
3. «لماذا هذه الاية/الحديث» card needs a stronger purpose (summary of the tafsir/sharh, etc.) — «اقترح علي اشياء لاني حاببب شكلها وبدي ياها تظل موجودة».
4. Tafsir on the deployed version fails with CORS.
5. Chip clicks show an unclear grey loading screen; all errors must be handled properly.
6. Tabs are LTR in Arabic and keep the direction after switching language; duplicate chips with different counts — «تاكدلي من الدتاتا».
7. Breadcrumb not translated; 8/12. Arabic text visible in the English view; 9. English font unsuitable for scholarly content — «اختار انت»; 10. leaf artwork not working with RTL; 11. featured card text must be truncated with full text on hover/click without making the card taller than its neighbour; 13. language switch is slow.
- «كل قصة الهارد كودد ltr and rtl عم تعمل مشاكل شيكهم وفكسهم وشيك لو في مشاكل متوقعة قريبة منهم» — audit all hard-coded directions and nearby risks.

**Deployment**
- Vercel (Hobby) + Neon; he did the dashboard steps himself, pasted logs and screenshots, and expects exact copy-paste instructions.
- «ليش خلّيته ماستر؟» — he wants the deployed branch to be the one with the work (we keep `master` and `main` identical).

## 3. Decisions (so nobody re-litigates them)

- Paired sin/deed = one page. Athar are shown but labelled; athar gate = listed speaker + `KEEP`.
- Low-confidence Sahihayn matches are **not published** until a scholar accepts them.
- `ATHAR_PUBLIC_ENABLED=true` in production (code default is off on purpose).
- Accounts/login hidden; `/auth/register` question open.
- API runs on Vercel as one bundled function in `fra1`; DB on Neon `eu-central-1`; frontend ISR + native fetch.
- English UI face = Source Serif 4 (supersedes the earlier «Amiri for English» line).
- Prisma stays on 6.19.3 until a planned upgrade; no major upgrades inside unrelated work.
- Our own `deprecation-guard` skill; no third-party skills for deprecations.
- Big screenshot folders (`docs/design/after/direction/{before,after}`, ~31 MB) are kept locally, not committed.

## 4. Mistakes and lessons (the "avoid this" list)

| # | What went wrong | Root cause | Fix | Rule going forward |
| --- | --- | --- | --- | --- |
| 1 | siyam page showed «تحريم الغدر» hadith | Riyad bab number 227 is duplicated across kitabs | `resolveRiyadNumbers` disambiguates by kitab; 10 bad links deleted (`9ed6c8c`) | Match by (kitab, bab), never bab number alone; spot-check a page after every link batch |
| 2 | Kept athar invisible; athar card said «حديث نبوي» | where-clause excluded ungraded athar; badge was hard-coded | `whereClause` admits kept athar; neutral «أثر» badge; test | Content gates need a test that a kept item actually appears |
| 3 | Stripping «[ص: N]» removed Surah Sad citations (27 rows) | regex too greedy | keep it after `}`/`﴾`; rows restored | Text cleanups must have a before/after diff and a Quran-aware exception |
| 4 | Stray compiled `yaml.js` files committed | build output in `src` tree | removed | Never commit generated output |
| 5 | Vercel directory picker empty | default branch had unrelated history | merged unrelated histories | Check the default branch before blaming Vercel |
| 6 | CI `prisma validate`: `DIRECT_URL` not found | `prisma.config.ts` disables `.env` loading; CI had no var | env at workflow level; e2e job overrides both URLs | Config that disables auto-loading ⇒ every env must exist in CI + `.env.example` + deploy doc (rule in `AGENTS.md`) |
| 7 | e2e could have migrated the wrong DB | workflow-level `DIRECT_URL` pointed at the non-test DB | job-level override | When overriding one URL override its twin |
| 8 | Migration drift check failed | pg_trgm GIN index in a migration was missing from `schema.prisma` | declared with `type: Gin` + `ops: raw("gin_trgm_ops")` | Check `prisma migrate diff --exit-code` locally in a clean DB |
| 9 | CI "passed" for jobs that never ran | `if rg …` treats "command not found" as "no match"; ubuntu has no ripgrep | install ripgrep, fail on rg errors; 13 colour literals tokenised | A check must be shown to **fail** on a planted violation |
| 10 | Two specs read gitignored `backend/.corpus` / a DB | local files hid CI failures | skip when absent; `DATABASE_URL=''` for unit job | Reproduce CI in a **clean clone** without `.env`/ignored files |
| 11 | Vercel install: `ERR_PNPM_NO_PKG_MANIFEST` | `cd ../..` custom installCommand | removed it | Let Vercel do the workspace install |
| 12 | Backend preset `framework: null` served nothing | null overrides dashboard detection | later replaced by explicit function entry | `vercel.json` overrides the dashboard — read it first |
| 13 | helmet `TS2349` on Vercel only | helmet's exports map has no `types` condition → different `.d.cts`/`.d.mts` per install layout; an `@types/helmet` stub muddied it | removed stub, named-default import (**did not fix it**), then `createRequire` (fixed) | When a fix can't be reproduced locally, say so, and pick the fix that removes the dependency on resolution; don't claim it works until the deploy proves it |
| 14 | Every request: `ERR_REQUIRE_ESM` | Nest 12 ESM-only; `@nestjs/throttler` CJS `require()`s it; Vercel's loader has no require(esm) (Node 22.12+ locally does) | esbuild bundle + serverless handler + `gate:vercel` (flag `--no-experimental-require-module`) | Local Node is more permissive than Vercel — build a gate that mimics the platform |
| 15 | Production started failing on JWT secret | startup guard (by design) needs ≥32 chars | owner set a longer secret | The guard is correct; prove the real secret length before deploy |
| 16 | `/v1/sins` and good-deeds 500, others 200 | taxonomy YAML read from `process.cwd()` at runtime; not shipped in the function | embed YAML at build; gate runs from a dir with only shipped files | Never read repo files at runtime in serverless; the gate must run from the function tree (it failed first, proving the repro) |
| 17 | Neon constraint count FAIL in release verify | PG18 records NOT NULL as `pg_constraint` rows (167 here) | exclude `contype='n'` | A cross-version check must compare like with like |
| 18 | Release dump wouldn't run | host `pg_dump` is v14, server 16 | use the container's tools | Check client/server versions |
| 19 | I killed the owner's local API (`pkill dist/main`), a worker killed `next dev` | broad `pkill` | restarted exactly as before | Never broad-kill; use a free port; restart exactly if you must |
| 20 | Duplicate theme chips with different counts | same label on both sides of a pair, merged naively | merge by label, union count, `?theme=` accepts either key | When merging two sources, dedupe by meaning and test count == filtered total |
| 21 | Tafsir panel «تعذّر تحميل النص» | production `CORS_ORIGINS` not set | owner action; UI now degrades with retry | Verify CORS with a real preflight from the web origin after every API deploy |
| 22 | Pages took 6–7 s | API in `iad1`, DB in Frankfurt, ~30 sequential queries, everything `force-dynamic`, axios bypassing Next cache | `fra1`, parallel queries, ISR + native fetch, CDN headers | Measure first (timings per layer), then fix the layer that costs |
| 23 | Arabic strip didn't move | LogoLoop measures with left-based geometry; `dir=rtl` made the period negative | `dir="ltr"` on the track | A ticker/measuring component needs an LTR track |
| 24 | Radix tabs LTR on Arabic | no `Direction.Provider` | provider tied to the locale | Wrap third-party primitives with the app's direction |
| 25 | Docs claimed numbers that were stale | prose copied from old reports | numbers come from SQL (`docs/methodology/queries.sql`) | Every number in a report comes from a query/command you ran; say when docs and DB differ |
| 26 | I once captured a pipeline's exit code (`tail`) instead of the command's | `cmd | tail; echo $?` | re-ran with redirected output | Read `PIPESTATUS`/redirect to a file when testing exit codes |
| 27 | A secret copy of `.env` was copied to `/tmp` during a test | careless | deleted immediately | Never copy `.env`/secret files; assume anything pasted in chat is compromised |

Process lessons that cut across the table:
- **Reproduce before fixing.** Prefer an automated reproduction (a failing gate) over a plausible theory.
- **Say what was not verified** (Node 24, live Vercel, Linux Prisma engine, touch devices, real latency).
- A worker's "all green" has been wrong or incomplete several times (hidden-by-gitignore passes, jobs that never ran,
  wrong fix for helmet). Always re-run the commands yourself.
- Don't let two workers edit the same file; if overlap is unavoidable, name the shared files and tell each to re-read
  before editing (done for `messages/*.json`, `globals.css`).

## 5. Deployment error ladder (what each Vercel/CI message meant)

1. `Environment variable not found: DIRECT_URL` (CI) → CI env.
2. `No package.json found in /vercel` → remove custom install command.
3. `NODE_TYPESCRIPT_ERROR … TS2349 … helmet` → resolution-dependent types; `createRequire`.
4. `Missing required environment variable: NEXT_PUBLIC_API_URL` (web build) → set it for **each** environment (Production *and* Preview).
5. `FUNCTION_INVOCATION_FAILED` + `ERR_REQUIRE_ESM` → bundle.
6. `Invalid environment (production): JWT_REFRESH_SECRET must be at least 32 characters` → env value too short.
7. `/v1/sins` 500 only → file read at runtime.
8. Browser CORS error → `CORS_ORIGINS` missing on the API.
9. Slow pages → region mismatch + query count + no caching.

## 6. Open design question: «لماذا هذه الآية / لماذا هذا الحديث؟»

Today the card (`QuoteCard.tsx`, string `whyVerse`/`whyHadith`) explains *where the text sits in the scholars'
chapters* — the owner wants a stronger purpose but likes the card and wants it kept. Available data
(local DB): Al-Mukhtasar fi Tafsir (Tafsir Center) covers all 6,236 verses, ≈168 Arabic chars each; al-Saʿdi 6,177
verses ≈530 chars; HadeethEnc has sharh for 5,599 hadith (≈583 chars) and fawaid for 5,593 (≈378 chars); gharib for
3,629. **No asbab al-nuzul / asbab al-wurud in the database.** Proposal (not yet built):
1. Verses: one-to-two-line summary from al-Mukhtasar as «المعنى المختصر», al-Saʿdi under «اقرأ أكثر».
2. Hadith: «فوائد الحديث» (2–3 bullets from HadeethEnc fawaid) or the first sentence of its sharh.
3. Hadith without sharh (most Sahihayn): show the chapter/theme label that tied it to the topic (today's behaviour, clearer).
4. Asbab al-nuzul: needs a vetted source and the sheikh's approval — later.
Owner to choose; keep the existing look.

## 7. State at this snapshot

Verified by running the commands (2026-10-22/23): backend tsc, 719 unit tests, 304 e2e, `gate:vercel`, `pnpm deprecations`;
frontend tsc, lint (0 errors, 1 old LogoLoop warning), 58 unit tests, 15 Playwright specs, production `next build`
in an isolated copy; release build 87/87 checks; Neon restore digests match; live `/health`, `/health/ready`,
`/v1/sins` (84), `/v1/good-deeds/dhikr/quotes` (468) returned the expected values after the earlier deploy.

**Not verified:** the new web and API changes on the live Vercel deployment (just pushed), production CORS (owner
setting), Node 24 locally, Prisma's Linux engine locally, hover/tap behaviour on a real touch device, real
(not simulated) latency after `fra1`, the 31 other pages' screenshots (workers reviewed them).

## 8. Checklists

**Before pushing code**
- [ ] Right commands run and seen passing (guide §8); `pnpm deprecations` if deps/config changed.
- [ ] Backend change → `gate:vercel`. Frontend change → `pnpm test:ar` with `--workers=2`, plus a production build (isolated copy if `next dev` is running).
- [ ] New env var in CI + `.env.example` + `VERCEL.md`. No secrets in the diff.
- [ ] Only your files staged; generated output and big screenshot folders not staged.
- [ ] Merge `master` into `main` after pushing `master`.

**Before/after a deploy**
- [ ] Vercel env present for Production **and** Preview (`NEXT_PUBLIC_API_URL`, API vars incl. `CORS_ORIGINS`).
- [ ] `/health`, `/health/ready`, themed API route, CORS preflight, browser console clean, `x-vercel-cache` behaviour.

**Content change**
- [ ] Mechanism recorded (chapter map / per-hadith map / decision sheet) and reviewable; importer idempotent (second run 0).
- [ ] Quran only from DB; no machine translation; athar rules; Western digits; no fatwa wording.
- [ ] Spot-check a few topic pages (the Riyad bug was found that way).
- [ ] `scripts/release-db.sh build` passes before any push to Neon; tell the owner the exact `push` command.

**UI change**
- [ ] Read `ui-port-session-context.md` and the `.cursor` rule; don't revert the protected items.
- [ ] Check ar **and** en, light **and** dark, 1440 **and** 390; no horizontal scroll; no Latin on Arabic, no Arabic on English.
- [ ] Logical properties only; deliberate `ltr`/`rtl` carry a one-line comment.
- [ ] Every new fetch has loading, error + retry, and aborts/ignores stale responses.

**Briefing a worker**
- [ ] Goal, files, constraints, what must not change, exact commands, areas owned by other workers, "do not commit/push", "do not kill the owner's servers", and the owner's content rules if content is touched.
