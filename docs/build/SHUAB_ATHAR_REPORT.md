# Shu'ab rematch, athar, accounts hide, Ibn Abi al-Dunya — build report

Task: `docs/build/CURSOR_SHUAB_ATHAR_IBNABIDUNYA.md`.

## Phase 1 — Shu'ab matn + rematch

### Before → after

| Metric | Before | After |
| --- | ---: | ---: |
| Shu'ab quotes | 10725 | 10725 |
| Public (SAHIH/HASAN + publishable source) | 530 | 530 |
| — AUTO_SAHIHAYN | 272 | 272 |
| — SUNAN_TAHQIQ | 134 | 134 |
| — HADEETHENC | 124 | 124 |
| Branches with ≥1 public text | 64 | 64 |
| HadithMatch rows (Shu'ab) | 8793 | 8793 |
| Strong (≥ 0.75) | 346 | 346 |
| Mid (0.60–0.75) | 885 | 885 |
| `matnAr` filled | 0 | 10725 |
| Isnad cut empty (often short/clean text) | — | 289 |
| `ImanBranchQuote` with `basis=TAKHRIJ` | 0 | 332 |
| Sin TAKHRIJ via branch map | — | 61 |
| Deed TAKHRIJ via branch map | — | 246 |

Note: the mid-band did not shrink. The backend `splitMatn` already cut most Bayhaqi chains before rematch; remaining 0.60–0.75 scores are genuine near-matches of the matn, not isnad pollution. Matn is now **stored** and used for matching/display.

### What shipped

- Schema: `Quote.matnAr`, `Quote.isAthar`, `Quote.atharSpeakerKey`; `ImanBranchQuote.basis` + `classifiedBy`
- Import: Shu'ab writes `matnAr` + `rawPayload.fullTextAr`; CLI `shuab-matn` / `shuab-propagate`
- Matching: takhrij / sunan-tahqiq / hadeethenc prefer `matnAr`
- Display: public DTO never returns the chain when `matnAr` is set; matched Shu'ab rows get `citation.alsoIn` («ورد في الجامع لشعب الإيمان…»)
- HadeethEnc was already present from the prior study-panel phase (not skipped)

### Gates (Phase 1)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 446 passed |
| backend e2e | 258 passed |
| `shuab-matn` re-run | `updated=0 already=10725` |
| `shuab-propagate` re-run | `branch=0 sin=0 deed=0` |

## Phase 2 — athar

_(pending)_

## Phase 3 — hide accounts

_(pending)_

## Phase 4 — Ibn Abi al-Dunya

_(pending)_
