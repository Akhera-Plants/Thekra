# Site audit 2026-10-23: fixes and status

Source: `thekra-audit-and-fix-brief.md` (owner, 2026-10-23). This covers the functional items
(B01–B09). UI items (B10–B12, U01–U10) and content reviews (R01–R03) are not in this change.

## Status

| ID | Status | Root cause (proven) | Fix | Regression test |
| --- | --- | --- | --- | --- |
| B01 English of another hadith | **fixed in code + local data; production needs the release push** | The English edition is keyed by its running number; citations give the printed (Abd al-Baqi) number. For Muslim the two differ on 7,219 entries, so «مسلم 2589» got running entry 2589 = Muslim 1109 (fasting). | `translations/match.ts`: index by `arabicnumber`, pick among sub-narrations by the stored Arabic, refuse an entry whose Arabic barely overlaps. Importer replaces or removes only rows it wrote (edition texts); HadeethEnc English untouched. | `match.spec.ts` (Muslim 2589 → backbiting) |
| B02 virtue name under «كبيرة» | fixed | Sins index and sin page used `pair.titleAr` (the deed's title) for the sin. | Sin name everywhere on `/sins`; «الفضيلة المقابلة: …» links to the deed; the virtue still finds the sin in search. | `audit-regressions.spec.ts` B02 |
| B03 truncated featured text | **mitigated; the stored text needs review** | The Arabic corpus stored Bukhari 1992 as only its last clause. The «today» pick drew from every publishable text, unlinked fragments included. | «today» now picks only texts linked to a topic, with no open flag, and not on `prisma/taxonomy/text-review.yaml` unless reviewed COMPLETE. The list (818 texts) comes from the read-only audit `import:book audit-texts`. No text was rewritten. | `quotes.service.spec.ts`, `text-review.spec.ts`, `text-fragments.spec.ts` |
| B04 tafsir fails | fixed (live) | No `Access-Control-Allow-Origin`: the API project has no `CORS_ORIGINS`, and the code default was localhost only. | Site and preview origins built in (`BUILT_IN_CORS_ORIGINS`). | `cors-built-in.e2e-spec.ts` |
| B05 sharh fails | fixed (live) | Same as B04. The audited hadith has no sharh; the page now says so. | Same. | same |
| B06 kind tabs empty | fixed (live) | Same as B04: the filtered request was blocked. | Same. | `audit-regressions.spec.ts` B06 |
| B07 theme chip / stale list | fixed | Live: blocked request (B04) with the previous list kept. Also the URL theme was read with a no-op external store, and chips replaced history (no back/forward). | Effect reads `?theme=` after hydration and on `popstate`; each chip pushes a history entry. | `audit-regressions.spec.ts` B07 |
| B08 search needs tashkeel | fixed | Catalogue filter compared raw strings. | `namesMatch` folds query and names (`foldArabic`). | `topic-theme-search.test.ts`, B08 spec |
| B09 language switch drops state | fixed | Switch link carried only the path. | Keeps validated `theme` and `q` only. | `preserved-query.test.ts`, B09 spec |

## Data changes (local database, then the release copy)

`import:book translations` on the local database, report with every previous text kept for revert:
`backend/.corpus/translations/report-2026-10-23T02-42-01-049Z.json` (gitignored; also copied to the
main checkout's `backend/.corpus/translations/`).

| | Count |
| --- | --- |
| English replaced (wrong entry → right entry) | 3,151 (3,132 cite Muslim) |
| English added (right entry now found) | 1,223 |
| English removed (stored Arabic is another text than the cited entry) | 233 |
| Second run | 0 writes |

Production gets this only through `scripts/release-db.sh build` + `push` (owner, needs the Neon URL).

## Found while fixing (not in the brief)

- **E2E tests wiped the local development database** (my run, 2026-10-23): `setup-e2e.ts` keeps an
  already-exported `DATABASE_URL`. Restored from `thekra_release`; local seed users and favourites are
  not in that copy. Guard added: e2e refuses any database whose name does not end in `_test`.
- **Switching back to Arabic lands on `/ar/...`** instead of `/...` (live too, before this change).
  `e2e/direction.spec.ts` fails on that step. Not fixed here.
- Records whose Arabic is another text than their cited number (e.g. the record cited «البخاري 1543»
  holds an ihram hadith): their English was removed; the citation itself needs review (R01/R03).

## Not done / not verified

- B10–B12, U01–U10, R01–R03.
- B01 data on production (release push).
- Mobile viewport and dark mode were not re-checked for this change.
