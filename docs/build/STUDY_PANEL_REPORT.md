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

_(filled when Phase 3 lands)_

## Phase 4 — deploy prep

_(filled when Phase 4 lands)_
