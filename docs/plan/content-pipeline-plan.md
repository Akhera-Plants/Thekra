# Thekra — Content Pipeline Plan

> Scope: how content gets **into** the database — external ingestion (`origin = API_CACHED`), the human
> curation step that makes it useful (`SinQuote` / `GoodDeedQuote`), and the development seed.
> Implements the dynamic-content strategy in [ARCHITECTURE §2](../ARCHITECTURE.md#2-dynamic-content-strategy)
> inside [`backend/src/modules/content-sync/`](../../backend/src/modules/content-sync/) and
> [`backend/src/modules/classification/`](../../backend/src/modules/classification/).
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [backend-plan.md](./backend-plan.md) ·
> [devops-plan.md](./devops-plan.md) · [roadmap.md](./roadmap.md)

---

## 1. Principles (inherited, not re-decided)

| Principle | Practical consequence |
| --- | --- |
| **Cache, don't proxy** | A user request is **never** served by an inline call to Quran.com or Sunnah.com. Every read endpoint hits Postgres only. A provider outage, rate limit, or latency spike cannot touch the core loop. |
| **Ingestion ≠ classification** | A sync job may create and update `Quote` rows. It may **never** write a `SinQuote` or `GoodDeedQuote` row. Linking content to an intent is human editorial judgment (§4). |
| **Provenance survives** | `narrator`, `grade`, `hadithReference`, `apiProvider`, `externalId` and the verbatim `rawPayload` are all persisted, so the app can always show *what* is being read and *how reliable* it is. |
| **Idempotent by construction** | `@@unique([apiProvider, externalId])` on `Quote` makes re-running an import an upsert, never a duplicate. |
| **Auditable** | Every run is a `SyncLog` row with `SyncStatus`, timings, `recordsImported` and `errorMessage`. Content people rely on religiously must not mutate silently. |

Two rules added by this plan:

- **Provider text is read-only for curators.** For a row with `origin = API_CACHED`, the provider is the
  authority on `textAr`, `narrator`, `grade`, `hadithReference`. A curator who wants a different wording
  **forks** it: create a new `origin = LOCAL` quote (optionally noting the source) and link that one. Otherwise
  the next sync silently overwrites the edit. Enforced at `PATCH /v1/admin/quotes/:id`, which rejects edits to
  provider-owned fields on `API_CACHED` rows with `422 FIELD_OWNED_BY_PROVIDER`.
- **Ingestion is breadth; curation is quality.** Sync fills the library. Nothing a sync imports appears in a
  sin/deed reminder until a human links it.

---

## 2. Provider integrations

Each provider is one `Source` row with `isExternalApi = true`, plus one adapter class implementing a common
interface. Adding a provider must never require touching the sync orchestrator.

```ts
// modules/content-sync/providers/content-provider.interface.ts (shape)
export interface ContentProvider {
  readonly key: string;                       // === Source.apiProvider, e.g. 'quran.com'
  readonly quoteType: QuoteType;
  fetchBatch(cursor: ProviderCursor): Promise<ProviderBatch>;   // one page / one unit of work
  mapToQuote(raw: unknown, source: Source): MappedQuote;        // pure, unit-testable, no I/O
}
export type MappedQuote = {
  externalId: string;
  quote: Prisma.QuoteUncheckedCreateInput;    // without id
  translations: { languageCode: string; text: string }[];
};
```

`mapToQuote` being **pure** is the point: every mapping table below is testable against a fixture JSON file in
`backend/test/fixtures/<provider>/` with no network access.

### 2.1 Quran.com API — primary Quran provider

| Item | Value |
| --- | --- |
| `Source.apiProvider` | `quran.com` |
| `Source.apiBaseUrl` | `https://api.quran.com/api/v4` |
| `Source.type` | `QURAN` |
| `Source.name` / `nameAr` | `"The Noble Qur'an (Quran.com)"` / `"القرآن الكريم"` |
| Auth | Historically open; the Quran Foundation now issues client credentials for the hosted API. **Implement the adapter with an optional bearer/`x-auth-token` header from config** (`QURAN_API_TOKEN`, `QURAN_API_CLIENT_ID`) and treat a `401`/`403` as a configuration error, not a transient one. Verify the current requirement at integration time. |
| Config keys | `QURAN_API_BASE_URL`, `QURAN_API_TOKEN?`, `QURAN_TRANSLATION_IDS` (CSV of `resource_id`s), `QURAN_TEXT_FIELD` (default `text_uthmani`) |

**Endpoints used**

| Purpose | Request |
| --- | --- |
| Surah index | `GET /chapters?language=ar` |
| Verses of a surah | `GET /verses/by_chapter/{chapter_number}?language=ar&fields=text_uthmani&translations={ids}&per_page=50&page={n}` |
| Single verse | `GET /verses/by_key/{surah}:{ayah}?fields=text_uthmani&translations={ids}` |
| Translation catalogue | `GET /resources/translations` (used once to pick `QURAN_TRANSLATION_IDS`) |

**Representative response (trimmed)**

```jsonc
{
  "verses": [
    {
      "id": 2741,
      "verse_number": 12,
      "verse_key": "49:12",
      "chapter_id": 49,
      "text_uthmani": "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱجْتَنِبُوا۟ كَثِيرًا مِّنَ ٱلظَّنِّ…",
      "juz_number": 26,
      "page_number": 517,
      "translations": [
        { "id": 9100, "resource_id": 131, "text": "O you who have believed, avoid much [negative] assumption…" }
      ]
    }
  ],
  "pagination": { "per_page": 50, "current_page": 1, "next_page": 2, "total_pages": 2, "total_records": 18 }
}
```

**Field mapping**

| `Quote` field | From | Notes |
| --- | --- | --- |
| `type` | — | constant `QURAN_VERSE` |
| `origin` | — | constant `API_CACHED` |
| `textAr` | `verses[].text_uthmani` | configurable via `QURAN_TEXT_FIELD` (`text_uthmani` / `text_imlaei`); record the choice in `rawPayload` so a later change is detectable |
| `sourceId` | the `quran.com` `Source` row | resolved once per run |
| `surahNumber` | `verses[].chapter_id` | |
| `ayahNumber` | `verses[].verse_number` | **not** the global verse `id` |
| `surahName` | `/chapters[].name_simple` | fetched once per run and cached in memory (not per verse) |
| `surahNameAr` | `/chapters[].name_arabic` | |
| `externalId` | **`verse_key`** → `"49:12"` | see §2.5 |
| `apiProvider` | `"quran.com"` | |
| `rawPayload` | the whole `verses[]` element | verbatim, including `translations` |
| `narrator`, `grade`, `hadithReference`, `bookTitle`, `author`, `pageOrChapter` | — | stay `NULL` |

**`Translation` mapping:** one row per `translations[]` entry → `{ quoteId, languageCode, text }`. `languageCode`
comes from the resource's language (resolved from `/resources/translations`, cached in a static map), **not**
from the verse payload. A second translation for the same language collides on
`@@unique([quoteId, languageCode])`; policy: **first configured `resource_id` wins**, later ones are skipped and
counted in the run summary. Multi-translation-per-language support is a schema discussion for later, not a
silent overwrite.

### 2.2 alquran.cloud — fallback Quran provider

| Item | Value |
| --- | --- |
| `Source.apiProvider` | `alquran.cloud` |
| `Source.apiBaseUrl` | `https://api.alquran.cloud/v1` |
| Auth | none |
| Endpoints | `GET /surah/{n}/{edition}` (e.g. `quran-uthmani`), `GET /ayah/{surah}:{ayah}/{edition}`, `GET /edition?format=text&type=quran` |

```jsonc
{ "code": 200, "status": "OK",
  "data": { "number": 49, "name": "سورة الحجرات", "englishName": "Al-Hujuraat", "numberOfAyahs": 18,
    "ayahs": [ { "number": 4612, "text": "يَا أَيُّهَا الَّذِينَ آمَنُوا اجْتَنِبُوا…",
                 "numberInSurah": 12, "juz": 26, "page": 517 } ],
    "edition": { "identifier": "quran-uthmani", "language": "ar", "name": "القرآن الكريم" } } }
```

Mapping differences from §2.1: `textAr ← data.ayahs[].text`; `ayahNumber ← numberInSurah` (**not** `number`,
which is the global 1–6236 index); `surahNumber ← data.number`; `surahName ← data.englishName`;
`surahNameAr ← data.name`; `externalId ← "{surahNumber}:{numberInSurah}"`. Translations come from a second call
with a translation `edition` (e.g. `en.sahih`), keyed by the edition's `language`.

**Why a second provider at all:** zero-auth and a different failure domain. Selection is config-driven
(`QURAN_PREFERRED_PROVIDER`), and because `externalId` is namespaced by `apiProvider`, both can be cached
simultaneously without conflict — which is exactly why `GET /v1/quran/ayahs/:surah/:ayah` has a documented
provider-preference rule ([backend-plan §3.5](./backend-plan.md#35-quran)).

### 2.3 Sunnah.com API — primary Hadith provider

| Item | Value |
| --- | --- |
| `Source.apiProvider` | `sunnah.com` |
| `Source.apiBaseUrl` | `https://api.sunnah.com/v1` |
| `Source.type` | `HADITH_COLLECTION` — **one `Source` row per collection** (Bukhari, Muslim, …), all sharing `apiProvider = 'sunnah.com'` |
| Auth | **`X-API-Key` header, key issued on request.** Config: `SUNNAH_API_KEY`. Without it the adapter must refuse to start a run (`422 PROVIDER_NOT_CONFIGURED`), not fail mid-run. |
| Endpoints | `GET /collections`, `GET /collections/{name}/books`, `GET /collections/{name}/books/{bookNumber}/hadiths?page={n}`, `GET /hadiths/{collection}/{hadithNumber}` |

```jsonc
{
  "collection": "bukhari",
  "bookNumber": "2",
  "chapterId": "1",
  "hadithNumber": "13",
  "hadith": [
    { "lang": "ar", "chapterNumber": "1", "chapterTitle": "باب …", "urn": 10260,
      "body": "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه",
      "grades": [ { "graded_by": "", "grade": "صحيح" } ],
      "reference": { "book": 2, "hadith": 13 } },
    { "lang": "en", "chapterNumber": "1", "chapterTitle": "…", "urn": 10270,
      "body": "None of you will have faith till he wishes for his brother…",
      "grades": [ { "graded_by": "Al-Albani", "grade": "Sahih" } ],
      "reference": { "book": 2, "hadith": 13 } }
  ]
}
```

**Field mapping**

| `Quote` field | From | Notes |
| --- | --- | --- |
| `type` / `origin` | — | `HADITH` / `API_CACHED` |
| `textAr` | `hadith[lang='ar'].body` | **If there is no `ar` entry, skip the record** and count it as `skipped`. An Arabic-less hadith cannot be stored — `textAr` is `NOT NULL` and is the source of truth. |
| `sourceId` | the collection's `Source` row | mapped from `collection` via a `COLLECTION_SOURCE_MAP` resolved at run start |
| `narratorAr` | parsed from the Arabic `body` prefix where present (`حدثنا …`, `عن …`) | **Heuristic.** If parsing is not confident, leave `NULL` — a wrong narrator is worse than a missing one. |
| `narrator` | the English `hadith[lang='en']` narrator segment when available | same rule |
| `grade` | `hadith[*].grades[].grade` → `HadithGrade` via §2.6 | take the **most conservative** grade when sources disagree |
| `hadithReference` | `"{Collection} {hadithNumber}"`, e.g. `"Bukhari 13"` | human-citable; `reference.book`/`reference.hadith` also kept in `rawPayload` |
| `externalId` | `"{collection}:{hadithNumber}"` → `"bukhari:13"` | §2.5 |
| `apiProvider` | `"sunnah.com"` | |
| `rawPayload` | the whole hadith object incl. both language entries, `urn`s and `grades` | lets a better narrator parser re-run later **without re-fetching** |
| `Translation` | `hadith[lang='en'].body` → `{ languageCode: 'en', text }` | one row; additional languages if the provider returns them |

**Note on `chapterTitle`:** worth keeping only in `rawPayload` for now. Mapping it to `pageOrChapter` would
overload a book-group field with hadith semantics; `hadithReference` already covers citation. Flagged as an
open question in [TECHNICAL_PLAN](../TECHNICAL_PLAN.md#open-decisions--assumptions).

### 2.4 HadithAPI.com — fallback / alternative Hadith provider

| Item | Value |
| --- | --- |
| `Source.apiProvider` | `hadithapi.com` |
| `Source.apiBaseUrl` | `https://hadithapi.com/api` |
| Auth | `apiKey` **query parameter** (`HADITH_API_KEY`) — must be redacted from every log line and never stored in `rawPayload` (strip the request URL before persisting) |
| Endpoints | `GET /books?apiKey=…`, `GET /{book}/chapters?apiKey=…`, `GET /hadiths?apiKey=…&book={slug}&chapter={n}&paginate=25&page={n}` |

```jsonc
{ "hadiths": { "current_page": 1, "total": 7275, "last_page": 291,
  "data": [ { "id": 1, "hadithNumber": "1", "englishNarrator": "Narrated 'Umar bin Al-Khattab:",
              "hadithEnglish": "I heard Allah's Messenger saying…",
              "hadithArabic": "إنما الأعمال بالنيات…", "headingArabic": "…",
              "status": "Sahih", "bookSlug": "sahih-bukhari", "volume": "1",
              "book": { "bookName": "Sahih Bukhari", "writerName": "Imam Bukhari" },
              "chapter": { "chapterNumber": "1", "chapterEnglish": "Revelation", "chapterArabic": "بدء الوحي" } } ] } }
```

Mapping notes: `textAr ← hadithArabic`; `narrator ← englishNarrator` (strip the trailing colon and the
`"Narrated "` prefix); `grade ← status` through §2.6; `hadithReference ← "{book.bookName} {hadithNumber}"`;
`externalId ← "{bookSlug}:{hadithNumber}"`; `Translation(en) ← hadithEnglish`. **Advantage over Sunnah.com:**
Arabic text, English text, a narrator field and an authenticity `status` all arrive in one payload, and the
`status` query parameter allows fetching only `Sahih` records — the cheapest way to seed a trustworthy library.
**Disadvantage:** less canonical referencing. Recommendation: Sunnah.com as the reference-quality primary,
HadithAPI.com as both fallback and the fast path for grade-filtered bulk import.

### 2.5 `externalId` semantics — the idempotency key

`externalId` is **the provider's stable natural key, in the provider's own addressing scheme**, never a
Thekra-generated id and never a numeric row id that the provider may re-sequence.

| Provider | Format | Example | Chosen because |
| --- | --- | --- | --- |
| `quran.com` | `{surah}:{ayah}` (their `verse_key`) | `49:12` | Canonical, immutable, and human-verifiable. Their global `id` is an internal index. |
| `alquran.cloud` | `{surah}:{numberInSurah}` | `49:12` | Same addressing; derived, since they expose a global ayah `number` instead. |
| `sunnah.com` | `{collection}:{hadithNumber}` | `bukhari:13` | Matches how hadith are cited. `urn` is per-language, so it would create two rows for one hadith. |
| `hadithapi.com` | `{bookSlug}:{hadithNumber}` | `sahih-bukhari:13` | Their `id` is a database id and not stable across dumps. |

Invariants:
- `externalId` is unique **within** an `apiProvider`, enforced by `@@unique([apiProvider, externalId])`.
- The same ayah cached from two providers is **two rows** — intentional: different `textAr` orthography and
  different provenance. Deduplication across providers is a later, explicit product decision, not an accident of
  the key.
- For `origin = LOCAL` rows, both `apiProvider` and `externalId` stay `NULL`. In PostgreSQL `NULL`s are distinct
  in a unique index, so unlimited local quotes coexist under that constraint. **Do not** fill in a sentinel like
  `'local'` — it would cap local quotes at one per `externalId`.
- Consequently the compound-unique upsert path is valid **only** when both values are non-null, i.e. only in the
  sync module. Guard it in code.

### 2.6 Grade normalisation (`HadithGrade`)

Providers return free text, in Arabic or English, sometimes with the grader's name. One pure function owns the
mapping:

```ts
// modules/content-sync/mappers/grade.mapper.ts (shape)
export function normalizeGrade(raw: string | null | undefined): HadithGrade { … }
```

| Incoming (case/diacritic-insensitive, substring match) | → `HadithGrade` |
| --- | --- |
| `sahih`, `صحيح`, `sahih li ghairih`, `صحيح لغيره`, `authentic`, `muttafaqun alayh`, `متفق عليه` | `SAHIH` |
| `hasan`, `حسن`, `hasan sahih`, `حسن صحيح`¹, `good` | `HASAN` |
| `da'if`, `daif`, `dhaeef`, `ضعيف`, `weak`, `munkar`, `منكر`, `shadh`, `شاذ` | `DAIF` |
| `mawdu`, `موضوع`, `fabricated`, `batil`, `باطل`, `la asla lahu`, `لا أصل له` | `MAWDU` |
| empty, `null`, unrecognised | `UNGRADED` |

¹ `حسن صحيح` maps to `HASAN` deliberately: the conservative floor of a compound grading.

Rules: when several `grades[]` entries disagree, take the **weakest** (`DAIF` beats `SAHIH`) — under-claiming
authenticity is the safe failure. Every unrecognised string is logged at `warn` with the provider and
`externalId` and included in the run summary as `unmappedGrades`, so the table can be extended from real data
rather than guesswork. The mapper gets a dedicated unit-test table; this function is the single point where the
app could misrepresent authenticity, which [ARCHITECTURE §1](../ARCHITECTURE.md) calls out as unacceptable.

---

## 3. Sync job mechanics

### 3.1 Scheduler choice — `@nestjs/schedule` cron now, BullMQ later

**Decision: `@nestjs/schedule` (in-process cron) for phase 5.** Reasons: no new infrastructure (no Redis, no
worker dyno, no extra deploy target); the workload is a handful of slow, low-frequency, non-urgent batch imports,
not a high-throughput queue; the whole import set is idempotent, so a missed or duplicated run is harmless; and
`SyncLog` already provides the run history that a queue dashboard would otherwise give.

Known limitations, accepted and documented rather than designed around:

| Limitation | Mitigation now | Real fix (later phase) |
| --- | --- | --- |
| Two API instances ⇒ two cron firings | A `SyncLog`-based advisory lock (§3.3) + a Postgres advisory lock (`pg_try_advisory_lock`) | BullMQ with a single worker |
| No retry/backoff across process restarts | Per-request retry inside the run (§3.5); a failed run is simply re-triggered | BullMQ retries with backoff |
| A long run occupies the API process | Batch sizes capped, `await` between pages, concurrency 1 | dedicated worker |
| No progress visibility mid-run | `SyncLog.recordsImported` updated every batch | queue UI |

The upgrade path is deliberately cheap: `ContentSyncService.triggerRun()` already returns immediately with a
`SyncLog` handle, so moving execution into a queue changes only *who calls the executor*, not the API contract
or the data model. Recorded in [Open Decisions](../TECHNICAL_PLAN.md#open-decisions--assumptions).

### 3.2 Schedules

```ts
// modules/content-sync/content-sync.scheduler.ts (shape)
@Cron('0 3 * * 0', { name: 'quran-full-sync',   timeZone: 'UTC' })  // Sunday 03:00 — Quran text is immutable
@Cron('0 4 * * *', { name: 'hadith-incremental', timeZone: 'UTC' }) // nightly 04:00 — next N collection chunks
@Cron('0 5 * * 1', { name: 'translations-sync',  timeZone: 'UTC' }) // Monday 05:00 — translation editions
```

All schedules come from config (`SYNC_QURAN_CRON`, `SYNC_HADITH_CRON`, …) and a global kill switch
`SYNC_ENABLED=false` is the default **everywhere except production** — local and CI must never hit a provider on
a timer. Manual triggering stays available at `POST /v1/admin/content-sync/runs`
([backend-plan §3.12](./backend-plan.md#312-admin--content-sync--sync-logs)).

Quran is a **full** sync because its text never changes (the run is almost entirely no-op updates, which is what
makes it a good idempotency canary). Hadith is **incremental by chunk** — collections are large; each run
processes the next `SYNC_HADITH_CHUNK_SIZE` books, with the cursor derived from `Source.lastSyncedAt` plus the
highest `externalId` already stored for that collection.

### 3.3 Run lifecycle

```
trigger (cron or POST /v1/admin/content-sync/runs)
  └─ guard: a SyncLog for this sourceId with status PENDING|RUNNING exists?  → 409 SYNC_ALREADY_RUNNING
  └─ guard: Source.isExternalApi === true                                   → 422 SOURCE_NOT_EXTERNAL
  └─ guard: provider configured (API key present)                           → 422 PROVIDER_NOT_CONFIGURED
  └─ create SyncLog { sourceId, status: PENDING, startedAt: now() }          → return 202 { syncLogId }
  ── async from here ─────────────────────────────────────────────────────────────────
  └─ pg_try_advisory_lock(hash(sourceId))  → if not acquired, mark SyncLog FAILED "lock not acquired"
  └─ SyncLog.status = RUNNING
  └─ for each batch (page) from the provider:
       ├─ fetch (retry/backoff §3.5)
       ├─ for each record: map → validate → upsert   [per-record try/catch, §3.6]
       ├─ SyncLog.recordsImported += batch successes      (progress is visible mid-run)
       └─ respect the rate budget (§3.5)
  └─ Source.lastSyncedAt = now()
  └─ SyncLog { status: SUCCESS | FAILED, finishedAt: now(), recordsImported, errorMessage }
  └─ release advisory lock (always, in finally)
```

`PENDING` means "accepted, not started"; `RUNNING` means the executor has the lock. The distinction is what
makes the `409` guard correct when a trigger arrives while another run is still queued. A process crash can
leave a row stuck in `RUNNING`: a startup reconciliation marks any `RUNNING` row older than
`SYNC_STALE_AFTER_MINUTES` (default 120) as `FAILED` with `errorMessage = 'stale run reconciled at startup'`.

### 3.4 `SyncLog` bookkeeping

One row **per run per source**, never per record. Field usage:

| Field | Written when | Value |
| --- | --- | --- |
| `sourceId` | create | the target `Source` |
| `status` | create → start → end | `PENDING` → `RUNNING` → `SUCCESS` \| `FAILED` |
| `startedAt` | create | `@default(now())` |
| `finishedAt` | end | always set, including on failure |
| `recordsImported` | per batch | **created + updated** records; see the note below |
| `errorMessage` | end, if degraded | `NULL` on a clean run |

`recordsImported` is a single `Int?`, so the richer per-run counters (`created`, `updated`, `skipped`, `failed`,
`unmappedGrades`) are **serialised into `errorMessage` as a one-line summary** on any non-clean run, e.g.:

```
partial: created=1180 updated=40 skipped=12 failed=8; first error: HTTP 429 at bukhari book 44 page 3; unmapped grades: ["حسن غريب"]
```

That is a pragmatic compromise, not an elegant one. The clean alternative — a `SyncLog.stats Json?` column — is
listed as a **proposed schema addition** in [TECHNICAL_PLAN Open Decisions](../TECHNICAL_PLAN.md#open-decisions--assumptions)
with the recommendation to **defer**: `errorMessage` plus structured logs covers phase 5, and the admin UI
(phase 6) can surface the same numbers from logs. If the curation UI ends up needing them queryably, add
`stats Json?` then — it is purely additive.

A run with **zero** failures is `SUCCESS` with `errorMessage = NULL`. A run that completed with some records
failed is **still `SUCCESS`** (the import worked) with the summary in `errorMessage`; `FAILED` is reserved for
"the run could not complete" — auth failure, the provider unreachable, repeated `429`s after exhausting the
retry budget, or a DB error. Losing that distinction would make the log useless for alerting.

### 3.5 Rate limits & backoff

| Control | Value |
| --- | --- |
| Concurrency | **1 in-flight request per provider.** Sequential pages. These are background imports; there is nothing to win from parallelism and plenty to lose. |
| Pacing | A token-bucket delay from config: `SYNC_<PROVIDER>_RPS` (default `2` req/s), applied between requests. |
| Timeout | 15 s per request (`HttpModule` / axios `timeout`). |
| Retry | Up to **5** attempts for transient failures: `429`, `408`, `5xx`, and network errors (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`). Exponential backoff with full jitter: `min(2^n * 1000ms, 60s) * random(0.5…1)`. |
| `Retry-After` | Honoured when present; it **overrides** the computed backoff. |
| Never retried | `400`, `401`, `403`, `404`, `422` — these are bugs or configuration errors. Fail the run with a precise `errorMessage` instead of hammering the provider. |
| Circuit breaker | 3 consecutive exhausted-retry failures within a run ⇒ abort the run as `FAILED` with `errorMessage = 'provider circuit opened after 3 consecutive failures'`. A half-open probe is unnecessary when the next cron tick is hours away. |
| Budget | `SYNC_MAX_REQUESTS_PER_RUN` (default 2000) and `SYNC_MAX_DURATION_MINUTES` (default 30). Hitting either ends the run cleanly as `SUCCESS` with `partial: budget exhausted` — the incremental cursor means the next run continues. |
| Etiquette | A descriptive `User-Agent` (`Thekra/1.0 (+contact)`); `If-None-Match`/`ETag` passthrough where the provider supports it. |

Implemented with `@nestjs/axios` (already installed) plus a small `withRetry()` helper — no new HTTP dependency.

### 3.6 Idempotent upsert & partial-failure handling

```ts
// modules/content-sync/content-sync.service.ts — per-record, inside a per-record try/catch
const { externalId, quote, translations } = provider.mapToQuote(raw, source);

await this.prisma.$transaction(async (tx) => {
  const saved = await tx.quote.upsert({
    where: { apiProvider_externalId: { apiProvider: provider.key, externalId } },
    create: { ...quote, origin: 'API_CACHED', apiProvider: provider.key, externalId, rawPayload: raw },
    update: {
      // provider-owned fields only — NEVER touches sinLinks/goodDeedLinks/tags/favorites
      textAr: quote.textAr,
      narrator: quote.narrator, narratorAr: quote.narratorAr,
      grade: quote.grade, hadithReference: quote.hadithReference,
      surahNumber: quote.surahNumber, surahName: quote.surahName,
      surahNameAr: quote.surahNameAr, ayahNumber: quote.ayahNumber,
      rawPayload: raw,
    },
  });

  for (const t of translations) {
    await tx.translation.upsert({
      where: { quoteId_languageCode: { quoteId: saved.id, languageCode: t.languageCode } },
      create: { quoteId: saved.id, languageCode: t.languageCode, text: t.text },
      update: { text: t.text },
    });
  }
});
```

Why this is safe:

- **The `update` branch lists fields explicitly.** It never writes `sourceId`, `type`, or `origin`, and it
  cannot reach the join tables — so **re-syncing can never destroy curation work**. A quote linked to
  `ghibah` with `relevanceScore = 95` keeps that link forever, even if the provider revises the text.
- **The compound unique is the only lookup key.** No "find by text" matching, which would break on orthography.
- **One transaction per record, not per run.** A 1,200-record run must not be one giant transaction: it would
  hold locks for minutes and lose all progress on the last record's failure.

**Partial failure — one bad record must never fail the run:**

```ts
for (const raw of batch.records) {
  try { const r = await upsertRecord(raw); counters[r.created ? 'created' : 'updated']++; }
  catch (err) {
    if (err instanceof SkipRecordError) { counters.skipped++; continue; }       // e.g. no Arabic text (§2.3)
    counters.failed++;
    failures.push({ externalId: safeId(raw), reason: shortReason(err) });
    this.logger.warn({ provider, externalId: safeId(raw), err }, 'record failed; continuing run');
    if (counters.failed > SYNC_MAX_RECORD_FAILURES) throw new RunAbortedError('record failure threshold exceeded');
  }
}
```

Classification: `skipped` = knowingly not importable (missing `textAr`, duplicate translation language,
`type` the provider mapping does not support); `failed` = unexpected (validation failure, FK error, DB error).
`SYNC_MAX_RECORD_FAILURES` (default 50, or 10 % of the batch) is a real circuit breaker — if a provider changes
its payload shape, every record fails and the run should stop loudly rather than log 7,000 warnings.

`dryRun: true` ([backend-plan endpoint 58](./backend-plan.md#58-post-admincontent-syncruns--manual-trigger)) runs
fetch + map + validate with **no writes**, and records a `SyncLog` with `recordsImported = 0` and
`errorMessage = 'dryRun: would create=…, update=…, skip=…'`. This is the safe way to validate a new provider
adapter against production data.

### 3.7 Testing the pipeline

| Test | Assertion |
| --- | --- |
| `mapToQuote` per provider, against `backend/test/fixtures/<provider>/*.json` | exact field-by-field mapping, including `externalId` format and `NULL`s for inapplicable groups |
| `normalizeGrade` table test | every row of §2.6, plus unknown → `UNGRADED`, plus "weakest wins" |
| Idempotency | run the same fixture batch twice ⇒ `Quote` count unchanged, `updatedAt` bumped, `created=0 updated=N` the second time |
| **Curation survival** | create a quote, link it via `SinQuote` with `relevanceScore = 95`, re-run the sync ⇒ the link and the score are **unchanged**. This is the single most important regression test in the pipeline. |
| Partial failure | a batch with one malformed record ⇒ the run is `SUCCESS`, `failed=1`, all other records imported |
| Missing Arabic | a Sunnah.com record with no `lang: 'ar'` entry ⇒ `skipped`, no row written |
| Backoff | a mocked `429` with `Retry-After: 2` ⇒ waited ≈2 s, then succeeded (fake timers) |
| Lock | two concurrent `triggerRun` calls for one source ⇒ second gets `409 SYNC_ALREADY_RUNNING` |
| Stale reconciliation | a `RUNNING` row older than the threshold ⇒ `FAILED` at startup |

**No test ever calls a real provider.** `ContentProvider` implementations are injected and stubbed; fixtures are
captured once by hand and committed.

---

## 4. Curation workflow (human editorial step)

Deliberately manual. Per [ARCHITECTURE §2](../ARCHITECTURE.md#2-dynamic-content-strategy), *"ingestion is
separate from classification … the second always ends in human review."* No automated classifier writes a
`SinQuote` or `GoodDeedQuote` row in any planned phase.

### 4.1 Writing a `LOCAL` quote

A hand-curated quote (a scholar's words, a book excerpt, or a verse the curator wants under their own
orthography) is created through `POST /v1/admin/quotes`
([backend-plan §5.1](./backend-plan.md#51-createquotedto-endpoint-28--the-most-field-heavy-dto)):

1. Ensure a `Source` exists (`POST /v1/admin/sources` — e.g. `type = SCHOLAR`, `name = "Ibn al-Qayyim"`).
2. `POST /v1/admin/quotes` with `type`, `textAr` (required, Arabic-script-validated), `sourceId`, the
   type-appropriate group (`bookTitle`/`author`/`pageOrChapter` for a book; `grade`/`narrator`/`hadithReference`
   for a hadith), optional `translations[]` and `tagIds[]`.
3. `origin` defaults to `LOCAL`; the endpoint **refuses** an explicit `API_CACHED`
   (`422 ORIGIN_RESERVED_FOR_SYNC`), and `apiProvider`/`externalId`/`rawPayload` are not accepted at all. The
   two content paths cannot be confused by a client.

### 4.2 Linking a quote to an intent — the editorial act

```
POST /v1/admin/sin-quotes
{ "sinId": "…ghibah…", "quoteId": "…49:12…", "relevanceScore": 95,
  "note": "Explicit prohibition (الحجرات ٤٩:١٢); strongest primary text — lead with this." }
```

The curator is asserting three things, and `relevanceScore` is the ranking the user experiences
([backend-plan §3.2](./backend-plan.md#3-get-sinsslugquotes--the-core-endpoint-of-the-product)):

| Field | What it means |
| --- | --- |
| the pair | "this text genuinely addresses this sin/deed" — a topical judgment, not a keyword match |
| `relevanceScore` | "how directly, on a 0–100 scale" — **this is the ordering of the product's core screen** |
| `note` | *why*, for the next reviewer. Internal only; never shown to end users. |

Suggested scoring rubric (document it in the admin UI copy so scores stay comparable between curators):

| Band | Meaning |
| --- | --- |
| 90–100 | Explicit, primary, unambiguous — a direct prohibition/command about exactly this intent |
| 70–89 | Strongly related — names the consequence, the reward, or the mechanism |
| 40–69 | Supporting — general principle that applies, useful as a second or third reminder |
| 1–39 | Peripheral — keep only if the library is thin for this intent |
| 0 | Needs review / placeholder — `GET /v1/sins/:slug/quotes?minScore=1` excludes it from the default feed |

Operational rules:

- **Upsert, not insert.** Re-submitting a pair updates the score and note (`200`), so revising judgment is
  frictionless. The `@@unique` constraints guarantee one link per pair.
- **Both sides, deliberately.** The same quote can be `SinQuote(ghibah, 95)` *and*
  `GoodDeedQuote(hifz-al-lisan, 80)` — discouraging one thing and motivating its opposite. That pairing is what
  makes `data.alternatives` meaningful.
- **Weak narrations:** a `DAIF` hadith may be linked, but the default read filter
  (`grades = SAHIH,HASAN`) hides it; `MAWDU` must never be linked at all — the admin link endpoint rejects a
  `quoteId` whose `grade = MAWDU` with `422 GRADE_NOT_PERMITTED`. Deleting the quote entirely is better practice.
- **Triage after a sync run:** `GET /v1/admin/quotes?unlinkedOnly=true&origin=API_CACHED` is the curator's
  inbox; `POST /v1/admin/sin-quotes/bulk` links up to 100 of them against one sin in a single call.
- **Tags are the cheap first pass.** `PUT /v1/admin/quotes/:id/tags` (`THEME`, `EMOTION`) is quick and
  low-commitment, and `EMOTION` tags power the "I only know what I feel" entry
  ([frontend-plan §2](./frontend-plan.md#2-route-map)). Tagging never substitutes for a reviewed
  `SinQuote`/`GoodDeedQuote` link.
- **Who does this:** phase 5 via a REST client or `curl` against the admin endpoints; phase 6 via the curation
  UI. The API contract is identical, so the UI adds no new backend work.

### 4.3 Where automation is allowed (and where it is not)

| Allowed (later, as *suggestions* only) | Never automated |
| --- | --- |
| Surfacing candidate quotes for a sin by `EMOTION`/`THEME` tag overlap | Writing a `SinQuote` / `GoodDeedQuote` row |
| Keyword/embedding search over `textAr` to shortlist candidates for a curator's queue | Setting or adjusting `relevanceScore` |
| Flagging a link whose quote `grade` was downgraded by a later sync | Publishing an unreviewed link to users |

Any assisted-suggestion feature must write to a **separate** staging surface (a `status` column on a proposal
table — a future schema discussion), never directly into the join tables that `GET /v1/sins/:slug/quotes` reads.

---

## 5. Development seed plan (`prisma/seed.ts`)

**Not written in this task** — this is the specification for it. Purpose: `pnpm --filter backend exec prisma db seed`
gives a developer a database that renders the full frontend **before any provider integration exists**, so
phase 3 UI work does not block on phase 5 ingestion.

### 5.1 Mechanics

| Concern | Decision |
| --- | --- |
| Location | `backend/prisma/seed.ts` |
| Module format | **ESM** — `backend/package.json` has `"type": "module"`, so use `import` with `.js`-style specifiers where relative, and `import { PrismaClient } from '@prisma/client'`. |
| Runner | Node 24 strips TypeScript types natively, so `node prisma/seed.ts` should work. Verify once; if it does not, add `tsx` as a dev dependency and use `tsx prisma/seed.ts`. Do not add `ts-node` (CommonJS-oriented). |
| Registration | Prisma 6.19 prefers **`backend/prisma.config.ts`** (`migrations: { seed: 'node prisma/seed.ts' }`) over the legacy `package.json#prisma.seed` key. Check the installed CLI's expectation (`prisma --version` / docs) before committing; both are acceptable, only one should exist. |
| Idempotency | **Every write is an `upsert` keyed on a natural unique field** (`Sin.slug`, `GoodDeed.slug`, `Tag.slug`, `Source.name`, and for quotes a deterministic `LOCAL` identity — see below). Re-running the seed must not duplicate. |
| Quote identity | `Quote` has no natural unique key for `LOCAL` rows. Use **fixed UUID constants** declared at the top of the seed file (`const Q_HUJURAT_49_12 = '00000000-0000-4000-8000-000000000001'`) and `upsert` on `id`. This also makes the link upserts and the e2e fixtures deterministic. |
| Safety | Refuse to run when `NODE_ENV === 'production'` unless `SEED_ALLOW_PRODUCTION=true`. The seed writes curated content; running it against production would inject fake rows. |
| Structure | `seedSources() → seedTags() → seedSins() → seedGoodDeeds() → seedQuotes() → seedTranslations() → seedLinks() → seedUsers()`, each exported so the e2e helper can reuse a subset ([backend-plan §11.2](./backend-plan.md#112-e2e-tests)). |
| Output | A console summary per table (`sources: 5 upserted …`) so a developer can see it worked. |

### 5.2 Seed content (minimum viable library)

Scale target: **small but complete** — every screen must have something real to render, and at least one sin
must have enough quotes to exercise pagination, type filtering and the ordering rules.

**`Source` — 5 rows**

| `name` / `nameAr` | `type` | `isExternalApi` | Note |
| --- | --- | --- | --- |
| The Noble Qur'an / القرآن الكريم | `QURAN` | `false` | local seed verses |
| Sahih al-Bukhari / صحيح البخاري | `HADITH_COLLECTION` | `false` | |
| Sahih Muslim / صحيح مسلم | `HADITH_COLLECTION` | `false` | |
| Ibn al-Qayyim / ابن القيم | `SCHOLAR` | `false` | `author` set |
| Quran.com (API) | `QURAN` | **`true`** | `apiProvider='quran.com'`, `apiBaseUrl`, `lastSyncedAt = null` — exercises the `GET /v1/sources?isExternalApi=true` path and gives `POST /admin/content-sync/runs` a valid target before any adapter exists |

**`Sin` — 8 rows** (`slug` / `nameAr` / `severity`): `ghibah` الغيبة 4 · `namimah` النميمة 4 ·
`kadhib` الكذب 4 · `hasad` الحسد 3 · `riya` الرياء 5 · `qat-al-rahim` قطع الرحم 5 ·
`tark-as-salah` ترك الصلاة 5 · `ghadab` الغضب 2. Each with `category` (`speech`, `heart`, `worship`, `family`),
`description`/`descriptionAr`.

**`GoodDeed` — 8 rows**, with `oppositeSinId` wired where it is meaningful (this relation drives the
`alternatives` block, so it must be populated in the seed): `hifz-al-lisan` حفظ اللسان → `ghibah` ·
`sadaqah` الصدقة · `silat-ar-rahim` صلة الرحم → `qat-al-rahim` · `salat-fi-jamaah` صلاة الجماعة →
`tark-as-salah` · `ikhlas` الإخلاص → `riya` · `kaff-al-ghadab` كف الغضب → `ghadab` ·
`dhikr` الذكر · `birr-al-walidayn` بر الوالدين. All with `reward`/`rewardAr` populated — the reward callout is
the whole point of the motivation screen.

**`Tag` — ~12 rows** across all four `TagCategory` values, including at least 4 `EMOTION` tags
(`anger` الغضب, `despair` اليأس, `loneliness` الوحدة, `envy` الحسد) so `/feelings/[tagSlug]` works, plus `THEME`
tags (`forgiveness`, `patience`, `hereafter`, `tongue`).

**`Quote` — ~20 rows**, deliberately mixed so the client renders every variant:

| `type` | Count | Shape exercised |
| --- | --- | --- |
| `QURAN_VERSE` | 8 | `surahNumber`/`surahName`/`surahNameAr`/`ayahNumber` populated; `grade = NULL` — **this is what proves the grade filter does not drop verses** ([backend-plan §4.1](./backend-plan.md#41-one-query-path-for-both-intents)) |
| `HADITH` | 8 | `narrator`/`narratorAr`/`hadithReference`; grades spread across `SAHIH` (5), `HASAN` (2), `DAIF` (1) so default filtering and the weak-hadith opt-in are both visible. **No `MAWDU` row** — the app must never carry one. |
| `SCHOLAR_QUOTE` | 2 | `author` + the scholar `Source` |
| `BOOK_EXCERPT` | 2 | `bookTitle` + `pageOrChapter` |

Two rows should be `origin = API_CACHED` with a real-looking `apiProvider`/`externalId` (`quran.com` / `49:12`)
and a small `rawPayload`, to prove the serialiser never leaks `rawPayload`
([backend-plan §3.1](./backend-plan.md#31-shared-response-shapes)) and that the mixed-origin query path works.

**`Translation` — ~15 rows**: an `en` translation for most quotes, and **deliberately 3–4 quotes with none**, so
the UI's `translation: null` path is exercised in development rather than discovered in production.

**`SinQuote` / `GoodDeedQuote` — ~30 links total**, with intent:

- `ghibah` gets **12 links** spanning all four `QuoteType`s with scores `95, 92, 88, 80, 75, 70, 60, 55, 40, 30, 10, 0` — the one richly-populated intent, enough for page 2, type chips with non-trivial counts, `minScore`, and `shuffle`.
- One link with `relevanceScore = null` (the schema allows it) so **nulls-last ordering is exercised by the seed itself**.
- At least one quote linked to **both** a `Sin` and its opposite `GoodDeed`, so the cross-intent case is real.
- Every other sin/deed gets 2–4 links; **leave one sin and one deed with zero links** to exercise the empty state and the curator's "coverage gap" view.
- Notes written in the rubric's voice (§4.2) so the admin UI has realistic content.

**`User` — 2 rows** (phase 4): `user@thekra.local` (`role = USER`) and `admin@thekra.local`
(`role = ADMIN`), each with a known development password hashed with the chosen algorithm
([backend-plan §7.1](./backend-plan.md#71-decisions)). Before the `role`/`passwordHash` schema addition exists,
seed the two users without credentials and note it. **Development credentials only** — never in a non-local
environment, guarded by the `NODE_ENV` check in §5.1.

**`Favorite` — 3 rows** for `user@thekra.local`, so `/favorites` is non-empty on first run.

**`SyncLog` — 3 rows** against the Quran.com API source: one `SUCCESS`, one `FAILED` with a realistic
`errorMessage`, one `RUNNING` *(dated in the past, to exercise the stale-run reconciliation in §3.3)* — enough
for `GET /v1/admin/sync-logs` to be developed against real-looking data before any job exists.

### 5.3 Relationship to real ingestion

The seed is **development scaffolding, not content**. Its `LOCAL` rows use fixed UUIDs, so when phase 5
ingestion starts they are trivially distinguishable from `API_CACHED` rows and can be deleted or kept as the
curated core. Real content never arrives via the seed: it arrives either through
`POST /v1/admin/quotes` (curated) or through a sync run (cached). Keeping that boundary clean is what makes it
safe to re-run or drop the seed at any time.

---

## 6. Book sources (Phase 5b) — pointer

**Pointer only — the design is [vision-v2-plan.md §4–§5](./vision-v2-plan.md#5-book-import-pipeline-phase-5b).**
A third way content arrives, besides curation and provider sync: **per-work book importers** under
`backend/prisma/imports/<work>/`, outside the Nest module tree like this seed. Summary:

- **Never from the owner's PDFs** (scanned or encrypted; OCR is unacceptable for Quran/hadith text). The PDFs
  stay as verification copies; the same works are imported from clean digital Unicode texts (OpenITI versions,
  licence CC BY-NC-SA 4.0 for release 2023.1.8 — owner to accept). Per-work availability:
  [vision-v2 §4.2](./vision-v2-plan.md#4-the-owners-book-folder-and-digital-text-availability).
- One `Source` per work + edition; narrations become `HADITH` `Quote`s (`UNGRADED` unless the work is a licensed
  graded collection); prose works become curated `BOOK_EXCERPT`s, not bulk imports; `SyncLog` rows record each run.
- Idempotent on `@@unique([apiProvider, externalId])` with `apiProvider = 'book:<work>'`. **This needs an
  amendment to §2.5** ("`LOCAL` rows keep both keys `NULL`") — see
  [vision-v2 §5.4](./vision-v2-plan.md#54-idempotency-keys--consistency-check-with-content-pipeline-25) for the
  finding and the owner decision (V9).
- Importers write content only — never `SinQuote`, `GoodDeedQuote`, `ImanBranchQuote` or `QuoteTag` (§4.3 holds).
- Tafsir is cached from Quran.com by a new `content-sync` capability into the proposed `Explanation` model
  ([vision-v2 §3.2](./vision-v2-plan.md#32-quran-tafsir--cached-from-qurancom-verified)).

**Dorar (الدرر السنية):** this plan never relied on a Dorar API, and none exists for «موسوعة الأخلاق والسلوك».
Dorar's public API covers **hadith-encyclopedia search only**; it may be used as a manual curation aid, the ethics
encyclopedia is linked to (not copied), and importing its content needs Dorar's written permission
([vision-v2 §3.1](./vision-v2-plan.md#31-dorar-al-durar-al-saniyya--correcting-the-akhlaq-api-assumption)).
