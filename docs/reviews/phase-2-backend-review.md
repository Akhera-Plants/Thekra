# Phase 2 Backend — Intensive Review & Fix Plan

> Reviewed at commit `43382e6` (`fix(quotes): derive QuoteRowForDto from Prisma include`), on top of the 13
> Phase 2 commits. Every 🔴/🟠 finding below was **reproduced against the running API** (`localhost:3001`,
> seeded DB) unless marked *(code reading)*.
> Sources of truth checked: `docs/plan/roadmap.md` (Phase 2), `docs/plan/backend-plan.md` §0–§12,
> `docs/plan/content-pipeline-plan.md` §5, `backend/.cursorrules` (Product-Safety Rules), `docs/plan/frontend-plan.md`
> (the contract Phase 3 consumes).

---

## 0. Prompt to paste into Cursor (`backend/` window)

```
You are fixing the Thekra backend after a Phase 2 review. This is a real product built to production quality.

Before writing any code:
1. Re-read `.cursorrules` in this folder (it governs HOW you write code, and its Product-Safety Rules are
   correctness guarantees).
2. Read `../docs/reviews/phase-2-backend-review.md` IN FULL. It is the task list for this session. Every
   finding has an ID (P0-1, P1-3, …), the evidence, the required fix, and an acceptance test.
3. Re-read the plan sections each finding cites in `../docs/plan/backend-plan.md` before fixing it.
4. Tell me in 2–3 sentences which findings you will do first and confirm you will follow §7 "Execution order".

Rules for this session:
- Fix findings strictly in the order of §7. One finding (or one tightly-coupled group named in §7) per commit,
  Conventional Commit message that references the ID, e.g. `fix(common): parse boolean query params correctly (P0-1)`.
- Every fix ships with the acceptance test(s) listed for it. Where the finding says "e2e", write a real e2e
  test against Postgres (see P1-9) — a mocked-Prisma unit test that only asserts the `where` object shape is
  NOT sufficient, because that is exactly how these bugs got through 52 green unit tests.
- After each commit: `pnpm --filter backend lint`, `pnpm --filter backend exec tsc --noEmit -p tsconfig.json`,
  `pnpm --filter backend test`, `pnpm --filter backend test:e2e`, and `pnpm --filter backend exec prisma
  validate`. Do not move on while any is red.
- Do NOT change `prisma/schema.prisma` models. Findings that would need a model change are listed in §5
  "Decisions for the owner" — STOP and ask me about those; do not implement them on your own.
  Raw-SQL migrations that only add a SQL function or an index (P0-3) are allowed — they don't touch models.
- Do not add a dependency that is not already installed without asking me.
- Items in §6 "Deferred" are out of scope for this session — do not start them.
- When finished, report back with the §8 checklist: every ID → fixed / not fixed, the commit hash, and the exact
  command + actual output that proves the acceptance test passes. No "should work".
```

---

## 1. Verdict

**Phase 2 is NOT done.** The happy-path walkthrough in the completion report passes, but the review found
**4 product-safety violations** (weak/fabricated-hadith leaks — the one guarantee the roadmap says "outranks
every feature"), **broken Arabic search on every endpoint that has `q`**, **two admin endpoints that can never
succeed**, a **core feature (`shuffle`) that is accepted but silently ignored**, and an **e2e suite that covers
0 of the 49 Phase 2 business endpoints** (the roadmap's standing rule is "a new endpoint ships with a service
unit test and a controller e2e test").

Several claims in the completion report were inaccurate:

| Report said | Reality |
| --- | --- |
| "`shuffle` variety mode is wired in the DTO but not deeply exercised" | It is **not implemented at all**. `shuffle`/`seed` are never read by any service; `?shuffle=true&seed=a` and `seed=b` return the identical order. |
| "Errors match `{ error: { code … } }`" | Shape yes, but codes/statuses diverge from §2.5/§3: `grades=MAWDU` → `400 VALIDATION_FAILED` (plan: `422 GRADE_NOT_PERMITTED`); `PATCH {"name":null}` → `500`; oversized body → `500` (should be `413`); validation `details` is `string[]` (plan: `[{ field, constraint, message }]`). |
| "Unit coverage is in place" | Unit tests mock Prisma and assert the shape of the `where` object, so none of P0-1…P0-4 is caught. E2E covers only `/health` and the scaffold `GET /v1`. |
| CI green on a PR — "Deferred (agreed)" | Correctly reported as deferred — see §6. |

---

## 2. Live evidence (reproduce with these commands)

```bash
B=localhost:3001
# P0-1  "false" is parsed as true → weak hadith served when the client explicitly says not to
curl -s "$B/v1/sins/ghibah/quotes?includeWeak=false" | jq .meta.appliedGrades
#   → ["SAHIH","HASAN","DAIF","UNGRADED"]          (expected ["SAHIH","HASAN"])
curl -s "$B/v1/hadith?includeWeak=false" | jq .meta.appliedGrades          # same leak
curl -s "$B/v1/sources?isExternalApi=false" | jq '[.data[].isExternalApi]' # → [true]
curl -s "$B/v1/quotes/00000000-0000-4000-8000-000000000008?includeLinks=false" | jq '.data|has("relatedSins")'  # → true
curl -s "$B/v1/admin/sin-quotes?hasNote=false" | jq .meta.total           # → 24 (all links have notes)

# P0-2  /quotes has no grade policy at all
curl -s "$B/v1/quotes?type=HADITH&limit=50" | jq '[.data[].hadith.grade]'  # → includes "DAIF"
curl -s -o /dev/null -w "%{http_code}\n" "$B/v1/quotes?grades=MAWDU"       # → 200 (must be 422)

# P0-3  Arabic search finds nothing, even the exact name
curl -s "$B/v1/sins?q=الغيبة" | jq .meta.total     # → 0   (seed has sin nameAr "الغيبة")
curl -s "$B/v1/sins?q=الغيبه" | jq .meta.total     # → 0
curl -s "$B/v1/quotes?q=يغتب" | jq .meta.total      # → 0   (Q01 contains "يَغْتَب")

# P1-1  translations admin endpoints can never succeed
curl -s -X PUT  -H 'content-type: application/json' -d '{"text":"x"}' \
  "$B/v1/admin/quotes/00000000-0000-4000-8000-000000000008/translations/fr" | jq .error.details
#   → ["property text should not exist"]   (400 on every request)

# P1-2  shuffle ignored
for s in a b; do curl -s "$B/v1/sins/ghibah/quotes?shuffle=true&seed=$s" | jq -c '[.data.items[].link.relevanceScore]'; done
#   → identical arrays

# P1-4  null in PATCH body → 500
curl -s -X PATCH -H 'content-type: application/json' -d '{"name":null}' "$B/v1/admin/sins/<id>" | jq .error.code  # → INTERNAL_ERROR

# P1-5  oversized body → 500
head -c 200000 /dev/zero | tr '\0' a | sed 's/^/{"note":"/;s/$/"}/' | \
  curl -s -X POST -H 'content-type: application/json' --data-binary @- "$B/v1/admin/sin-quotes" | jq .error.code  # → INTERNAL_ERROR
```

---

## 3. Findings

Severity: 🔴 **P0** = product-safety / core-loop correctness, must fix before Phase 3 · 🟠 **P1** = plan
contract broken or feature missing, must fix before Phase 3 · 🟡 **P2** = plan deviation / robustness, fix in
this pass · ⚪ **P3** = polish, fix if cheap.

### 🔴 P0 — Product safety & core loop

#### P0-1 Boolean query params: the string `"false"` becomes `true`
- **Where:** every `@Type(() => Boolean)` — `sins/dto/sin-quotes-query.dto.ts:42,54` (`includeWeak`, `shuffle`),
  `hadith/dto/hadith-query.dto.ts:37`, `quotes/dto/quote-detail-query.dto.ts:10,15`,
  `quotes/dto/admin-quotes-query.dto.ts:8`, `quran/dto/ayah-detail-query.dto.ts:7`,
  `sources/dto/sources-query.dto.ts:29` (its custom `@Transform` is defeated by the `@Type` next to it),
  `classification/dto/{sin,good-deed}-quotes-admin-query.dto.ts:37`, `sins/sins.admin.controller.ts:23` (`force`).
- **Why it's P0:** `Boolean("false") === true`. A client that sends `includeWeak=false` — exactly what a
  frontend toggle does — gets `DAIF` + `UNGRADED` narrations in the reminder flow. `?force=false` on
  `DELETE /admin/sins/:id` **deletes a sin together with all its curation links**, defeating the
  `SIN_HAS_LINKS` misclick guard (§3.10) *(code reading — same mechanism as the five params reproduced live
  in §2; not executed to avoid destroying seed curation)*.
- **Fix:** add one shared decorator `common/decorators/to-boolean.decorator.ts` → `@ToBoolean()` that reads the
  **raw** value (`({ obj, key }) => obj[key]`, because `enableImplicitConversion` has already coerced `value`)
  and maps `true|'true'|'1'` → `true`, `false|'false'|'0'` → `false`, `undefined|''` → `undefined`, anything
  else → leave the raw value so `@IsBoolean()` rejects it with `400`. Replace **every** `@Type(() => Boolean)`
  and the custom transform in `sources-query.dto.ts` with it. Grep afterwards: `grep -rn "Type(() => Boolean)" src`
  must return nothing.
- **Acceptance:** unit spec for the decorator (all the cases above, plus `'yes'` → 400). E2E:
  `includeWeak=false` → `appliedGrades == ["SAHIH","HASAN"]` on `/sins/:slug/quotes`, `/good-deeds/:slug/quotes`,
  `/hadith`; `isExternalApi=false` returns only non-external sources; `includeLinks=false` omits `relatedSins`;
  `DELETE /admin/sins/:id?force=false` on a linked sin → `409 SIN_HAS_LINKS`.

#### P0-2 `GET /v1/quotes` and `GET /v1/quotes/:id` bypass the grade policy
- **Where:** `quotes/quotes.service.ts:433` `buildSearchWhere` (grade filter only applied when `grades` is
  sent; no default; no MAWDU rejection); `quotes/dto/quotes-query.dto.ts` (`grades` has no `@NotMawdu()`, no
  `includeWeak`); `findById` (`quotes.service.ts:137`) returns any grade.
- **Rule broken:** `.cursorrules` Product-Safety #1: "`GradePolicy` must gate **every** code path that can
  return a `HADITH`-type quote"; roadmap cross-cutting "Content integrity".
- **Fix:**
  1. `QuotesQueryDto`: add `includeWeak` (`@ToBoolean()`), add `@NotMawdu()` to `grades`.
  2. Public `search()`: always resolve `GradePolicy.resolveAllowedGrades({ grades, includeWeak })` and apply the
     `OR: [{ type: { not: HADITH } }, { grade: { in: allowed } }]` clause (default `SAHIH,HASAN`); echo
     `meta.appliedGrades`.
  3. Admin `adminSearch()` must **not** inherit that default (curators must see every grade, incl. `MAWDU`, to
     fix data). Split the where-builder: `buildSearchWhere(query, { applyGradePolicy: boolean })` or give
     `AdminQuotesQueryDto` its own grade handling — do not let the admin DTO silently get the public default.
  4. `findById`: if the row is `HADITH` with `grade === MAWDU` → `404 RESOURCE_NOT_FOUND` (never serve a
     fabricated narration, don't confirm it exists). `DAIF`/`UNGRADED` detail stays reachable (it carries its
     grade badge) — note this choice in a code comment.
  5. Also apply the policy to `tags`'s `quoteCount` only if trivial; otherwise leave counts as-is (P3).
- **Acceptance (e2e, seed-independent fixture incl. one `MAWDU` and one `UNGRADED` hadith — test fixtures only,
  never the dev seed):** `/v1/quotes` default never contains `DAIF|MAWDU|UNGRADED|null-grade hadith` and still
  contains `QURAN_VERSE`; `?includeWeak=true` adds `DAIF`+`UNGRADED` but never `MAWDU`; `?grades=MAWDU` → `422
  GRADE_NOT_PERMITTED` (see P1-3); `GET /v1/quotes/<mawdu-id>` → 404; `GET /v1/admin/quotes` still lists the
  `MAWDU` row.

#### P0-3 Arabic search is broken everywhere (`q` on sins, good-deeds, tags, quotes, hadith, `narrator`)
- **Where:** `sins.service.ts:67-73`, `good-deeds.service.ts:74-80`, `tags.service.ts:124-132`,
  `quotes.service.ts:477+`, `hadith.service.ts` (`q`, `narrator`).
- **Root cause:** only the **query** is normalised; the stored text is not. `normalizeArabic` folds `ة→ه`, so
  `"الغيبة"` becomes `"الغيبه"` and can no longer match the stored `"الغيبة"`. Stored Quran/hadith text carries
  full tashkeel (`يَغْتَب`), so an undiacritised query never matches it either. Plan §4.4 explicitly requires
  "Query **and candidate text** are normalised the same way". Live: `?q=الغيبة` → 0 results for a sin whose
  `nameAr` is literally `الغيبة`.
- **Fix (no model change):**
  1. New raw-SQL migration (`prisma migrate dev --create-only --name add_arabic_normalize_fn`, then hand-edit)
     that creates an `IMMUTABLE` SQL function, e.g. `thekra_normalize_ar(text) RETURNS text`, implementing
     **exactly** the same rules as `common/text/arabic-normalizer.ts`: strip `U+064B–U+0652`, `U+0670`,
     `U+06D6–U+06ED`, tatweel `U+0640`; fold `أ إ آ ٱ → ا`, `ى → ي`, `ة → ه`. **Add `ٱ` (U+0671, alef wasla)** to
     both the SQL and the TS normaliser — Uthmani Quran text from quran.com (Phase 5) uses it everywhere.
  2. Match with raw SQL via `Prisma.sql` (parameterised — never string-concatenate user input), e.g.
     `SELECT id FROM "Quote" WHERE thekra_normalize_ar("textAr") ILIKE '%' || $1 || '%'`, then feed the ids into
     the existing Prisma `findMany`/`count` (`id: { in: ids }`) so the shared `QuoteDto` include path stays
     untouched. Same helper for `Sin.nameAr`, `GoodDeed.nameAr`, `Tag.nameAr`, `Quote.narratorAr`.
     Put the helper in **one** place (e.g. a small `ArabicSearchService` in `common/` or a method on
     `PrismaService`'s consumers — follow `.cursorrules` "Use what already exists first").
  3. Escape `%`, `_` and `\` in the user query before the `ILIKE` (otherwise `q=%` matches everything).
  4. The Latin fields (`name`, `narrator`, translation text) keep `contains` + `insensitive`.
  5. Leave a comment pointing at backend-plan §4.4: the Phase 5 trigram GIN index will be an **expression
     index on `thekra_normalize_ar("textAr")`**, which this function makes possible.
- **Acceptance:** unit: TS normaliser handles `ٱ`; a parity test that runs a fixed list of strings through the
  TS function and through `SELECT thekra_normalize_ar($1)` (e2e/DB) and asserts equality. E2E:
  `GET /v1/sins?q=الغيبة` and `?q=الغيبه` both return `ghibah`; `GET /v1/quotes?q=يغتب` returns Q01;
  `GET /v1/quotes?q=%` does not return everything; `GET /v1/tags?q=الحسد` returns `envy`.

#### P0-4 Seed content: wrong attributions and wrong hadith grades
Seed data is dev scaffolding, but it is the content the Phase 3 UI will be built and demoed on, and a wrong
grade in a `Sahih al-Bukhari` card is exactly the misrepresentation the grade policy exists to prevent.
- **Where:** `prisma/seed.ts` (`seedQuotes`)
  | Quote | Problem | Fix |
  | --- | --- | --- |
  | `Q11` "إياكم والحسد فإن الحسد يأكل الحسنات…" — `Abu Dawud 4903` | `sourceId: SRC_BUKHARI` and `grade: SAHIH`. It is **not in Bukhari**, and it is commonly graded **ḍaʿīf** (al-Albānī). | Add a `Sunan Abi Dawud` source; grade `DAIF`. (It will then correctly drop out of the default reminder flow.) |
  | `Q16` "إن أخوف ما أخاف عليكم الشرك الأصغر…" — `Ahmad 5/428` | `sourceId: SRC_BUKHARI` (it is in Musnad Aḥmad, not Bukhari) and graded `DAIF` (it is generally graded ḥasan/ṣaḥīḥ). | Add a `Musnad Ahmad` source; grade `HASAN`; keep it low-scored. |
  | `Q14` truthfulness — `Bukhari 6094`, `Q15` silat ar-rahim — `Bukhari 5986` | Graded `HASAN`; narrations in Ṣaḥīḥ al-Bukhārī are `SAHIH`. | `SAHIH`. |
  | `Q17` "اللسان سبع إن أطلق أكل" | Attributed to Ibn al-Qayyim; it is commonly attributed to ʿAlī ibn Abī Ṭālib. | Verify; if unverifiable, re-attribute or replace with a verifiable Ibn al-Qayyim quote. |
  | `Q18` "الغضب جمرة…" | Presented as an Ibn al-Qayyim `SCHOLAR_QUOTE`; the wording is that of a (weak) prophetic narration (Tirmidhi). | Replace with a verifiable scholar quote, or model it as a `HADITH` with the correct grade. |
  | `Q19`, `Q20` | Book excerpts with `pageOrChapter` — not verifiable from the seed. | Owner to verify (§5). |
- The seed must still satisfy content-pipeline-plan §5.2 after the change: 8 hadith with grade spread including
  at least one `DAIF`, no `MAWDU`, ghibah ≥10 visible items by default. Re-check `ghibah` visible count after
  the regrade (Q11 drops out, Q16 comes in — still 11).
- Add the new sources with fixed UUIDs (`10000000-…-000000000006/7`), keep idempotency.
- **Acceptance:** `pnpm db:seed` twice → same counts; `GET /v1/sins/ghibah/quotes` total ≥10; no hadith from
  outside Bukhari is attached to the Bukhari source (assert in an e2e that every `HADITH` whose `reference`
  starts with "Bukhari" has the Bukhari source and vice-versa).
- ⚠️ Islamic-content accuracy must be confirmed by the owner (§5, D-5) — Cursor must not invent references.

### 🟠 P1 — Plan contract broken / feature missing

#### P1-1 `PUT /admin/quotes/:id/translations/:languageCode` and `POST /admin/quotes/:id/translations` always 400
- **Where:** `quotes/quotes.admin.controller.ts:27-34` — `SetTranslationDto` / `CreateTranslationDto` have **no
  class-validator decorators**, so with `whitelist + forbidNonWhitelisted` every property is rejected
  ("property text should not exist"). Endpoints #32/#33 have never worked.
- **Fix:** move them to `quotes/dto/set-translation.dto.ts` and `quotes/dto/create-translation.dto.ts` (one DTO
  per file, §5 rule 1). `text`: `@IsString() @MinLength(1) @MaxLength(10000)`; `languageCode`: reuse the
  `TranslationInputDto` regex (better: `CreateTranslationDto` *is* `TranslationInputDto` — reuse it). Validate
  the `:languageCode` **path** param with the same regex (a small pipe or a params DTO) — and reject `ar`
  (Arabic is `textAr`, never a translation row). `POST` must set `Location`. Map responses to
  `{ languageCode, text }` (+ `id`) instead of returning the raw Prisma row.
- **Acceptance (e2e):** PUT creates (200) then updates (200); POST creates (201 + `Location`), POST same code →
  `409`; DELETE → 204 then 404; `languageCode=ar` → 400; bad code `EN` → 400; unknown quote → 404.

#### P1-2 `shuffle` / `seed` variety mode is not implemented (§4.2) — and Phase 3 depends on it
- **Where:** `sins.service.ts` `findQuotesForSin`, `good-deeds.service.ts` `findQuotesForGoodDeed`. The DTO
  accepts the params; nothing reads them. Frontend-plan §2/§6 builds "another reminder" on `shuffle` + a stable
  `varietySeed`.
- **Fix (exactly §4.2):** when `shuffle=true`: rows with `relevanceScore >= VARIETY_SCORE_FLOOR` (env/config,
  default `70`, validated in `env.validation.ts`) ordered by `md5(link.id || seed)`, then the remainder in the
  normal `LINK_ORDER`. Same grade/type/minScore filters. Implement with `$queryRaw` (parameterised) returning
  ordered link ids for the requested page, then load those rows through the existing Prisma include and
  re-order in memory by the id list. `seed` default: daily bucket — Phase 2 has no user, so
  `sha256(ip + yyyy-mm-dd)` truncated; never log/echo the raw IP. Echo `meta.ordering = "variety:md5(seed),floor=70"`
  and `meta.seed`. Must be deterministic → offset pagination coherent. **One shared implementation** for sins and
  good deeds (see P2-1).
- **Acceptance (e2e):** same seed → identical order on two calls; seeds `a` vs `b` → different order within the
  ≥70 band (fixture with ≥4 rows ≥70); page 1 + page 2 with the same seed have no overlap and their union equals
  the full filtered set; everything below the floor stays after the band in normal order; `shuffle=false` is
  unchanged.

#### P1-3 `grades=MAWDU` returns `400 VALIDATION_FAILED`; plan requires `422 GRADE_NOT_PERMITTED`
- **Where:** `@NotMawdu()` (`hadith/grade-policy.ts:75`) fires inside `ValidationPipe` → generic 400; the
  service-level `assertRenderableList` (which throws the right 422) is unreachable. Plan §3.2 #3, §3.6 #13.
- **Fix:** keep the DTO guard (defence in depth, §4.3) but make it produce the contract: either give the
  validator a recognisable constraint name (`notMawdu`) and have the `ValidationPipe` `exceptionFactory` (P1-6)
  map any error containing that constraint to `422 { code: 'GRADE_NOT_PERMITTED' }`, or throw it directly from a
  dedicated pipe. Apply to `/sins/:slug/quotes`, `/good-deeds/:slug/quotes`, `/hadith`, `/quotes` (P0-2).
- **Acceptance (e2e):** each of the four endpoints with `grades=MAWDU` and `grades=SAHIH,MAWDU` → `422`,
  `error.code === "GRADE_NOT_PERMITTED"`.

#### P1-4 `null` in any optional body field reaches Prisma → `500`
- **Where:** all `Update*Dto` built with `PartialType` (`@IsOptional()` lets `null` through) — sins, good-deeds,
  sources, tags, quotes. Live: `PATCH /admin/sins/:id {"name":null}` → `500 INTERNAL_ERROR`. Also lets an admin
  null out `Quote.grade` on a `HADITH` via PATCH.
- **Fix:** for required columns use `@ValidateIf((_, v) => v !== undefined)` (or a shared `@IsOptionalNotNull()`
  decorator in `common/decorators/`) so `null` → `400`. Keep `null` allowed **only** where clearing is a
  feature (`note`, `oppositeSinId`, nullable descriptive fields) and say so in the DTO. Also add the
  cross-field rule to `PATCH /admin/quotes/:id`: after merge with the existing row, a `HADITH` must keep a
  non-null `grade`, a `QURAN_VERSE` must keep `surahNumber` (reuse the P2-4 validator).
- **Acceptance (e2e):** `PATCH` with `null` for `name`, `nameAr`, `slug`, `textAr`, `sourceId`, `type`-required
  fields → `400 VALIDATION_FAILED`; `PATCH /admin/good-deeds/:id {"oppositeSinId":null}` → 200 and clears it;
  `PATCH /admin/sin-quotes/:id {"note":null}` → 200 and clears it.

#### P1-5 Non-HTTP errors from the body parser become `500`
- **Where:** `common/filters/all-exceptions.filter.ts:65-112` — anything that isn't an `HttpException` or a
  Prisma known error is `500`. Express/body-parser errors (`PayloadTooLargeError` 413, `entity.parse.failed`
  400, unsupported charset 415) carry `status`/`statusCode`; Nest's base filter honours them, ours does not.
  Live: 200 KB JSON body → `500`.
- **Fix:** in `normalize()`, before the generic branch: if the error has a numeric `status`/`statusCode` in
  `400–499` and `expose === true` (http-errors convention), return that status with a code
  (`413 → PAYLOAD_TOO_LARGE`, `400 → VALIDATION_FAILED`/`MALFORMED_JSON`, `415 → UNSUPPORTED_MEDIA_TYPE`) and a
  **generic** message (don't echo the parser's message, which can include body fragments). Also map
  `Prisma.PrismaClientValidationError` to `400 VALIDATION_FAILED` with a generic message (it is always a request
  that slipped past the DTO) and log it at `warn`.
- **Acceptance:** filter unit tests for 413/400/415 http-errors and `PrismaClientValidationError`; e2e: oversized
  body → `413 PAYLOAD_TOO_LARGE`; `{bad` → `400` with no parser text in `message`.

#### P1-6 Validation `details` shape doesn't match §2.5
- **Where:** `configure-app.ts:12-19` (no `exceptionFactory`) → `details` is `["sinId must be a UUID", …]`.
  Plan §2.5 and the frontend `ApiError` (frontend-plan §6) expect
  `details: [{ field, constraint, message }]`.
- **Fix:** `ValidationPipe({ …, exceptionFactory })` that flattens nested `ValidationError`s (dotted paths for
  nested DTOs, e.g. `links.3.relevanceScore`) into that shape and throws `BadRequestException({ code:
  'VALIDATION_FAILED', message: 'Request validation failed', details })`. This is also where P1-3's MAWDU
  mapping lives. Update `AllExceptionsFilter` tests.
- **Acceptance:** e2e: `POST /v1/admin/sin-quotes {"sinId":"x","relevanceScore":101}` →
  `details` contains `{ field: "sinId", constraint: "isUuid" }` and `{ field: "relevanceScore", constraint: "max" }`;
  bulk with a bad nested item → `field: "links.0.quoteId"`.

#### P1-7 `POST /admin/sin-quotes/bulk` (and good-deed) is not a transaction and leaks internal errors
- **Where:** `classification.service.ts:113-170` and `250-307`.
  - Plan §3.11 #52: "Runs **one `prisma.$transaction`** of upserts". Current code: sequential, non-transactional,
    3 queries per item (≤300 round trips), and a crash mid-loop leaves a half-applied batch.
  - `reason: err.message` returns raw Prisma error text to the client — violates §2.5 "never leak a Prisma message".
  - `skipped` is hard-coded `0`; duplicate `quoteId`s inside one payload are counted as created + updated.
- **Fix:** validate first, in bulk: one `quote.findMany({ where: { id: { in: ids } } })`, one
  `sinQuote.findMany` for existing pairs; classify each item into `failed` (`RELATED_RESOURCE_INVALID`,
  `GRADE_NOT_PERMITTED` — use stable codes only), `skipped` (duplicate `quoteId` within the payload — keep the
  first), or to-write. Then run all upserts in **one** `$transaction([...])`. If the transaction throws, the
  whole call fails with the filter's normal error (nothing half-written). Response
  `{ created, updated, skipped, failed: [{ quoteId, reason }] }`. Add `@ArrayMinSize(1)` and
  `@ArrayUnique(o => o.quoteId)`-or-skip semantics (pick skip, as above, and document it).
- **Acceptance:** unit: duplicate ids → `skipped`; unknown id → `failed` with code, not message; a forced
  transaction failure writes nothing. E2E: 3 valid + 1 unknown + 1 duplicate → `{created:3, skipped:1, failed:1}`,
  re-post → `{updated:3,…}`.

#### P1-8 Sin/GoodDeed detail & minor contract gaps in the core endpoints *(code reading)*
- `GET /sins/:slug` returns `relatedGoodDeeds` **capped at 3** (`sins.service.ts:113` calls
  `findByOppositeSinId(row.id)` whose default `take` is 3). Plan §3.2 #2 returns all of them (the cap of 3 is only
  for `alternatives` in #3). Pass no cap for detail.
- `findQuotesForSin` builds the alternatives query inline (`sins.service.ts:168-180`) instead of calling
  `GoodDeedsService.findByOppositeSinId(…, 3)` / `findAlternatives`, which exists and is unused — reuse it
  (`.cursorrules` "Use what already exists").
- `GET /sins/:slug`, `GET /good-deeds/:slug` don't accept `lang` (plan §3.2 #2, §3.3 #6). Add a
  `LocaleQueryDto` query param so the contract is uniform (even if Arabic/English fields are both returned).
- `sort=severity` on `/sins` uses `{ severity: 'desc' }` → in Postgres `NULL`s sort **first** on `DESC`. Use
  `{ severity: { sort: 'desc', nulls: 'last' } }`.
- **Acceptance:** e2e: a sin with 4 opposite deeds → detail returns 4, `/quotes` alternatives returns 3.

#### P1-9 E2E suite: 0 of 49 Phase 2 business endpoints covered
- **Where:** `backend/test/` has only `app.e2e-spec.ts` (asserts the leftover `Hello World!`) and
  `health.e2e-spec.ts`. Plan §11.2 requires one spec per controller against a real Postgres (`thekra_test`),
  reset per file, with a `seedTestFixtures()` helper; roadmap standing rule: "A new endpoint ships with a service
  unit test and a controller e2e test in the same PR".
- **Fix:**
  1. `.env.test` (+ `.env.test.example` committed) with `DATABASE_URL=…/thekra_test`; `vitest.config.e2e.ts`
     loads it and runs files serially (`fileParallelism: false`) since they share one DB.
  2. `test/helpers/test-app.ts` (build app + `configureApp`), `test/helpers/reset-db.ts`
     (`prisma migrate reset --force --skip-seed` once per run, `TRUNCATE … CASCADE` per file is faster), and
     `test/fixtures/seed-test-fixtures.ts` reusing the exported seed functions where possible, **plus** test-only
     rows the dev seed must not contain: one `MAWDU` hadith, one `UNGRADED` hadith, one `HADITH` with `grade = null`,
     one sin with 4 opposite good deeds, ≥4 links ≥70 for shuffle.
  3. Specs: `sins`, `good-deeds`, `quotes`, `quran`, `hadith`, `tags`, `sources`, `admin-content` (quotes,
     translations, tags, sins, good-deeds, sources CRUD), `admin-classification`, `errors` (envelope + codes),
     `health`.
  4. Assertions §11.2 insists on: envelope on every 200 (`data`, plus `meta` on collections); `/v1` prefix enforced
     (`/sins` → 404, `/health` unprefixed); exact `error.code` strings; `GET /sins/:slug/quotes` items in
     descending `relevanceScore` with nulls last; `rawPayload` never in **any** response body (iterate every public
     endpoint once with `lang=en`).
  5. Every acceptance test listed in this document goes here.
- **Acceptance:** `pnpm --filter backend test:e2e` green, covering every endpoint #1–#18, #28–#57, #61.

#### P1-10 Leftover scaffold route `GET /v1` → `"Hello World!"`
- **Where:** `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `test/app.e2e-spec.ts`. Plan
  §11.2 said "update or delete that spec in the same commit that adds the prefix". It's a public, undocumented
  route in a versioned API.
- **Fix:** delete the controller/service/spec; replace `app.e2e-spec.ts` with a bootstrap test that asserts
  `GET /v1` → `404 RESOURCE_NOT_FOUND` in the error envelope and that `GET /health` works without the prefix.

### 🟡 P2 — Plan deviations & robustness

| ID | Where | Problem | Fix |
| --- | --- | --- | --- |
| **P2-1** | `sins.service.ts` `findQuotesForSin` vs `good-deeds.service.ts` `findQuotesForGoodDeed` | ~90 duplicated lines (where builder, grade clause, countsByType, ORDERING constant). Plan §4.1 "must be near-identical", `.cursorrules` "consolidate". Divergence risk is real: P1-2 must be implemented once. | Extract the shared pieces into `QuotesService` (e.g. `buildLinkQuoteFilter(query)` returning the `quote` where + `allowedGrades`, `countsByTypeFromGroups()`, `LINK_ORDERING_LABEL`) and the shuffle helper. Sins/good-deeds keep only the intent-specific bits. |
| **P2-2** | `classification.service.ts` (whole file) | Sin and good-deed sides are copy-pasted (link, list, update, unlink, bulk, where-builders). Plan §3.11: "Shared implementation via a small generic … one code path, two entity bindings, so the two sides cannot drift." | One private generic implementation parameterised by a binding object `{ delegate, parentKey: 'sinId'|'goodDeedId', compoundKey, include, assertParent }`. Public method names stay as the plan lists them. Do this after P1-7 so the bulk fix is written once. |
| **P2-3** | All list endpoints: `quotes.service.ts:109,230` (`createdAt` only), `sins` (`name`), `good-deeds` (`name`), `sources` (`name`), `quran` (`ayahNumber` only), `classification` `sort=score` | No total order → offset pagination can duplicate/skip rows when the sort key ties (plan §3.2 adds `{ id: 'asc' }` for exactly this). Quran: two providers caching the same ayah tie on `ayahNumber`. | Append `{ id: 'asc' }` as the final `orderBy` key everywhere a list is paginated. `relevanceScore` sorts in admin lists must also use `nulls: 'last'`. |
| **P2-4** | `quotes.service.ts:246-275` | Cross-field rules (`HADITH` ⇒ `grade`, `QURAN_VERSE` ⇒ `surahNumber`) throw **422** with code `VALIDATION_FAILED`. Plan §5.1: a class-level `@ValidQuoteShape()` validator → **400** naming the field. Also: kind-specific fields on the wrong type are accepted (e.g. `narrator` on a verse, `ayahNumber` without `surahNumber`). | Implement `@ValidQuoteShape()` in `quotes/dto/` (class-level `registerDecorator`), used by `CreateQuoteDto`; reuse its pure check in `adminUpdate` after merging with the existing row (P1-4). Reject fields from another kind with a clear message. |
| **P2-5** | `quotes.service.ts` `setQuoteTags` (#35) | Duplicate ids in `tagIds` → misleading `422` ("not found") then P2002; the follow-up read is outside the transaction. | `@ArrayUnique()` on `tagIds`; do delete + `createMany` + final read in one interactive `$transaction`. |
| **P2-6** | `classification` `GET /admin/sin-quotes?sort=newest` (`:71`, `:208`) | Orders by `id desc` — ids are random UUIDv4, so "newest" is a random order. `SinQuote`/`GoodDeedQuote` have no `createdAt`. | Until the owner decides (§5 D-2): remove `newest` from the `@IsIn` list and default to `score` (with `nulls: 'last'`, then `id`). Do not add a column without approval. |
| **P2-7** | `quran.service.ts` `listSurahs` | `groupBy` includes `surahName`/`surahNameAr`; once two providers spell a surah name differently (Phase 5), the same surah appears twice. | Group by `surahNumber` only, then pick names with a second query (`distinct: ['surahNumber']`, preferred provider first). |
| **P2-8** | `quran.service.ts` `findAyah` | Reads `process.env.QURAN_PREFERRED_PROVIDER` directly; the variable is not in `EnvironmentVariables` or `.env.example`. | Add it to `env.validation.ts` (optional string) and `.env.example`; inject via `ConfigService`. Same for `VARIETY_SCORE_FLOOR` (P1-2). |
| **P2-9** | `quran` DTOs | `fromAyah > toAyah` accepted (returns 404 "nothing ingested", which is a lie). `fromAyah`/`toAyah` have no `@Max(286)`. | Cross-field check → 400; add `@Max(286)`. |
| **P2-10** | `quotes.service.ts` `search` | `sort=relevance` is accepted and silently identical to `newest`. | Until real ranking exists (Phase 5, trigram similarity), order `relevance` results with exact-normalised matches first (cheap `CASE` in the P0-3 raw query) or remove `relevance` from the enum and document it. Pick the first. |
| **P2-11** | `config/env.validation.ts`, `app.module.ts:25-31` | `NODE_ENV`/`LOG_LEVEL` are free strings; `LoggerModule` reads `process.env` instead of validated config; in production, a missing `NODE_ENV` loads the `pino-pretty` transport, which is a **devDependency** → crash at boot. | `@IsIn(['development','test','production'])` for `NODE_ENV`, `@IsIn` pino levels for `LOG_LEVEL`; `LoggerModule.forRootAsync` with `ConfigService`; enable `pino-pretty` only when `NODE_ENV === 'development'`. |
| **P2-12** | `app.module.ts:37-45`, `all-exceptions.filter.ts:34-39` | Inbound `x-request-id` is trusted verbatim (live: a 3000-char header is echoed back and written into every log line) — log-injection / log-bloat vector. The filter re-reads the raw header instead of `req.id`. | Accept the inbound id only if it matches `^[A-Za-z0-9._-]{1,128}$`, else generate a UUID. The filter should use `request.id` (set by pino-http) first. |
| **P2-13** | `health/health.controller.ts` | `version` comes from `npm_package_version`, which is **undefined under `node dist/main`** (falls back to a hard-coded `'0.0.1'`). Readiness 503 body is the error envelope, while §8 specifies `{ status: 'error', checks: { database: 'down' } }`. | Read the version once from `package.json` (`import.meta.dirname` + `readFileSync`, or `createRequire`). Keep the 503 status (that's what probes check) and put `{ status, checks }` in `error.details` — already the case — document it in backend-plan §8 rather than special-casing the filter. Exclude `/health*` from pino-http auto-logging (`autoLogging.ignore`) so probes don't flood logs. |
| **P2-14** | `hadith.service.ts` `buildGradeFilter` vs sins/good-deeds | Inconsistent semantics: `/hadith` with `UNGRADED` allowed also returns `grade = null`; the reminder endpoints never return `grade = null` hadith. | One rule in `GradePolicy` (e.g. `GradePolicy.whereClause(allowed)`), used by all four endpoints. Recommended: treat `null` grade on a `HADITH` as `UNGRADED` everywhere (opt-in only). |
| **P2-15** | `hadith.module.ts` | `GradePolicy` (static-only class) registered as a Nest provider and exported — misleading DI surface. | Drop it from `providers`/`exports`; import the class directly (as the services already do). |
| **P2-16** | `enableImplicitConversion` on JSON **bodies** | `PATCH /admin/sins/:id {"severity":"5"}` is accepted (string coerced). A typed client sending a string is a bug we hide. | Keep implicit conversion for query strings (plan §2.7) but not for bodies: e.g. `transformOptions: { enableImplicitConversion: true }` stays, and body DTO numeric fields get `@IsInt()` *without* relying on coercion — verify with an e2e that `"5"` → 400. If that requires two pipes (query vs body), do it with a custom pipe wrapper; otherwise document the decision and skip. |
| **P2-17** | Missing indexes (raw-SQL / `@@index` migration — schema **indexes** only) | Core-loop and browse queries filter on `SinQuote.quoteId`, `GoodDeedQuote.quoteId`, `GoodDeed.oppositeSinId`, `Quote(type, surahNumber, ayahNumber)`, `Translation.quoteId` (covered by the unique), `QuoteTag.tagId`. | Ask the owner (§5 D-3) before adding `@@index` to `schema.prisma` — it is additive but it is a schema file change. |

### ⚪ P3 — Polish (fix if cheap, otherwise list as known)

- `quotes.service.ts` `search`: `appliedFilters` echoes only 5 of the 13 filters — echo all non-undefined ones.
- `tags` `nameAr` is nullable in the schema; `QuoteTagDto.nameAr` is now `string | null` (fixed in `43382e6`) —
  make sure the frontend contract in backend-plan §3.1 says nullable.
- `quotes.service.ts` `buildQuoteInclude`: `tags` order is unspecified → tag chips jump between requests. Add
  `orderBy: { tag: { slug: 'asc' } }`.
- Admin `create` handlers use `@Res({ passthrough: true })` only to set 201 + `Location`; `@HttpCode(201)` +
  `@Header` can't build a dynamic `Location`, so keep it, but extract a tiny `setCreated(res, path)` helper so the
  four copies don't drift.
- `classification` `link*` does `findUnique` then `upsert` (two round trips, racy `created` flag). Acceptable;
  wrap in an interactive transaction if P2-2 makes it trivial.
- `sources` admin: `isExternalApi=true` without `apiProvider` is accepted — require `apiProvider` +
  `apiBaseUrl` when `isExternalApi` is true (Phase 5 sync will need them).
- `PATCH /admin/quotes/:id` on an `API_CACHED` row may edit provider-owned fields — roadmap puts that guard in
  Phase 5; add a `// TODO(phase-5)` at the method so it is not forgotten.
- `README.md`/`backend/README.md`: document the Homebrew-Postgres-on-5432 conflict from the completion report,
  `pnpm db:seed`, and how to run e2e against `thekra_test`.

---

## 4. Plan coverage matrix (Phase 2 scope)

Legend: ✅ meets plan · ⚠️ works with deviations (finding ID) · ❌ broken / missing.

| # | Endpoint | Status |
| --- | --- | --- |
| 1 | `GET /sins` | ⚠️ search broken (P0-3), severity nulls (P1-8), no tiebreak (P2-3) |
| 2 | `GET /sins/:slug` | ⚠️ related deeds capped at 3, no `lang` (P1-8) |
| 3 | `GET /sins/:slug/quotes` | ❌ `includeWeak=false` leaks weak (P0-1), `shuffle` missing (P1-2), MAWDU → 400 (P1-3); `isFavorite` is Phase 4 ✅ |
| 4 | `GET /sins/:slug/good-deeds` | ✅ (tiebreak P2-3) |
| 5 | `GET /good-deeds` | ⚠️ search broken (P0-3) |
| 6 | `GET /good-deeds/:slug` | ⚠️ no `lang` (P1-8) |
| 7 | `GET /good-deeds/:slug/quotes` | ❌ same as #3 |
| 8 | `GET /quotes` | ❌ no grade policy (P0-2), search broken (P0-3), `relevance` sort fake (P2-10) |
| 9 | `GET /quotes/:id` | ❌ serves MAWDU (P0-2), `includeLinks=false` ignored (P0-1) |
| 10 | `GET /quran/surahs` | ⚠️ P2-7 |
| 11 | `GET /quran/surahs/:n/ayahs` | ⚠️ P2-3, P2-9 |
| 12 | `GET /quran/ayahs/:s/:a` | ⚠️ `includeAllTranslations=false` → true (P0-1), env (P2-8) |
| 13 | `GET /hadith` | ❌ `includeWeak=false` leaks (P0-1), search (P0-3), MAWDU → 400 (P1-3), null-grade rule (P2-14) |
| 14 | `GET /hadith/collections` | ✅ |
| 15 | `GET /tags` | ⚠️ Arabic search (P0-3) |
| 16 | `GET /tags/:slug` | ✅ |
| 17 | `GET /sources` | ❌ `isExternalApi=false` returns external sources (P0-1) |
| 18 | `GET /sources/:id` | ✅ |
| 28–31 | `/admin/quotes` CRUD + list | ⚠️ P1-4, P2-4; list must not apply public grade default (P0-2.3) |
| 32–33 | translations PUT/POST | ❌ always 400 (P1-1) |
| 34 | translations DELETE | ⚠️ path param unvalidated (P1-1) |
| 35 | `PUT /admin/quotes/:id/tags` | ⚠️ P2-5 |
| 36–38 | `/admin/sins` | ❌ `?force=false` deletes linked sin (P0-1); null → 500 (P1-4) |
| 39–41 | `/admin/good-deeds` | ⚠️ P1-4 |
| 42–44 | `/admin/sources` | ⚠️ P1-4, P3 |
| 45–47 | `/admin/tags` | ⚠️ P1-4 |
| 48, 53 | `POST /admin/{sin,good-deed}-quotes` | ✅ upsert 201/200 verified; MAWDU rejected |
| 49, 54 | `GET …` (list) | ❌ `hasNote=false` inverted (P0-1), `newest` random (P2-6) |
| 50–51, 55–56 | `PATCH` / `DELETE` link | ✅ |
| 52, 57 | `…/bulk` | ❌ not transactional, leaks errors (P1-7) |
| 61 | `/health`, `/health/ready` | ⚠️ P2-13 |

Cross-cutting plan items:

| Plan item | Status |
| --- | --- |
| §0 ESM `.js` imports, oxlint, Vitest | ✅ |
| §1.1 `PrismaModule @Global`, `enableShutdownHooks` | ✅ |
| §1.12 module list / no invented modules | ✅ (`auth/users/favorites/content-sync` correctly absent) |
| §2.1 `/v1` prefix, health excluded | ✅ but leftover `GET /v1` (P1-10) |
| §2.2 envelope | ✅ |
| §2.3 pagination, `limit ≤ 100`, reminders `≤ 50` | ✅ (tiebreak P2-3) |
| §2.4 `lang`, `textAr` always returned, `translation` object | ✅ (detail endpoints missing `lang` param P1-8) |
| §2.5 error shape + Prisma table | ⚠️ details shape (P1-6), body-parser errors (P1-5), `PrismaClientValidationError` (P1-5) |
| §2.6 status codes | ⚠️ 422 vs 400 (P1-3, P2-4), 413 (P1-5) |
| §2.7 ValidationPipe / CORS / request id | ⚠️ request id (P2-12), booleans (P0-1) |
| §4.1 grade `OR` clause keeps verses | ✅ verified live (`?grades=SAHIH` keeps `QURAN_VERSE`) |
| §4.2 shuffle | ❌ P1-2 |
| §4.3 grade policy everywhere, DTO **and** service | ❌ P0-1, P0-2, P1-3 |
| §4.4 Arabic normaliser | ❌ P0-3 |
| §5 DTO conventions (`@ValidQuoteShape`, one DTO per file, `TransformToArray`) | ⚠️ P1-1, P2-4 |
| §6 bootstrap / env validation | ⚠️ P2-8, P2-11 |
| §8 pino, redaction, correlation | ⚠️ P2-11, P2-12, P2-13 |
| §11.1 unit non-negotiables | ⚠️ present but mock-shaped — must be backed by e2e (P1-9) |
| §11.2 e2e per controller | ❌ P1-9 |
| content-pipeline §5 seed | ⚠️ counts/idempotency ✅, content accuracy ❌ (P0-4) |
| `rawPayload` never serialised | ✅ verified; keep the all-endpoints e2e sweep (P1-9.4) |

---

## 5. Decisions for the owner

> **DECIDED (2026-10-05):** D-1 yes · D-2 yes · D-3 yes · D-4 serve DAIF/UNGRADED detail with grade badge,
> MAWDU 404 · D-5 apply only seed rows the owner confirms. Also: P1-2 default `seed` is a **date-only** bucket
> (no IP hashing — privacy of intent). See `phase-2-backend-review-followup.md`.

| ID | Question | Recommendation |
| --- | --- | --- |
| **D-1** | All `/v1/admin/*` routes are unauthenticated until Phase 4 (accepted by the roadmap). Should Phase 2 add a stop-gap? | Yes, a tiny `AdminApiKeyGuard` (header `x-admin-key` vs `ADMIN_API_KEY` env; if the env var is unset and `NODE_ENV=production`, every admin route returns 403). Remove in Phase 4 when `RolesGuard` lands. **Never deploy to staging without it.** Needs plan sign-off because it's not in backend-plan. |
| **D-2** | `SinQuote`/`GoodDeedQuote` have no `createdAt`, so the admin `sort=newest` (§3.11 #49) is impossible. | Approve an additive migration adding `createdAt DateTime @default(now())` + `updatedAt @updatedAt` to both link tables (useful for curator audit too), or drop `newest` from the plan. |
| **D-3** | Add the indexes in P2-17? | Yes, one additive `add_query_indexes` migration. Cheap now, painful after Phase 5 ingestion. |
| **D-4** | `GET /quotes/:id` for a `DAIF`/`UNGRADED` hadith: serve it (with grade badge) or 404 unless `includeWeak=true`? | Serve it — a detail page is an explicit navigation and the grade is rendered; `MAWDU` stays 404 (P0-2). |
| **D-5** | Seed content accuracy (P0-4): who verifies the references/grades and the Ibn al-Qayyim attributions? | Owner (or a qualified reviewer) signs off the corrected table before Phase 3 demos; Cursor only applies the corrections the owner confirms. |

---

## 6. Deferred — out of scope for this fix pass

- DevOps half of Phase 2: git remote, `ci.yml`, `backend/Dockerfile`, staging (agreed deferral; must land before
  any deployment and before the roadmap's "CI is green on a PR" criterion can be claimed).
- Auth, favorites, `OptionalJwtAuthGuard`, `isFavorite`, `RolesGuard` (Phase 4).
- `content-sync` (Phase 5), trigram index, `CacheModule`, `helmet`/`compression`, cursor pagination (Phase 5).
- Throttling (Phase 4).

---

## 7. Execution order (one commit per line unless grouped)

1. **P0-1** `@ToBoolean()` everywhere.
2. **P1-6** validation `exceptionFactory` + **P1-3** MAWDU → 422 (same pipe change).
3. **P1-5** filter: http-errors + `PrismaClientValidationError`.
4. **P1-9 (infrastructure only):** `.env.test`, helpers, fixtures, `errors` + `health` specs. From here on, every
   fix adds its e2e test in the same commit.
5. **P0-2** grade policy on `/quotes` + `/quotes/:id` (+ admin list split).
6. **P2-14 + P2-15** single `GradePolicy` where-clause.
7. **P0-3** Arabic search (migration + helper + all endpoints).
8. **P2-1** extract the shared link-quote query, then **P1-2** shuffle on top of it.
9. **P1-8** detail/alternatives/`lang`/severity nulls.
10. **P1-1** translation DTOs.
11. **P1-4 + P2-4** null handling + `@ValidQuoteShape`.
12. **P1-7** bulk transaction, then **P2-2** classification generic, then **P2-6**.
13. **P2-3** total ordering everywhere.
14. **P2-5, P2-7, P2-8, P2-9, P2-10.**
15. **P2-11, P2-12, P2-13, P2-16.**
16. **P1-10** remove scaffold route.
17. **P0-4** seed corrections — only the rows the owner has confirmed (D-5); re-run seed twice.
18. **P1-9 (completion):** remaining controller specs until every endpoint in §4 has e2e coverage.
19. P3 items that are cheap.

## 8. Definition of done for this pass (report back with this table filled in)

| Check | Command / evidence required |
| --- | --- |
| Every P0 + P1 ID fixed | ID → commit hash |
| Every P2 ID fixed or explicitly deferred with a reason | ID → commit hash / reason |
| §2 live-evidence commands now return the expected values | paste actual output |
| Lint / typecheck / unit / e2e / prisma validate green | paste the tail of each command |
| `grep -rn "Type(() => Boolean)" backend/src` | empty |
| `pnpm db:seed` run twice | identical summary lines |
| Every endpoint in §4 has ≥1 e2e test | list spec file → endpoints |
| Open owner decisions | list D-IDs still waiting |
