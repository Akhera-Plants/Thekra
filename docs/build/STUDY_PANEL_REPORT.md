# Study panel & sharh — build report

Task: `docs/build/CURSOR_STUDY_PANEL_AND_SHARH.md`.

## Phase 1 — HadeethEnc

| Metric | Value |
| --- | ---: |
| Fetched | 3574 |
| Matched (≥ 0.75 matn) | 2120 |
| Unmatched (imported as Quotes, no topic links) | 1454 |
| Explanations written (SHARH / FAWAID / GHARIB, ar+en) | 18944 (idempotent re-run: created 0) |
| Grades applied as `HADEETHENC` | 1173 |
| Grades skipped (Sahihayn / AUTO / SUNAN_TAHQIQ / MANUAL / weak) | — |

- Grade policy: `HADEETHENC` is publishable; never overwrites SAHIHAYN / AUTO_SAHIHAYN / SUNAN_TAHQIQ / MANUAL.
- Citation: `حكم موسوعة الأحاديث النبوية: صحيح — <reference>`.
- Reviewer file: `docs/taxonomy/hadeethenc-unlinked.tsv`.
- Commit: `6b8d072`.

## Phase 2 — long Sahihayn sharh — STOP

OpenITI texts exist:

| Work | OpenITI path | Commit (probed) |
| --- | --- | --- |
| Fath al-Bari | `0875AH/…/0852IbnHajarCasqalani.FathBari.Shamela0001673-ara1` | `a6d5dbe…` |
| Sharh al-Nawawi | `0700AH/…/0676Nawawi.MinhajFiSharhMuslim.Shamela0001711-ara1` | `6dca5e25…` |

Passages are often keyed `# [N]` in Fath / Abd al-Baqi numbering, but:

- Required Bukhari anchor **3261** has **no** `# [3261]` (gap 3258→3265).
- Only ~66% (Fath) / ~71% (Nawawi) of numbers are keyed.

**STOP:** numbering cannot be mapped reliably; do not guess. No `SHARH_LONG` rows imported. Schema enum `SHARH_LONG` remains for a later denser edition. Phase 3 tabs «فتح الباري» / «شرح النووي» stay hidden (no data).

## Phase 3 — study panel

- Trigger: quiet «التفسير» / «الشرح» on `QuoteCard` (+ quote detail); opens kit `Sheet` + `SegmentTabs`.
- Verse tabs: المعنى (المختصر) / السعدي / التحرير والتنوير; en: Meaning (Mukhtasar) only when EN text exists.
- Hadith tabs: الشرح / الفوائد / معاني الكلمات (+ فتح الباري / شرح النووي when SHARH_LONG exists — none after Phase 2 STOP).
- Reading: ≤68ch, Quranic spans in Quran font + accent, long texts truncated at ~1200 chars with «اقرأ المزيد».
- Toolbar: expand (`/quran/[surah]/[ayah]`, `/hadith/[id]`), share (copy link + tab), prev/next, close; Esc / ←→.
- Removed inline `VerseTafsir` accordions.
- Screenshots: `docs/design/after/study/` (verse + hadith × light/dark × 1440/390 × ar/en).

### Gates (Phase 3)

| Check | Result |
| --- | --- |
| frontend `tsc --noEmit` | pass |
| backend `tsc --noEmit` | pass |
| frontend lint | pass (1 pre-existing LogoLoop `<img>` warning) |
| backend lint | pass (pre-existing unbound-method warnings in specs) |
| frontend unit | 25 passed |
| backend unit | 446 passed |
| backend e2e | 258 passed |
| taxonomy importer re-run | `created=0 updated=0 deleted=0` (topics + links) |

## Phase 4 — deploy prep

NestJS on Vercel is viable (official zero-config via `backend/src/main.ts` + Fluid Functions; docs checked 2026-10-20). Files added:

| File | Role |
| --- | --- |
| `docs/deploy/VERCEL.md` | Owner steps: Neon Marketplace, two projects, env table, migrate, restore, domain, Hobby note, Render fallback |
| `backend/vercel.json` | Monorepo install + `prisma generate` / `migrate deploy` / `nest build` |
| `frontend/vercel.json` | Monorepo install + Next build |
| `scripts/db-push-to-neon.sh` | `pg_dump` local → `pg_restore` Neon (URLs from env only) |
| `backend/prisma/schema.prisma` | `directUrl = env("DIRECT_URL")` for Neon migrations |

Local production builds: `pnpm --filter frontend build` ✓ · `pnpm --filter backend build` ✓

### Gates (Phase 4)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 446 passed |
| backend e2e | 258 passed |
| taxonomy importer re-run | `created=0 updated=0 deleted=0` |
| frontend + backend production build | pass |
