# Al-Adhkar (al-Nawawi) — structure-only import

Importer: `backend/prisma/imports/adhkar/` · key `adhkar` (`pnpm import:book adhkar`) · modeled on the Ibn Abi al-Dunya importer.

## Source row

One Source `10000000-0000-4000-8000-000000000027` — «الأذكار», author «يحيى بن شرف النووي», en "al-Adhkar — al-Nawawi", `apiProvider = book:nawawi-adhkar`, registered in `backend/prisma/imports/approved-works.ts`. No topic / sin / deed / iman-branch links of any kind were created (verified by SQL below); the reviewer maps chapters later.

## Edition chosen and why

OpenITI repo **0700AH**, folder `data/0676Nawawi/0676Nawawi.Adhkar`. All five editions were inspected at the pinned commit:

| Edition | Verdict |
| --- | --- |
| **Shamela0001956-ara1** (Dar al-Fikr, ed. ʿAbd al-Qadir al-Arna'ut) | **Chosen.** Only edition with clean `### \|` kitab/bab headings (18 كتاب, 332 باب, 14 فصل) *and* per-narration `### \| N - ` numbering (1251 numbered narrations, 1–1263, single volume, 413 pp.). |
| Shamela0010639-ara1 (al-Jaffan wa-l-Jabi / Dar Ibn Hazm) | Rejected: several blank `### \| كتاب ` headings and `### \| .....` filler headings. |
| Sham19Y0013566-ara1 | Rejected: only machine-generated `AUTO` headings. |
| JK001249-ara1 | Rejected: no structural `###` headings at all. |
| Shia002207-ara1 | Never used, per policy. |

Pinned in `backend/prisma/imports/adhkar/edition.ts`:

- commit `3d8ff4e7b035aaa4ca5dda52c7322645f3401dcf` (latest commit touching the folder at import time)
- SHA-256 `dc4947906c9bce1834eeec51f5c0c1e3f0aaf09b7e918628c87e849a97112845`

The file is cached under `backend/.corpus/0676Nawawi.Adhkar.Shamela0001956-ara1` (git-ignored, CC BY-NC-SA 4.0) and the checksum is verified by `loadCorpus` on every run.

## Parsing notes

- `### | N - ` headings start narrations (one narration, 694, sits on a `# N - …` paragraph). 28 printed numbers repeat; later occurrences get `openiti:<n>#2` externalIds so every narration keeps its own quote row.
- This edition wraps many headings in `(…)` / `[فصل]`; wrappers are stripped before كتاب/باب/فصل level detection. «أبواب …» headings group babs at kitab rank.
- Page markers are stripped with `src/common/text/strip-page-markers.ts`; `matnAr` comes from `splitMatn` so the shared **matn-only** takhrij applies.
- Al-Nawawi's own grading remarks («رويناه في صحيح البخاري», «إسناده صحيح») remain inside narration/author text and are **never** read as a grade source. GradePolicy was not changed: unmatched hadith stay `UNGRADED / AUTHORITY_LEGACY` and therefore unpublished.
- `book:nawawi-adhkar` was added to the athar classifier allowlist (`athar/classify-import.ts`, label in `athar/review.ts`).

Parse spec (`adhkar/parse.spec.ts`) anchors: narration 1 «من دعا إلى هدى» (صحيح مسلم) in the muqaddima; «باب ما يقول إذا استيقظ من منامه» whose first narration is 36 «يعقد الشيطان على قافية رأس أحدكم»; «كتاب تلاوة القرآن» as KITAB with the full run of 18 كتاب / 1251 narrations.

## Counts

Import run (second run writes 0 — idempotent):

```
الأذكار: sections=373 createdSections=373 createdItems=2047 quotes=1826; corpus=0676Nawawi.Adhkar.Shamela0001956-ara1@3d8ff4e7b035aaa4ca5dda52c7322645f3401dcf sha256=dc4947906c9bce1834eeec51f5c0c1e3f0aaf09b7e918628c87e849a97112845
الأذكار: sections=373 createdSections=0 createdItems=0 quotes=1826; corpus=0676Nawawi.Adhkar.Shamela0001956-ara1@3d8ff4e7b035aaa4ca5dda52c7322645f3401dcf sha256=dc4947906c9bce1834eeec51f5c0c1e3f0aaf09b7e918628c87e849a97112845
```

- BookSection rows: **373** (18 KITAB, 332 BAB, 14 FASL, 9 OTHER incl. صدر الكتاب and أبواب groups) — exported to `docs/taxonomy/sections/adhkar.tsv` (same columns as the Ibn Abi al-Dunya TSVs).
- SectionItem rows: **2047** — AYAH **221** (all linked to canonical Quran verses), HADITH **1251**, AUTHOR_TEXT **575**.
- Quote rows: **1826** — 1251 HADITH (`book:nawawi-adhkar`) + 575 BOOK_EXCERPT (`book-structure`).

After the shared matching runs (`pnpm import:book takhrij`, then `hadeethenc` from its on-disk cache, then `athar`):

| Matching | Hadith |
| --- | --- |
| Sahihayn candidates (HadithMatch) | 719 |
| Sahihayn strong → SAHIH / AUTO_SAHIHAYN | **145** (رواه مسلم 76, رواه البخاري 58, متفق عليه 11) |
| HadeethEnc → HADEETHENC | **128** (SAHIH 102, HASAN 26) |
| Sunan (SUNAN_TAHQIQ) | **0** — by design: that run only touches quotes with accepted topic links, and al-Adhkar has none |
| Athar-classified (isAthar) | 31 |
| Still UNGRADED / AUTHORITY_LEGACY (unpublished by GradePolicy) | 978 |

**Would be public:** 273 hadith (145 AUTO_SAHIHAYN + 128 HADEETHENC, all SAHIH/HASAN, textSource DIGITAL). The remaining 978 hadith and all 575 author excerpts stay out of reader endpoints under the existing GradePolicy.

## Link check

```sql
select count(*) from "SinQuote" l join "Quote" q on q.id = l."quoteId" where q."sourceId" = '10000000-0000-4000-8000-000000000027'; -- 0
select count(*) from "GoodDeedQuote" l join "Quote" q on q.id = l."quoteId" where q."sourceId" = '10000000-0000-4000-8000-000000000027'; -- 0
select count(*) from "ImanBranchQuote" l join "Quote" q on q.id = l."quoteId" where q."sourceId" = '10000000-0000-4000-8000-000000000027'; -- 0
```
