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

Classifier: `backend/src/common/text/athar-classify.ts` (30/30 unit samples in `athar-classify.spec.ts`).

| Metric | Value |
| --- | ---: |
| Narrations classified | 12527 |
| MARFU | 2535 |
| ATHAR | 9992 |
| Listed speakers (public) | 827 |
| Unlisted (hidden; TSV) | 9165 |
| Idempotent re-run updates | 0 |

- Reviewer file: `docs/taxonomy/athar-unlisted-speakers.tsv`
- Speakers YAML: `backend/prisma/taxonomy/athar-speakers.yaml`
- Public: listed athar via `GradePolicy` (`isAthar` + `atharSpeakerKey`); ReminderReader section «من أقوال السلف» + tab «الآثار» / «Sayings of the Salaf»; QuoteCard shows «— speaker» and «أثر، وليس حديثًا» (no grade badge)

### Gates (Phase 2)

| Check | Result |
| --- | --- |
| tsc / lint | pass |
| frontend unit | 25 passed |
| backend unit | 476 passed (incl. 30 classifier samples) |
| backend e2e | 258 passed |
| `import:book athar` re-run | `updated=0` |

Screenshots of branch + `/sins/ghibah` (1440/390, ar/en) — captured after Phase 3 when servers are up, or noted if deferred.

## Phase 3 — hide accounts

Flag: `NEXT_PUBLIC_ACCOUNTS_ENABLED=false` (default in `frontend/.env.example`).

Hidden when flag is off:
- Header sign-in / register (`AuthNavItems`)
- Favorites nav (`SavedNavLink`) + footer favorites link
- Home featured-reminder save button
- QuoteCard favorite button
- `/login`, `/register`, `/favorites`, `/settings` redirect home

Admin: `/admin` shows `LoginForm` inline when unauthenticated (`redirectTo=/admin`). Report-mistake stays.

Playwright: dropped stale «القائمة» / `English` expectations; locale switch expects `En`. About page no longer leaks Latin from HadeethEnc `nameAr` (pure «موسوعة الأحاديث النبوية»).

### Gates (Phase 3)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 476 passed |
| backend e2e | 258 passed |
| Playwright | 2 passed |
| `import:book athar` re-run | `updated=0` |
| Hidden-auth smoke | no sign-in/register/favorites/save on home; `/login` → `/`; `/admin` has email login |

## Phase 4 — Ibn Abi al-Dunya

OpenITI pin: `0300AH@01a1544130e0236850ef2698923ad01575c5bd7c` (63 works under `0281IbnAbiDunya`).

| Metric | Value |
| --- | ---: |
| Sources (one per work) | 63 |
| BookSection | 2140 |
| SectionItem | 19652 |
| Quotes created | 18712 |
| — HADITH | 8890 |
| Listed athar (after classifier) | 550 |
| Strong takhrij matches (≥ 0.75) | 176 |
| Sin / deed / branch links | **0** (structure only) |

- CLI: `pnpm --filter backend import:book ibn-abi-dunya`
- Parser handles both `### N -` headings and `# N -` paragraph numbers
- Reviewer TSVs: `docs/taxonomy/sections/ibn-abi-dunya/<Key>.tsv` + `_index.tsv`
- Athar classifier already scopes `book:ibn-abi-dunya*`; re-run after import: `updated=8158` then `updated=0`
- Takhrij run on all HADITH (matn); no topic / chapter maps for these sources

### Gates (Phase 4)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 478 passed (incl. Dunya parse samples) |
| backend e2e | 258 passed |
| `ibn-abi-dunya` re-run | `createdSections=0 createdItems=0` |
| `athar` re-run | `updated=0` |
| Playwright | 2 passed |

### Screenshots

Under `docs/design/after/shuab-athar/`:

- Branch 1 + ghibah: 1440/390 × ar/en (athar tab clicked when present)
- `home-auth-hidden-1440-ar.png` — no sign-in / favorites / save chrome
