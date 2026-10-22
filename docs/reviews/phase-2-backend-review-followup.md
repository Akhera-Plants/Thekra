# Phase 2 Backend Review — Follow-up

> Companion to [`phase-2-backend-review.md`](./phase-2-backend-review.md).  
> Status snapshot at HEAD `6fb761e` (2026-10-05).

## Status

| Area | State |
| --- | --- |
| P0 (except P0-4) | ✅ fixed + e2e |
| P1 (all) | ✅ fixed + e2e |
| P2 (most) | ✅ fixed; see gaps below |
| P3 polish | ⏸ deferred |
| Owner D-1…D-4 | ✅ applied |
| Owner D-5 / P0-4 | ⏸ waiting on ticks below |

**Checks (backend):** `lint` · `tsc --noEmit` · **134** unit · **205** e2e · `prisma validate` — green.  
`grep -rn "Type(() => Boolean)" backend/src` — empty.

---

## Owner decisions (final) — applied

| ID | Decision | Commit |
| --- | --- | --- |
| **D-1** | `AdminApiKeyGuard` (`x-admin-key` vs `ADMIN_API_KEY`; unset + production → 403 on `/admin/*`). Remove in Phase 4. | `186b635` |
| **D-2** | Additive `createdAt` / `updatedAt` on `SinQuote` + `GoodDeedQuote`; restore `sort=newest` by `createdAt`, then `id`. | `a2cad1d` |
| **D-3** | `add_query_indexes` migration for the P2-17 list (+ ayah composite). | `6fb761e` |
| **D-4** | `GET /quotes/:id`: serve `DAIF` / `UNGRADED` with grade badge; `MAWDU` → 404. | `3485c49` (with P0-2) |
| **D-5** | Apply only the P0-4 seed rows the owner ticks below. | — |
| **P1-2 seed** | Default `seed` = date-only bucket (`yyyy-mm-dd`). No IP hashing. Frontend may send its own seed. | `d6d6d84` |

### P0-4 seed rows — owner ticks before applying

- [ ] Q11 → new `Sunan Abi Dawud` source, grade `DAIF`
- [ ] Q16 → new `Musnad Ahmad` source, grade `HASAN`
- [ ] Q14, Q15 → grade `SAHIH`
- [ ] Q17 → re-attribute to ʿAlī ibn Abī Ṭālib (or replace)
- [ ] Q18 → replace with a verifiable scholar quote (or model as weak `HADITH`)
- [ ] Q19, Q20 → verified as-is

---

## §8 checklist (IDs → commits)

### P0

| ID | Status | Commit |
| --- | --- | --- |
| P0-1 | fixed | `292e889` |
| P0-2 | fixed | `3485c49` |
| P0-3 | fixed | `8355517` |
| P0-4 | **not fixed** — blocked on D-5 ticks | — |

### P1

| ID | Status | Commit |
| --- | --- | --- |
| P1-1 | fixed | `40ce918` |
| P1-2 | fixed | `d6d6d84` |
| P1-3 | fixed | `662e6a4` (with P1-6) |
| P1-4 | fixed | `94583ae` |
| P1-5 | fixed | `dd2a397` |
| P1-6 | fixed | `662e6a4` |
| P1-7 | fixed | `4562a47` |
| P1-8 | fixed | `321a693` |
| P1-9 | fixed | infra `60ed115` · coverage `c66a670` |
| P1-10 | fixed | `52b01a4` |

### P2

| ID | Status | Commit / note |
| --- | --- | --- |
| P2-1 | **partial** | `shuffleLinksPage` shared (`d6d6d84`); full where-builder extract still open |
| P2-2 | fixed | `3748a13` |
| P2-3 | fixed | `acf1648` |
| P2-4 | **partial** | service-level quote-shape checks; `@ValidQuoteShape` decorator not added |
| P2-5 | fixed | `fad342c` |
| P2-6 | superseded by D-2 | removed in `3748a13`, restored via `a2cad1d` |
| P2-7…P2-10 | fixed | `fad342c` |
| P2-11…P2-13, P2-16 | fixed | `4767b07` |
| P2-14, P2-15 | fixed | `c18c5dc` |
| P2-17 | fixed | `6fb761e` (D-3) |

### P3

Deferred (cheap polish in main review §3 P3) — second session.

---

## E2E coverage (§4 endpoints)

| Spec | Endpoints |
| --- | --- |
| `test/sins.e2e-spec.ts` | #1–#4 |
| `test/good-deeds.e2e-spec.ts` | #5–#7 |
| `test/quotes.e2e-spec.ts` | #8–#9 (+ admin quotes smoke) |
| `test/quran.e2e-spec.ts` | #10–#12 |
| `test/hadith.e2e-spec.ts` | #13–#14 |
| `test/tags.e2e-spec.ts` | #15–#16 |
| `test/sources.e2e-spec.ts` | #17–#18 |
| `test/admin-content.e2e-spec.ts` | #28–#47 |
| `test/admin-classification.e2e-spec.ts` | #48–#57 |
| `test/health.e2e-spec.ts` / `app.e2e-spec.ts` / `errors.e2e-spec.ts` | #61 + envelope / codes |
| `test/raw-payload.e2e-spec.ts` | public GET sweep — no `rawPayload` |

---

## Still open

1. **P0-4 / D-5** — tick the seed rows above, then apply only those corrections (idempotent seed, re-run twice).
2. **P2-1** — finish extracting shared link-quote query builders into `QuotesService`.
3. **P2-4** — add `@ValidQuoteShape()` class-level validator → 400 (replace remaining service 422 shape throws where the plan requires it).
4. **P3** — polish items from the main review (appliedFilters echo, tag chip order, `setCreated` helper, etc.).
5. **§6 Deferred** — still out of scope: git remote / CI / Dockerfile / staging, auth, content-sync.

---

## Historical prompt (course correction — completed)

The original course-correction prompt (skip P0-3 commit → do P1-9 infra first → backfill e2e → resume §7 → apply D-*) has been executed. Kept for history:

```
1. P1-9 e2e infrastructure first (committed 60ed115).
2. Backfill / full controller e2e (committed c66a670).
3. Resume remaining §7 findings with e2e where practical.
4. Apply D-1, D-2, D-3, D-4; P1-2 date-only seed; D-5 waits on ticks.
5. Report §8 table (above).
```
