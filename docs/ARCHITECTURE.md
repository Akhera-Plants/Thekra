# Thekra — Architecture

Thekra (تذكرة, "reminder") answers two requests at the moment they happen:

- *"I feel tempted to commit a sin"* → return content that **discourages** that specific sin.
- *"I want to do a good deed"* → return content that **motivates and rewards** that specific deed.

Everything in the architecture follows from that: the system's main job is to resolve **an intent** (a sin or a
good deed) into **a ranked set of trustworthy quotes**, in Arabic first, with provenance intact.

> **Phase status:** this phase delivers the repository structure, the tooling, and the data model only. No
> endpoints, services, UI, or sync jobs are implemented. The only authored code is
> [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

## 1. Data model

The schema lives in [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) and targets PostgreSQL via
Prisma.

### A single unified `Quote` table

Quran verses, Hadith, scholar quotes, and book excerpts are **all rows in one `Quote` table**, discriminated by
`type` (`QURAN_VERSE`, `HADITH`, `SCHOLAR_QUOTE`, `BOOK_EXCERPT`) and by `origin` (`LOCAL` vs `API_CACHED`).

Why one table instead of one per content kind:

- The core query is *"give me the content for this intent"* — it must not care whether the answer is a verse,
  a narration, or a line from a scholar. One table makes that a single indexed query instead of three queries
  plus an application-side merge.
- Ranking, tagging, translating, and favoriting are identical operations for every content kind. Separate
  tables would force each of those relations (and their join tables) to be duplicated per kind.
- Mixed result sets are the normal case: a reminder about a sin is usually a verse *and* a narration together.

The price is that kind-specific columns are nullable and only meaningful for some `type` values, grouped
deliberately in the model:

| Group               | Fields                                                         | Applies to      |
| ------------------- | -------------------------------------------------------------- | --------------- |
| Quran location      | `surahNumber`, `surahName`, `surahNameAr`, `ayahNumber`         | `QURAN_VERSE`   |
| Hadith provenance   | `narrator`, `narratorAr`, `grade`, `hadithReference`            | `HADITH`        |
| Book / scholar      | `bookTitle`, `author`, `pageOrChapter`                          | books, scholars |
| External ingestion  | `externalId`, `apiProvider`, `rawPayload`                       | `API_CACHED`    |

`textAr` is the one required text field — Arabic is the source of truth — and `@@index([type])` /
`@@index([sourceId])` support the common filters.

`grade` uses the `HadithGrade` enum (`SAHIH`, `HASAN`, `DAIF`, `MAWDU`, `UNGRADED`) so authenticity is a
first-class, queryable property. A reminder app must be able to refuse to show a weak or fabricated narration
as if it were authentic.

### `Source` — provenance for every quote

Every `Quote` belongs to exactly one `Source`: the Quran itself, a Hadith collection, a book, or a scholar
(`SourceType`). `Source` also carries the external-API metadata (`isExternalApi`, `apiProvider`, `apiBaseUrl`,
`lastSyncedAt`), so "where did this text come from, and was it fetched or curated?" is always answerable. No
quote is allowed to exist without attribution.

### `Translation` — Arabic first, translations attached

Translations are rows in a separate `Translation` table keyed by `(quoteId, languageCode)` rather than columns
on `Quote`. This allows any number of languages (and later, multiple translation sources per language) without
schema changes, and cascades on quote deletion.

### `Sin` and `GoodDeed` — the two intents

`Sin` and `GoodDeed` are the user-facing entry points, each with English and Arabic naming (`name`/`nameAr`), a
URL-safe `slug`, an optional `category`, and descriptive text. `Sin.severity` allows weighting how gravely a
sin is treated; `GoodDeed.reward`/`rewardAr` capture the promised reward that motivates the act.

They are linked to each other: `GoodDeed.oppositeSinId` (relation `OppositeOfSin`) points a deed at the sin it
displaces, so the app can answer temptation constructively — not only *"don't do this"* but *"do this
instead"*.

### `SinQuote` / `GoodDeedQuote` — the heart of the app

These two join tables are what make the product work:

- `SinQuote` links a quote to a sin it **discourages**.
- `GoodDeedQuote` links a quote to a good deed it **motivates**.

Both carry a `relevanceScore` (used to order results, so the strongest, most on-point reminder appears first)
and a `note` for the curator's reasoning. Both are unique on their pair, so a quote cannot be linked twice to
the same intent, and both cascade on delete.

Two separate join tables rather than one polymorphic table, because the semantics genuinely differ
(discouraging vs motivating) and each side gets real referential integrity.

### `Tag` / `QuoteTag` — cross-cutting retrieval

Tags provide a looser classification axis than the sin/deed link, categorized by `TagCategory`: `SIN`,
`GOOD_DEED`, `THEME`, `EMOTION`. The `EMOTION` category matters for the product: a user often knows what they
*feel* (anger, despair, loneliness) before they can name a sin, and tags let the app enter from the feeling.

### `SyncLog` — auditable ingestion

Each ingestion run against an external source is a `SyncLog` row with `SyncStatus`
(`PENDING`/`RUNNING`/`SUCCESS`/`FAILED`), `startedAt`/`finishedAt`, `recordsImported`, and `errorMessage`. Content
that users rely on religiously needs a verifiable import history rather than silent background mutation.

### `User` / `Favorite`

A minimal account model (`User`) with saved quotes (`Favorite`, unique per `(userId, quoteId)`, cascading).
Deliberately thin: authentication is not designed in this phase.

## 2. Dynamic-content strategy

Content reaches the database through two complementary paths, and both land in the same `Quote` table so
queries never branch on origin.

**1. Local curated content (`origin = LOCAL`).** Hand-picked, reviewed quotes tied to specific sins and good
deeds with deliberate `relevanceScore` values. This is the quality core: the sin→reminder and deed→motivation
mappings are editorial judgment, not something to be auto-generated.

**2. Cached external content (`origin = API_CACHED`).** Breadth comes from established providers:

| Content | Candidate providers                |
| ------- | ---------------------------------- |
| Quran   | Quran.com API, alquran.cloud       |
| Hadith  | Sunnah.com, HadithAPI              |

Each provider is a `Source` row with `isExternalApi = true` plus its `apiProvider` and `apiBaseUrl`. Fetched
quotes are stored with `origin = API_CACHED`, identified by `externalId`, and kept verbatim in `rawPayload` so
re-processing never requires re-fetching. The `@@unique([apiProvider, externalId])` constraint on `Quote` makes
imports **idempotent**: re-running an import upserts rather than duplicating. `Source.lastSyncedAt` plus
`SyncLog` records what ran, when, and with what result.

Design rules behind this:

- **Cache, don't proxy.** User requests are served from PostgreSQL, never by calling a third-party API inline.
  That keeps responses fast, keeps the app working when a provider is down or rate-limits, and makes results
  reproducible.
- **Ingestion is separate from classification.** Fetching text and deciding which sin it discourages are
  different jobs with different trust levels; the second always ends in human review.
- **Provenance is never lost.** Grade, narrator, reference, and provider survive ingestion, so the app can show
  the user exactly what they are reading and how reliable it is.

> The sync jobs themselves are **a later phase** and are not built now.
> [backend/src/modules/content-sync/](../backend/src/modules/content-sync/) reserves their place.

## 3. Repository layout

```
Thekra/
├── backend/     NestJS + TypeScript + Prisma, PostgreSQL. Owns the schema and will own the API.
│   ├── prisma/schema.prisma   the authoritative data model (the only authored code this phase)
│   └── src/modules/           placeholders: quran, hadith, sins, good-deeds, classification, content-sync
├── frontend/    Next.js (App Router) + TypeScript + Tailwind. Generator defaults only.
│   └── src/features/          placeholders: sin-reminder, good-deed-motivation,
│                              quran-hadith-browser, favorites (+ src/lib for the future API client)
├── mobile/      README only — React Native + Expo app planned for a later phase.
└── docs/        this document.
```

**Backend** is the single source of truth: it owns the database, content ingestion, and the classification that
maps content to intents. **Frontend** and the future **mobile** app are both clients of the same HTTP API, with
no private data store and no duplicated business rules, so a change to how reminders are ranked ships once.

Managed as a **pnpm workspace** (`pnpm-workspace.yaml`) with local PostgreSQL 16 via
[docker-compose.yml](../docker-compose.yml). `mobile` joins the workspace when it is scaffolded.

## 4. Deliberately not decided yet

Authentication and authorization, API shape (REST vs GraphQL), caching/rate limiting, search (Postgres
full-text vs a dedicated engine) for Arabic text, and the admin/curation interface for classification.
