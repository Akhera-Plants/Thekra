# Thekra — Backend Implementation Plan

> Scope: NestJS + TypeScript + Prisma + PostgreSQL API in [`backend/`](../../backend/).
> Data model is **final for phase 1** — see [docs/ARCHITECTURE.md](../ARCHITECTURE.md) and
> [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma). This document never redesigns it; where a
> field is genuinely missing for a feature it is listed under [§9 Proposed schema
> additions](#9-proposed-schema-additions) and nowhere else.
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [content-pipeline-plan.md](./content-pipeline-plan.md) ·
> [frontend-plan.md](./frontend-plan.md) · [devops-plan.md](./devops-plan.md) · [roadmap.md](./roadmap.md)

---

## 0. Ground rules taken from the existing repo (do not re-derive)

These are facts about the scaffolded backend, verified against the files. They constrain how every module below
must be written.

| Fact | Consequence for implementation |
| --- | --- |
| `backend/package.json` has `"type": "module"` | **ESM only.** Every relative import must carry the `.js` extension (`./app.service.js`), exactly like [`src/main.ts`](../../backend/src/main.ts) and [`src/app.module.ts`](../../backend/src/app.module.ts) already do. |
| `tsconfig.json` uses `"module": "nodenext"`, `"moduleResolution": "nodenext"` | No CommonJS `require`; no extensionless relative imports. `emitDecoratorMetadata` + `experimentalDecorators` are on, so `class-validator` + `@nestjs/common` decorators work as normal. |
| `"strictPropertyInitialization": false` | DTO classes can declare `field!: string` style properties without initializers — write DTOs as plain classes with decorators, no constructors. |
| NestJS v12 packages: `@nestjs/common`, `core`, `config`, `axios`, `platform-express` already installed | `ConfigModule` and `HttpModule` are available with **no new dependency**. Everything else listed in §10 must be installed as an explicit step. |
| Validation libs `class-validator` + `class-transformer` already installed | `ValidationPipe` can be wired on day one (§6). |
| Tests run on **Vitest 4** with `globals: true`; `vitest.config.ts` picks up `**/*.spec.ts`, `vitest.config.e2e.ts` picks up `**/*.e2e-spec.ts` | Unit specs live next to the service (`*.spec.ts`), e2e specs live in `backend/test/*.e2e-spec.ts`. Do not add Jest. |
| Lint is **oxlint** (`pnpm --filter backend lint`), not ESLint | Keep code oxlint-clean; no `.eslintrc` for the backend. |
| `backend/.env.example` sets `PORT=3000`, and `frontend/.env.example` sets `NEXT_PUBLIC_API_URL="http://localhost:3000"` | **Port collision with `next dev`.** See [devops-plan §5](./devops-plan.md#5-secrets--configuration-management) — the plan is to move the API to `3001` and update both `.env.example` files in the same commit that adds the first real endpoint. |
| `backend/src/modules/*` currently contains only `README.md` files | Each module folder is filled in place. **Folder names must not be renamed** (`quran`, `hadith`, `sins`, `good-deeds`, `classification`, `content-sync`). |
| No `PrismaClient` provider exists yet | The first thing to build is the `prisma` infrastructure module (§1.1). Nothing else can be built before it. |

---

## 1. Module map

Target layout. **Existing** folders are filled in; **new** folders are added alongside them.

```
backend/src/
├── main.ts                      # bootstrap: global prefix, ValidationPipe, filter, CORS, shutdown hooks
├── app.module.ts                # imports every module below
├── prisma/                      # NEW  infrastructure: PrismaService
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/                      # NEW  cross-cutting, no HTTP surface of its own
│   ├── dto/pagination-query.dto.ts
│   ├── dto/locale-query.dto.ts
│   ├── interceptors/response-envelope.interceptor.ts
│   ├── filters/all-exceptions.filter.ts
│   ├── pipes/   (ParseSlugPipe, ParseUuidPipe usage helpers)
│   ├── decorators/current-user.decorator.ts, roles.decorator.ts, public.decorator.ts
│   ├── text/arabic-normalizer.ts        # tashkeel/hamza/alef normalisation for search
│   └── mappers/quote.mapper.ts          # Prisma Quote -> QuoteDto (shared by many modules)
├── health/                      # NEW  GET /health, GET /health/ready
└── modules/
    ├── quran/                   # EXISTING placeholder
    ├── hadith/                  # EXISTING placeholder
    ├── sins/                    # EXISTING placeholder
    ├── good-deeds/              # EXISTING placeholder
    ├── classification/          # EXISTING placeholder  (admin linking + tag vocabulary)
    ├── content-sync/            # EXISTING placeholder  (providers, cron, SyncLog)
    ├── quotes/                  # NEW
    ├── sources/                 # NEW
    ├── tags/                    # NEW
    ├── auth/                    # NEW
    ├── users/                   # NEW  (thin; owned by auth flows)
    ├── favorites/               # NEW
    └── kinship/                 # NEW  Phase 4b, PROPOSED (owner approval) — §1.13, silat-rahim-plan.md
```

Per-module file convention (same for all): `<name>.module.ts`, `<name>.controller.ts` (and
`<name>.admin.controller.ts` where admin routes exist), `<name>.service.ts`, `dto/`, `entities/` (response
DTO/shape classes), `<name>.service.spec.ts`.

### 1.1 `prisma/` — infrastructure (build first)

| Item | Detail |
| --- | --- |
| Responsibility | Single `PrismaClient` instance for the whole app; connection lifecycle; transaction helper. |
| Prisma models | All (it *is* the client). |
| Public exports | `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` — `onModuleInit()` calls `this.$connect()`. `PrismaModule` is `@Global()` so no other module repeats the import. |
| Notes | `main.ts` must call `app.enableShutdownHooks()` so Nest closes the pool on SIGTERM (needed for the container deploys in [devops-plan](./devops-plan.md)). Prisma 6 no longer supports `$on('beforeExit')` for this. |

### 1.2 `modules/sins/` — the "I feel tempted" intent (core loop, half the product)

| Item | Detail |
| --- | --- |
| Responsibility | The `Sin` catalogue, and resolving one sin into the ranked set of quotes that **discourage** it. Also surfaces the constructive alternative (`Sin.relatedGoodDeeds`). |
| Owns (writes) | `Sin` |
| Reads | `SinQuote`, `Quote`, `Source`, `Translation`, `QuoteTag`, `Tag`, `GoodDeed` (for alternatives) |
| Public exports | `SinsService` (`findAll`, `findBySlug`, `findQuotesForSin`, `findAlternatives`), `SinsModule`. `SinsService` is exported because `classification` validates sin existence before writing a link. |
| Controllers | `SinsController` (public reads), `SinsAdminController` (CRUD, admin role) |
| Depends on | `QuotesService` (for the shared quote projection + locale/translation handling), `PrismaService` |

### 1.3 `modules/good-deeds/` — the "I want to do a good deed" intent (core loop, other half)

| Item | Detail |
| --- | --- |
| Responsibility | The `GoodDeed` catalogue, and resolving one deed into the ranked set of quotes that **motivate** it; exposes `reward`/`rewardAr` and the `oppositeSin` back-link. |
| Owns (writes) | `GoodDeed` |
| Reads | `GoodDeedQuote`, `Quote`, `Source`, `Translation`, `Sin` (via `oppositeSinId`) |
| Public exports | `GoodDeedsService` (`findAll`, `findBySlug`, `findQuotesForGoodDeed`, `findByOppositeSinId`), `GoodDeedsModule` |
| Controllers | `GoodDeedsController`, `GoodDeedsAdminController` |
| Notes | `findByOppositeSinId` is what `SinsService.findAlternatives()` calls — the import direction is `sins → good-deeds` only, never circular. |

### 1.4 `modules/quotes/` — the unified content surface

| Item | Detail |
| --- | --- |
| Responsibility | Everything that treats a `Quote` as a `Quote` regardless of `type`: detail lookup, browse/search with filters, the **canonical `QuoteDto` projection** (including translation selection by locale), and the shared `orderBy` / `include` builders reused by `sins`, `good-deeds`, `quran`, `hadith`, `tags`. |
| Owns (writes) | `Quote`, `Translation` (admin paths) |
| Reads | `Source`, `Tag`, `QuoteTag`, `SinQuote`, `GoodDeedQuote` |
| Public exports | `QuotesService` (`findById`, `search`, `buildQuoteInclude(locale)`, `toQuoteDto(row, locale)`, `linkOrderBy()`), `QuotesModule`, `QuoteDto` type |
| Controllers | `QuotesController`, `QuotesAdminController` (create/update/delete + translations + tag assignment) |
| Notes | This module is the reason the schema has one `Quote` table — keep the projection in exactly one place so a change to how a quote is rendered ships once. |

### 1.5 `modules/quran/` — Quran-specific reads

| Item | Detail |
| --- | --- |
| Responsibility | Reads `Quote` rows with `type = QURAN_VERSE`; surah/ayah lookups and surah index derived from `surahNumber`/`surahName`/`surahNameAr`/`ayahNumber`. **Database reads only** — never calls a provider inline. |
| Owns | nothing (projection over `Quote`) |
| Reads | `Quote`, `Source`, `Translation` |
| Public exports | `QuranService` (`listSurahs`, `findAyahsBySurah`, `findAyah`), `QuranModule` |
| Notes | `listSurahs` is a `groupBy({ by: ['surahNumber','surahName','surahNameAr'], _count: true })` over cached verses — it reports *what has been ingested*, not the canonical 114. Cache it in-process for 60 s (phase 2) since it is a pure aggregate. |

### 1.6 `modules/hadith/` — Hadith-specific reads + grade policy

| Item | Detail |
| --- | --- |
| Responsibility | Reads `Quote` rows with `type = HADITH` with `narrator`/`narratorAr`/`grade`/`hadithReference` joined to their collection `Source`; owns the **grade policy** (see §4.3) that every other module calls. |
| Owns | nothing |
| Reads | `Quote`, `Source`, `Translation` |
| Public exports | `HadithService` (`findAll`, `findById`, `listCollections`), `GradePolicy` (`defaultAllowedGrades()`, `assertRenderable(grade)`), `HadithModule` |
| Notes | The grade policy is **a product requirement, not a filter convenience**: `MAWDU` (fabricated) must never appear in a sin/deed reminder response, and `DAIF` only when explicitly requested. `sins` and `good-deeds` import `GradePolicy`. |

### 1.7 `modules/classification/` — curator linking + tag vocabulary (admin only)

| Item | Detail |
| --- | --- |
| Responsibility | The deliberate editorial step: writing/updating/removing `SinQuote` and `GoodDeedQuote` links with `relevanceScore` and `note`, and maintaining `Tag`/`QuoteTag`. No automation in phase 2 — see [content-pipeline-plan §4](./content-pipeline-plan.md#4-curation-workflow-human-editorial-step). |
| Owns (writes) | `SinQuote`, `GoodDeedQuote`, `QuoteTag` |
| Reads | `Sin`, `GoodDeed`, `Quote`, `Tag` |
| Public exports | `ClassificationService` (`linkSinQuote`, `updateSinLink`, `unlinkSinQuote`, `bulkLinkSinQuotes`, and the `GoodDeed` equivalents, `setQuoteTags`), `ClassificationModule` |
| Controllers | `ClassificationAdminController` — **every route is admin-guarded, there is no public surface.** |
| Notes | All writes are idempotent against the `@@unique([sinId, quoteId])` / `@@unique([goodDeedId, quoteId])` constraints: use `prisma.sinQuote.upsert` so a curator re-submitting a link updates the score instead of 500-ing on P2002. |

### 1.8 `modules/content-sync/` — ingestion orchestration

| Item | Detail |
| --- | --- |
| Responsibility | Provider adapters, the scheduled/manual ingestion runs, idempotent upserts into `Quote`, and `SyncLog` bookkeeping. Full design in [content-pipeline-plan.md](./content-pipeline-plan.md). |
| Owns (writes) | `SyncLog`, `Source.lastSyncedAt`; writes `Quote` rows with `origin = API_CACHED` |
| Reads | `Source`, `Quote` |
| Public exports | `ContentSyncService` (`triggerRun(dto)`, `getRunStatus(id)`), `SyncLogService` (`findAll`, `findById`), `ContentSyncModule`; internal `QuranComProvider`, `SunnahProvider` implementing a `ContentProvider` interface |
| Controllers | `ContentSyncAdminController` (manual trigger + `SyncLog` listing), admin-guarded |

### 1.9 `modules/tags/` and `modules/sources/`

| Module | Responsibility | Owns | Public exports |
| --- | --- | --- | --- |
| `tags` | Read the `Tag` vocabulary by `TagCategory`; the `EMOTION` category is a **first-class product entry point** ("I feel angry / hopeless / lonely") when the user cannot name a sin. Admin CRUD for tags. | `Tag` | `TagsService` (`findAll`, `findBySlug`, `findByCategory`), `TagsModule` |
| `sources` | Read provenance (`Source`), list Hadith collections / books / scholars; admin CRUD including `isExternalApi`, `apiProvider`, `apiBaseUrl`. | `Source` | `SourcesService` (`findAll`, `findById`, `findByProvider`), `SourcesModule` — `content-sync` resolves its target `Source` through this. |

### 1.10 `modules/auth/`, `modules/users/`, `modules/favorites/`

| Module | Responsibility | Owns | Public exports |
| --- | --- | --- | --- |
| `auth` | Register/login/refresh/me. JWT issuance + verification, password hashing, `JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`. | — (delegates to `users`) | `AuthService`, `JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()`, `AuthModule` |
| `users` | `User` persistence: `findByEmail`, `create`, `findById`, `touchLastLogin`. Deliberately thin, no public HTTP surface in phase 4 (profile editing is out of scope). | `User` | `UsersService`, `UsersModule` |
| `favorites` | A signed-in user's saved quotes, unique per `(userId, quoteId)`. | `Favorite` | `FavoritesService` (`list`, `add`, `remove`, `listQuoteIds`), `FavoritesModule` |

### 1.11 `health/`

`GET /health` (liveness, no DB) and `GET /health/ready` (readiness: `SELECT 1` via `prisma.$queryRaw`).
Both are `@Public()` and **excluded from the `/v1` prefix** so platform probes keep a stable path — see
[devops-plan §6](./devops-plan.md#6-health-checks-and-rollback).

### 1.12 `app.module.ts` import order

```ts
// backend/src/app.module.ts (target shape — note the .js specifiers, this project is ESM)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    PrismaModule,          // @Global()
    HealthModule,
    AuthModule, UsersModule, FavoritesModule,
    QuotesModule, SourcesModule, TagsModule,
    SinsModule, GoodDeedsModule,
    QuranModule, HadithModule,
    ClassificationModule,
    ContentSyncModule,     // imports ScheduleModule.forRoot() internally
  ],
})
export class AppModule {}
```

### 1.13 `modules/kinship/` — Phase 4b (proposed)

**Pointer only — the full design is [silat-rahim-plan.md](./silat-rahim-plan.md#6-backend-module-placement).**
It is a proposed addition requiring owner approval, and the one new module Phase 4b adds.

| Item | Detail |
| --- | --- |
| Responsibility | A signed-in user's private kinship list (صلة الرحم), contact logs, forgotten-deed reminders, the due list, and the token-authenticated `text/calendar` feed. `nextDueOn` is computed on write — no scheduler. |
| Owns (writes) | `Relative`, `ContactLog`, `DeedReminder` (proposed, §9.1); `User.calendarFeed*` only through new `UsersService` methods |
| Depends on | `users`, `good-deeds` (one-way). `auth → kinship` for the account export only. |
| Registered | In `app.module.ts` after `FavoritesModule`. |

Forgotten deeds add **no** module: they are a `THEME` tag plus `good-deeds` reads (`tag` filter on #5,
`GET /good-deeds/spotlight`).

### 1.14 `modules/iman-branches/` — Phase 3b (proposed)

**Pointer only — the full design is [vision-v2-plan.md §8](./vision-v2-plan.md#8-backend-module-placement).**
A proposed addition requiring owner approval and a `.cursorrules` module-list update; the one new module of
Phase 3b. Owns `ImanBranch`, `ImanBranchGoodDeed`, `ImanBranchSin`; reads quotes only through `QuotesService`;
depends on `quotes`, `hadith` (`GradePolicy`), `sources`; `sins`/`good-deeds`/`classification` → `iman-branches`
(one-way). Phase 3b also extends existing modules without new folders: `classification` (`ImanBranchQuote` links),
`quotes` (`Explanation`), `sources` (`ExternalReference`), `sins` (`Sin.rank`), `content-sync` (tafsir, Phase 5b).
Book importers live in `backend/prisma/imports/` (Phase 5b), outside the module tree.

---

## 2. Global API conventions

### 2.1 Versioning

Global prefix `/v1` via `app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] })` in `main.ts`.
URI versioning, not header versioning: it is debuggable from a browser and cache/CDN-friendly. A future `/v2`
is a new controller folder, never a mutation of a `/v1` response shape.

### 2.2 Response envelope

Shape: `{ data, meta }`.

**Decision: always-enveloped responses.** Every successful response body is an object with `data`, plus `meta`
when the payload is a collection. Rationale: clients never have to branch on "is this an array or an object",
and adding pagination or a `locale` echo later never breaks a consumer.

```jsonc
// single resource
{ "data": { "id": "…", "slug": "ghibah" } }

// collection
{
  "data": [ /* … */ ],
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3, "hasNext": true, "locale": "ar" }
}
```

Implemented as a global `ResponseEnvelopeInterceptor`: if the handler returns `{ data, meta }` already (the
convention for paginated services) it passes through; otherwise it wraps the value in `{ data }`. Handlers
returning `204` are left untouched.

### 2.3 Pagination — `page` / `limit` (offset)

**Decision: offset pagination (`?page=1&limit=20`) for phase 2.** Justification: the catalogues are small and
bounded (tens of sins, tens of deeds, a few hundred curated quotes), the curation UI in phase 6 needs
"page 7 of 23" and a total count, and offset is a one-line `skip`/`take` in Prisma. Keyset/cursor pagination is
noted as a **phase 5+ upgrade for `/v1/quotes` only**, once `API_CACHED` ingestion pushes that table past
~100k rows and `COUNT(*)` gets expensive.

`PaginationQueryDto` (in `common/dto/`): `page` default `1`, min `1`; `limit` default `20`, min `1`, **max
`100`** (hard cap, enforced in the DTO, not the service). Shared `PaginatedResult<T> = { data: T[]; meta: PageMeta }`
helper so no module hand-rolls the maths.

### 2.4 Locale and translations

Every read endpoint accepts `?lang=ar|en` (`LocaleQueryDto`, default `ar`, fallback order `lang → Accept-Language
→ ar`). `textAr` is **always** returned — it is the source of truth and must never be hidden. When `lang !== 'ar'`
the matching `Translation` row is attached as `translation: { languageCode, text } | null`. Never silently
substitute a translation for the Arabic.

### 2.5 Errors — exception filter shape

Global `AllExceptionsFilter` (`app.useGlobalFilters(...)`) normalises everything — `HttpException`,
`Prisma.PrismaClientKnownRequestError`, and unknown throwables — into one shape:

```jsonc
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [ { "field": "relevanceScore", "constraint": "max", "message": "must not exceed 100" } ],
    "path": "/v1/admin/sin-quotes",
    "method": "POST",
    "requestId": "01J9…",
    "timestamp": "2025-01-14T09:21:33.120Z"
  }
}
```

`code` is a stable `SCREAMING_SNAKE` string the frontend may switch on; `message` is human text and may be
localised later. Prisma error translation table:

| Prisma code | HTTP | `error.code` |
| --- | --- | --- |
| `P2002` unique violation | `409` | `RESOURCE_ALREADY_EXISTS` |
| `P2003` FK violation | `422` | `RELATED_RESOURCE_INVALID` |
| `P2025` record not found | `404` | `RESOURCE_NOT_FOUND` |
| anything else | `500` | `INTERNAL_ERROR` (message replaced with a generic string; real error logged with `requestId`) |

Never leak a Prisma message or stack trace in a `5xx` body.

### 2.6 Status code policy

| Situation | Code |
| --- | --- |
| Successful read | `200` |
| Successful create | `201` + `Location` header |
| Successful update (`PATCH`/`PUT`) | `200` with the updated resource |
| Successful delete / unlink | `204`, empty body |
| DTO validation failure | `400` `VALIDATION_FAILED` |
| Missing/expired token on a protected route | `401` `UNAUTHENTICATED` |
| Valid token, insufficient role | `403` `FORBIDDEN` |
| Unknown `id`/`slug` | `404` `RESOURCE_NOT_FOUND` |
| Duplicate link / duplicate favorite / duplicate email | `409` |
| Semantically invalid reference (e.g. `quoteId` does not exist) | `422` |
| Rate limit exceeded | `429` |
| Sync already running for that source | `409` `SYNC_ALREADY_RUNNING` |

### 2.7 Other global conventions

- **ValidationPipe** (global): `{ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }`. Implicit conversion is what lets `?page=2` arrive as a `number`.
- **CORS**: `app.enableCors({ origin: config.CORS_ORIGINS.split(','), credentials: true })`.
- **Request id**: a tiny middleware sets `x-request-id` (honouring an inbound one) and the logger binds it (§8).
- **Rate limiting**: `@nestjs/throttler` global guard, generous default (e.g. 120 req/min/IP), tightened on `/v1/auth/*` (10/min) — phase 4.
- **Compression / helmet**: `compression` + `helmet` in `main.ts`, phase 5 hardening.
- **IDs**: all resource ids are **UUID strings** (`@default(uuid())`), validated with `ParseUUIDPipe`. `Sin`, `GoodDeed`, and `Tag` are addressed publicly by `slug` (human-readable URLs, matching `@unique` on `slug`); everything else by `id`.

---

## 3. REST API spec

**Decision: REST, not GraphQL** (justified in [TECHNICAL_PLAN Open Decisions](../TECHNICAL_PLAN.md#open-decisions--assumptions)).
All paths below are relative to `/v1`. Auth column: `public` = no token; `user` = valid access token;
`admin` = valid access token with `role = ADMIN`; `optional` = works without a token but enriches the response
when one is present.

### 3.0 Endpoint index

| # | Method | Path | Auth |
| --- | --- | --- | --- |
| 1 | GET | `/sins` | public |
| 2 | GET | `/sins/:slug` | public |
| 3 | **GET** | **`/sins/:slug/quotes`** | optional |
| 4 | GET | `/sins/:slug/good-deeds` | public |
| 5 | GET | `/good-deeds` | public |
| 6 | GET | `/good-deeds/:slug` | public |
| 7 | **GET** | **`/good-deeds/:slug/quotes`** | optional |
| 8 | GET | `/quotes` | optional |
| 9 | GET | `/quotes/:id` | optional |
| 10 | GET | `/quran/surahs` | public |
| 11 | GET | `/quran/surahs/:surahNumber/ayahs` | public |
| 12 | GET | `/quran/ayahs/:surahNumber/:ayahNumber` | public |
| 13 | GET | `/hadith` | public |
| 14 | GET | `/hadith/collections` | public |
| 15 | GET | `/tags` | public |
| 16 | GET | `/tags/:slug` | public |
| 17 | GET | `/sources` | public |
| 18 | GET | `/sources/:id` | public |
| 19 | POST | `/auth/register` | public |
| 20 | POST | `/auth/login` | public |
| 21 | POST | `/auth/refresh` | public (refresh token) |
| 22 | GET | `/auth/me` | user |
| 23 | POST | `/auth/logout` | user |
| 24 | GET | `/favorites` | user |
| 25 | GET | `/favorites/quote-ids` | user |
| 26 | POST | `/favorites` | user |
| 27 | DELETE | `/favorites/:quoteId` | user |
| 28–31 | POST/PATCH/DELETE | `/admin/quotes…` | admin |
| 32–34 | PUT/POST/DELETE | `/admin/quotes/:id/translations…` | admin |
| 35 | PUT | `/admin/quotes/:id/tags` | admin |
| 36–38 | POST/PATCH/DELETE | `/admin/sins…` | admin |
| 39–41 | POST/PATCH/DELETE | `/admin/good-deeds…` | admin |
| 42–44 | POST/PATCH/DELETE | `/admin/sources…` | admin |
| 45–47 | POST/PATCH/DELETE | `/admin/tags…` | admin |
| 48 | **POST** | **`/admin/sin-quotes`** | admin |
| 49 | GET | `/admin/sin-quotes` | admin |
| 50 | PATCH | `/admin/sin-quotes/:id` | admin |
| 51 | DELETE | `/admin/sin-quotes/:id` | admin |
| 52 | POST | `/admin/sin-quotes/bulk` | admin |
| 53–57 | — | `/admin/good-deed-quotes…` (same five) | admin |
| 58 | POST | `/admin/content-sync/runs` | admin |
| 59 | GET | `/admin/sync-logs` | admin |
| 60 | GET | `/admin/sync-logs/:id` | admin |
| 61 | GET | `/health`, `/health/ready` (unprefixed) | public |
| 62–83 | various | **Phase 4b, proposed:** `/kinship/*` (#62–#79), `GET /kinship/calendar/feeds/:token.ics` (#80, `text/calendar`), `GET /good-deeds/spotlight` (#81), `GET /auth/me/export` (#82), `DELETE /auth/me` (#83); plus an additive `tag` filter on #5 — specified in [silat-rahim-plan §5](./silat-rahim-plan.md#5-rest-api) | user / token / public |
| 84–103 | various | **Phase 3b, proposed:** `/branches` (#84), `/branches/:number` (#85), `/branches/:number/quotes` (#86, optional auth, grade policy as #3), `/quotes/:id/explanations` (#87), `/admin/branches…` (#88–#90, #96), `/admin/branch-quotes…` (#91–#95), `/admin/explanations…` (#97–#100), `/admin/external-refs…` (#101–#103); plus additive `rank`/`externalRefs`/`relatedBranches` on #1–#3/#6 and a `chapter` admin filter — specified in [vision-v2-plan §7](./vision-v2-plan.md#7-rest-api) | public / optional / admin |

---

### 3.1 Shared response shapes

#### `QuoteDto` — the one quote projection (produced by `QuotesService.toQuoteDto`)

Fields map 1:1 onto `Quote` columns. Kind-specific groups are nested and are `null` when `type` does not apply —
this is the discriminated shape the frontend switches on.

```jsonc
{
  "id": "6f1c…",
  "type": "HADITH",                     // QuoteType: QURAN_VERSE | HADITH | SCHOLAR_QUOTE | BOOK_EXCERPT
  "origin": "LOCAL",                    // QuoteOrigin: LOCAL | API_CACHED
  "textAr": "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه",
  "translation": { "languageCode": "en", "text": "None of you believes until…" },  // null when lang=ar or missing
  "quran": null,                        // present only for QURAN_VERSE
  "hadith": {                           // present only for HADITH
    "narrator": "Anas ibn Malik",
    "narratorAr": "أنس بن مالك",
    "grade": "SAHIH",                   // HadithGrade
    "reference": "Bukhari 13"           // Quote.hadithReference
  },
  "book": null,                         // { bookTitle, author, pageOrChapter } for BOOK_EXCERPT / SCHOLAR_QUOTE
  "source": {
    "id": "a0b…", "name": "Sahih al-Bukhari", "nameAr": "صحيح البخاري",
    "type": "HADITH_COLLECTION", "author": null, "authorAr": null,
    "isExternalApi": true, "apiProvider": "sunnah.com"
  },
  "tags": [ { "id": "…", "slug": "sincerity", "name": "Sincerity", "nameAr": "الإخلاص", "category": "THEME" } ],
  "external": { "apiProvider": "sunnah.com", "externalId": "bukhari:13" },  // null for LOCAL; rawPayload NEVER exposed
  "isFavorite": true,                   // only when the request carried a token (optional auth); otherwise omitted
  "createdAt": "2025-01-02T10:00:00.000Z",
  "updatedAt": "2025-01-09T08:12:00.000Z"
}
```

Rules: `rawPayload` is **never** serialised to a client (internal re-processing only). `translation` is a single
object, not an array, on read endpoints; the full `translations[]` array is returned only by `GET /quotes/:id?includeAllTranslations=true`.

#### `SinDto` / `GoodDeedDto`

```jsonc
// SinDto
{ "id": "…", "name": "Backbiting", "nameAr": "الغيبة", "slug": "ghibah",
  "category": "speech", "description": "…", "descriptionAr": "…", "severity": 4,
  "quoteCount": 12,                       // _count.quotes (SinQuote rows)
  "createdAt": "…", "updatedAt": "…" }

// GoodDeedDto
{ "id": "…", "name": "Guarding the tongue", "nameAr": "حفظ اللسان", "slug": "hifz-al-lisan",
  "category": "speech", "description": "…", "descriptionAr": "…",
  "reward": "…", "rewardAr": "…",
  "oppositeSin": { "id": "…", "slug": "ghibah", "name": "Backbiting", "nameAr": "الغيبة" },  // or null
  "quoteCount": 9, "createdAt": "…", "updatedAt": "…" }
```

---

### 3.2 Core loop A — sins

#### 1. `GET /sins` — catalogue

- **Auth:** public
- **Query:** `page`, `limit`, `lang`, `category?` (string), `severityMin?`/`severityMax?` (int 1–10), `q?` (free text over `name`/`nameAr`), `sort?` = `name|severity|quoteCount` (default `name`)
- **Response `200`:** `{ data: SinDto[], meta: PageMeta }`
- **Prisma:** `sin.findMany({ where, orderBy, skip, take, include: { _count: { select: { quotes: true } } } })`
- **Notes:** `q` runs through the Arabic normaliser (§4.4) so "الغيبه" matches "الغيبة". Sins with
  `quoteCount = 0` are still returned but the frontend may dim them — do **not** hide them server-side, the
  curator needs to see the gap.
- **Codes:** `200`, `400`

#### 2. `GET /sins/:slug` — detail

- **Auth:** public · **Params:** `slug` · **Query:** `lang`
- **Response `200`:** `{ data: SinDto & { relatedGoodDeeds: GoodDeedSummary[] } }` where `GoodDeedSummary = { id, slug, name, nameAr, reward, rewardAr }` (from `Sin.relatedGoodDeeds`, the `OppositeOfSin` relation)
- **Codes:** `200`, `404 RESOURCE_NOT_FOUND`

#### 3. `GET /sins/:slug/quotes` — **the core endpoint of the product**

This is the request behind *"I feel tempted to commit a sin"*. It must be the fastest, most deliberate endpoint
in the system.

- **Auth:** optional (`OptionalJwtAuthGuard`) — anonymous users get the full response; a token only adds `isFavorite`
- **Params:** `slug` — the `Sin.slug`
- **Query (`SinQuotesQueryDto`):**

| Param | Type | Default | Meaning |
| --- | --- | --- | --- |
| `limit` | int 1–50 | `10` | How many quotes to return |
| `page` | int ≥1 | `1` | Offset page (the "show me more reminders" path) |
| `lang` | `ar\|en` | `ar` | Translation to attach |
| `type` | `QuoteType[]` (repeatable or CSV) | all | e.g. `?type=QURAN_VERSE&type=HADITH` |
| `grades` | `HadithGrade[]` | `SAHIH,HASAN` | Applies **only** to `HADITH` rows; see §4.3 |
| `includeWeak` | boolean | `false` | Convenience for `grades=SAHIH,HASAN,DAIF`. `MAWDU` is never selectable. |
| `minScore` | int | — | Only links with `relevanceScore >= minScore` |
| `shuffle` | boolean | `false` | Deterministic variety mode — see §4.2 |
| `seed` | string | — | Seed for `shuffle`, so "another reminder" is reproducible/pageable |

- **Response `200`:**

```jsonc
{
  "data": {
    "sin": { "id": "…", "slug": "ghibah", "name": "Backbiting", "nameAr": "الغيبة", "severity": 4,
             "description": "…", "descriptionAr": "…" },
    "items": [
      {
        "link": { "id": "l1…", "relevanceScore": 95, "note": "Direct prohibition, Surah al-Hujurat" },
        "quote": { /* QuoteDto — type=QURAN_VERSE here */ }
      },
      {
        "link": { "id": "l2…", "relevanceScore": 90, "note": "Consequence in the hereafter" },
        "quote": { /* QuoteDto — type=HADITH, hadith.grade=SAHIH */ }
      }
    ],
    "alternatives": [
      { "id": "…", "slug": "hifz-al-lisan", "name": "Guarding the tongue", "nameAr": "حفظ اللسان",
        "reward": "…", "rewardAr": "…" }
    ]
  },
  "meta": {
    "page": 1, "limit": 10, "total": 12, "totalPages": 2, "hasNext": true,
    "locale": "ar",
    "ordering": "relevanceScore:desc,grade:asc,createdAt:desc",
    "countsByType": { "QURAN_VERSE": 5, "HADITH": 6, "SCHOLAR_QUOTE": 1, "BOOK_EXCERPT": 0 },
    "appliedGrades": ["SAHIH", "HASAN"]
  }
}
```

**Shape decisions, and why** (this is the "mixed quote types in one response" question):

1. **One flat `items[]`, not `{ verses, hadiths, scholars }` buckets.** The ranking is cross-type by design —
   the strongest reminder for backbiting may be a narration, and splitting by type would destroy the
   `relevanceScore` order that *is* the product. Clients switch on `item.quote.type` to choose a card variant.
2. **`link` is a sibling of `quote`, not merged into it.** `relevanceScore`/`note` belong to the *relationship*
   (`SinQuote`), not to the quote: the same quote can score 95 for one sin and 40 for another. Keeping them
   separate stops a client from caching a quote with a score baked in.
3. **`meta.countsByType`** is computed over the whole filtered link set (not just the page) so the UI can render
   type filter chips with counts without a second request.
4. **`alternatives`** is embedded (capped at 3) because the product's answer to temptation is "do this instead" —
   making the client fire a second request for it would mean the constructive half of the answer arrives late or
   not at all. Full list stays available at endpoint 4.
5. **`meta.ordering`** is echoed literally so a reviewer/curator can confirm what ranking produced a screen.

- **Ordering (exact):**

```ts
// SinQuote ordering — relevanceScore is Int? so NULLs must be pushed last explicitly
orderBy: [
  { relevanceScore: { sort: 'desc', nulls: 'last' } },  // curator intent first
  { quote: { grade: 'asc' } },   // PG enum sorts in declaration order: SAHIH < HASAN < DAIF < MAWDU < UNGRADED
  { quote: { createdAt: 'desc' } },
  { id: 'asc' },                 // total order => stable offset pagination
]
```

The `grade: 'asc'` tie-break is deliberate and relies on the declaration order in
[`schema.prisma`](../../backend/prisma/schema.prisma): among equally relevant reminders, the more authentic one
comes first; non-hadith rows have `grade = null` and sort last within their score band (acceptable — scores
differentiate them in practice; if that proves wrong, a `COALESCE`-style computed rank moves this into a raw
query, noted as a future refinement).

- **Codes:** `200`; `404` unknown slug; `400` bad enum/filter; `422` if `grades` contains `MAWDU` (`GRADE_NOT_PERMITTED`)

#### 4. `GET /sins/:slug/good-deeds` — full constructive alternatives

- **Auth:** public · **Query:** `lang`, `page`, `limit`
- **Response `200`:** `{ data: GoodDeedDto[], meta: PageMeta }` — `goodDeed.findMany({ where: { oppositeSinId: sin.id } })`
- **Codes:** `200`, `404`

### 3.3 Core loop B — good deeds

#### 5. `GET /good-deeds`
Mirrors endpoint 1. Query: `page`, `limit`, `lang`, `category?`, `q?`, `oppositeSinSlug?`, `sort?` = `name|quoteCount`. Response `{ data: GoodDeedDto[], meta }`. Codes `200`, `400`.

#### 6. `GET /good-deeds/:slug`
`{ data: GoodDeedDto }` with `oppositeSin` expanded. Codes `200`, `404`.

#### 7. `GET /good-deeds/:slug/quotes` — **core endpoint, motivating side**

Structurally identical to endpoint 3 so the frontend can share one renderer; the differences are semantic.

- **Auth:** optional · **Query:** same DTO as endpoint 3 (`GoodDeedQuotesQueryDto`, same fields)
- **Response `200`:**

```jsonc
{
  "data": {
    "goodDeed": { "id": "…", "slug": "sadaqah", "name": "Giving charity", "nameAr": "الصدقة",
                  "reward": "…", "rewardAr": "…", "description": "…", "descriptionAr": "…",
                  "oppositeSin": { "id": "…", "slug": "bukhl", "name": "Miserliness", "nameAr": "البخل" } },
    "items": [ { "link": { "id": "…", "relevanceScore": 98, "note": "Multiplied reward" },
                 "quote": { /* QuoteDto */ } } ]
  },
  "meta": { "page": 1, "limit": 10, "total": 9, "totalPages": 1, "hasNext": false, "locale": "ar",
            "ordering": "relevanceScore:desc,grade:asc,createdAt:desc",
            "countsByType": { "QURAN_VERSE": 4, "HADITH": 5, "SCHOLAR_QUOTE": 0, "BOOK_EXCERPT": 0 },
            "appliedGrades": ["SAHIH", "HASAN"] }
}
```

Differences from endpoint 3: the intent object carries `reward`/`rewardAr` (the motivating payload) and
`oppositeSin` instead of `alternatives`; ordering reads `GoodDeedQuote.relevanceScore` with the same tie-breaks.

- **Codes:** `200`, `404`, `400`, `422`

### 3.4 Quotes

#### 8. `GET /quotes` — browse & search

- **Auth:** optional
- **Query:** `page`, `limit`, `lang`, `q?` (Arabic-normalised search over `textAr`, plus `Translation.text` when `lang=en`), `type?` (`QuoteType[]`), `origin?` (`LOCAL|API_CACHED`), `grades?` (`HadithGrade[]`), `sourceId?` (uuid), `tag?` (tag **slug**, repeatable; AND semantics), `sinSlug?`, `goodDeedSlug?`, `surahNumber?`, `ayahNumber?`, `hasTranslation?` (`languageCode`), `sort?` = `relevance|newest|oldest` (default `relevance` when `q` present, else `newest`)
- **Response `200`:** `{ data: QuoteDto[], meta: PageMeta & { locale, appliedFilters } }`
- **Notes:** `tag` filter is `AND`-combined (`every`-style via repeated `some` clauses) because tag narrowing is how the browser feature drills down. Search implementation and its Arabic-text caveats: §4.4.
- **Codes:** `200`, `400`

#### 9. `GET /quotes/:id` — detail

- **Auth:** optional · **Params:** `id` (uuid) · **Query:** `lang`, `includeAllTranslations?` (bool), `includeLinks?` (bool, default `true`)
- **Response `200`:** `{ data: QuoteDto & { translations?: Translation[], relatedSins?: [{ slug, name, nameAr, relevanceScore }], relatedGoodDeeds?: [{ slug, name, nameAr, relevanceScore }] } }`
- **Notes:** `relatedSins`/`relatedGoodDeeds` come from `sinLinks`/`goodDeedLinks` and power "this verse also warns against…" navigation.
- **Codes:** `200`, `400` (malformed uuid), `404`

### 3.5 Quran

| # | Endpoint | Query | Response | Codes |
| --- | --- | --- | --- | --- |
| 10 | `GET /quran/surahs` | `lang` | `{ data: [{ surahNumber, surahName, surahNameAr, ayahCount }] }` — `groupBy` over ingested `QURAN_VERSE` rows | `200` |
| 11 | `GET /quran/surahs/:surahNumber/ayahs` | `page`, `limit`, `lang`, `fromAyah?`, `toAyah?` | `{ data: QuoteDto[], meta }` ordered by `ayahNumber asc` | `200`, `400` (surah not 1–114), `404` (nothing ingested for that surah) |
| 12 | `GET /quran/ayahs/:surahNumber/:ayahNumber` | `lang`, `includeAllTranslations?` | `{ data: QuoteDto }` | `200`, `400`, `404` |

Endpoint 12 returns the **first** matching verse row and sets `meta.duplicateCount` if more than one provider
has been cached for that ayah — a real possibility given `@@unique([apiProvider, externalId])` is per-provider.
Provider preference order is config-driven (`QURAN_PREFERRED_PROVIDER`).

### 3.6 Hadith

| # | Endpoint | Query | Response | Codes |
| --- | --- | --- | --- | --- |
| 13 | `GET /hadith` | `page`, `limit`, `lang`, `collectionId?` (= `sourceId`), `narrator?`, `grades?` (default `SAHIH,HASAN`), `q?`, `reference?` | `{ data: QuoteDto[], meta: { …, appliedGrades } }` | `200`, `400`, `422` (`MAWDU` requested) |
| 14 | `GET /hadith/collections` | `lang` | `{ data: [{ id, name, nameAr, author, authorAr, isExternalApi, apiProvider, quoteCount, lastSyncedAt }] }` — `Source` rows with `type = HADITH_COLLECTION` | `200` |

Hadith detail is intentionally **not** a separate route: `GET /quotes/:id` already returns the full hadith
projection. Avoid two URLs for one resource.

### 3.7 Tags & sources

| # | Endpoint | Query / Params | Response | Codes |
| --- | --- | --- | --- | --- |
| 15 | `GET /tags` | `category?` (`SIN\|GOOD_DEED\|THEME\|EMOTION`), `q?`, `page`, `limit`, `lang` | `{ data: [{ id, name, nameAr, slug, category, quoteCount }], meta }` | `200`, `400` |
| 16 | `GET /tags/:slug` | `lang` | `{ data: TagDto & { quoteCount } }` | `200`, `404` |
| 17 | `GET /sources` | `type?` (`SourceType`), `isExternalApi?`, `page`, `limit`, `lang` | `{ data: SourceDto[], meta }` where `SourceDto = { id, name, nameAr, type, author, authorAr, language, isExternalApi, apiProvider, apiBaseUrl, lastSyncedAt, quoteCount }` | `200`, `400` |
| 18 | `GET /sources/:id` | `id` uuid | `{ data: SourceDto }` | `200`, `400`, `404` |

`GET /tags?category=EMOTION` is the "enter from the feeling" path described in
[ARCHITECTURE §1](../ARCHITECTURE.md); the client then calls `GET /quotes?tag=<slug>`. Listing quotes for a tag
has no dedicated route — it is `GET /quotes?tag=…`, one filtering surface only.

### 3.8 Auth (phase 4)

**Guest-first:** endpoints 1–18 require no account. Auth exists only to make `Favorite` rows durable across
devices. Justified in [Open Decisions](../TECHNICAL_PLAN.md#open-decisions--assumptions).

#### 19. `POST /auth/register`
- **Auth:** public · **Body (`RegisterDto`):** `email` (`@IsEmail`, normalised lowercase/trim), `password` (`@MinLength(10)`, `@MaxLength(128)`), `displayName?` (`@IsString`, 1–80)
- **`201`:** `{ data: { user: { id, email, displayName, role }, accessToken, refreshToken, expiresIn } }`
- **Codes:** `201`, `400`, `409 EMAIL_ALREADY_REGISTERED`
- **Note:** always hash and compare even on a duplicate email path to avoid a timing oracle; response must not reveal more than the `409` code.

#### 20. `POST /auth/login`
- **Body (`LoginDto`):** `email`, `password` · **`200`:** same payload as register
- **Codes:** `200`, `400`, `401 INVALID_CREDENTIALS` (identical message for unknown email and wrong password), `429`

#### 21. `POST /auth/refresh`
- **Body:** `{ refreshToken }` · **`200`:** `{ data: { accessToken, refreshToken, expiresIn } }` (rotating refresh)
- **Codes:** `200`, `401 INVALID_REFRESH_TOKEN`

#### 22. `GET /auth/me`
- **Auth:** user · **`200`:** `{ data: { id, email, displayName, role, favoriteCount, createdAt } }` · **Codes:** `200`, `401`

#### 23. `POST /auth/logout`
- **Auth:** user · **`204`.** Phase 4 is stateless, so this only tells the client to drop its tokens; it becomes a real revocation once the optional `RefreshToken` table in §9 is adopted. Document that honestly rather than implying server-side invalidation.

### 3.9 Favorites (phase 4, auth required)

| # | Endpoint | Request | Response | Codes |
| --- | --- | --- | --- | --- |
| 24 | `GET /favorites` | `page`, `limit`, `lang`, `type?` | `{ data: [{ id, createdAt, quote: QuoteDto }], meta }`, newest first | `200`, `401` |
| 25 | `GET /favorites/quote-ids` | — | `{ data: ["uuid", …] }` — one cheap call so the client can mark hearts across any list | `200`, `401` |
| 26 | `POST /favorites` | `{ quoteId }` (`@IsUUID`) | `201 { data: { id, quoteId, createdAt } }` | `201`, `400`, `401`, `409 ALREADY_FAVORITED`, `422` unknown `quoteId` |
| 27 | `DELETE /favorites/:quoteId` | — | `204` | `204`, `401`, `404` |

Keying delete by `quoteId` (not the `Favorite.id`) means the client never has to remember the join-row id to
un-heart a quote. Implemented via `deleteMany({ where: { userId, quoteId } })` and a `404` when `count === 0`.

### 3.10 Admin — content CRUD

All under `/admin`, all guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`.

| # | Method & path | Body | Response | Codes |
| --- | --- | --- | --- | --- |
| 28 | `POST /admin/quotes` | `CreateQuoteDto` (§5.1) | `201 { data: QuoteDto }` + `Location` | `201`, `400`, `403`, `409`, `422` |
| 29 | `PATCH /admin/quotes/:id` | `UpdateQuoteDto` (partial of create, `type`/`origin` immutable) | `200 { data: QuoteDto }` | `200`, `400`, `403`, `404` |
| 30 | `DELETE /admin/quotes/:id` | — | `204` (cascades `Translation`, `QuoteTag`, `SinQuote`, `GoodDeedQuote`, `Favorite`) | `204`, `403`, `404` |
| 31 | `GET /admin/quotes` | like endpoint 8 plus `unlinkedOnly?`, `origin?`, `missingTranslation?` | `{ data: QuoteDto[], meta }` | `200`, `403` |
| 32 | `PUT /admin/quotes/:id/translations/:languageCode` | `{ text }` | `200 { data: Translation }` — upsert on `@@unique([quoteId, languageCode])` | `200`, `400`, `403`, `404` |
| 33 | `POST /admin/quotes/:id/translations` | `{ languageCode, text }` | `201` | `201`, `409`, `403`, `404` |
| 34 | `DELETE /admin/quotes/:id/translations/:languageCode` | — | `204` | `204`, `403`, `404` |
| 35 | `PUT /admin/quotes/:id/tags` | `{ tagIds: string[] }` | `200 { data: TagDto[] }` — declarative set-replace in one transaction | `200`, `400`, `403`, `404`, `422` |
| 36–38 | `POST/PATCH/DELETE /admin/sins[/:id]` | `CreateSinDto` / `UpdateSinDto`: `name`, `nameAr`, `slug`, `category?`, `description?`, `descriptionAr?`, `severity?` (1–10) | `201`/`200`/`204` | +`409` on duplicate `slug` |
| 39–41 | `POST/PATCH/DELETE /admin/good-deeds[/:id]` | `CreateGoodDeedDto`: `name`, `nameAr`, `slug`, `category?`, `description?`, `descriptionAr?`, `reward?`, `rewardAr?`, `oppositeSinId?` | `201`/`200`/`204` | +`409` duplicate slug, `422` unknown `oppositeSinId` |
| 42–44 | `POST/PATCH/DELETE /admin/sources[/:id]` | `CreateSourceDto`: `name`, `nameAr?`, `type` (`SourceType`), `author?`, `authorAr?`, `language?` (default `ar`), `isExternalApi?`, `apiProvider?`, `apiBaseUrl?` (`@IsUrl`) | `201`/`200`/`204` | `409` on `DELETE` when quotes still reference it (FK is restrict — `Quote.source` has no cascade) |
| 45–47 | `POST/PATCH/DELETE /admin/tags[/:id]` | `CreateTagDto`: `name`, `nameAr?`, `slug`, `category` (`TagCategory`) | `201`/`200`/`204` | `409` duplicate slug |

Deleting a `Sin`/`GoodDeed` cascades its links but **not** the quotes themselves — correct, quotes are reusable.
`DELETE /admin/sins/:id` must return a `409 SIN_HAS_LINKS` unless `?force=true` is passed, so a curator cannot
wipe curation work with a misclick.

### 3.11 Admin — classification (`SinQuote` / `GoodDeedQuote`): the curation core

This is where a human says *"this quote discourages that sin, and here is how strongly"*.

#### 48. `POST /admin/sin-quotes`

- **Auth:** admin · **Body:** `LinkSinQuoteDto` (§5.2)

```jsonc
// request
{ "sinId": "0a8e…", "quoteId": "6f1c…", "relevanceScore": 95,
  "note": "Explicit prohibition in Surah al-Hujurat 49:12; strongest primary text for this sin." }
```

```jsonc
// 201 response
{ "data": { "id": "l1…", "sinId": "0a8e…", "quoteId": "6f1c…", "relevanceScore": 95, "note": "…",
            "sin": { "slug": "ghibah", "name": "Backbiting", "nameAr": "الغيبة" },
            "quote": { "id": "6f1c…", "type": "QURAN_VERSE", "textAr": "…" } } }
```

- **Behaviour:** `prisma.sinQuote.upsert({ where: { sinId_quoteId: { sinId, quoteId } }, … })`. Re-linking an
  existing pair updates `relevanceScore`/`note` and returns `200` instead of `201` — curators re-submit, and a
  hard `409` there is hostile. (`409` is reserved for `?mode=create-only`.)
- **Codes:** `201` created, `200` updated, `400`, `403`, `422 RELATED_RESOURCE_INVALID` (unknown `sinId`/`quoteId`)

#### 49. `GET /admin/sin-quotes`
Query: `sinId?`, `quoteId?`, `minScore?`, `maxScore?`, `hasNote?`, `page`, `limit`, `sort?` = `score|newest`.
Response `{ data: SinQuoteDto[], meta }` — the curator's worklist ("what did I link to this sin, with what scores").

#### 50. `PATCH /admin/sin-quotes/:id`
Body `UpdateSinQuoteDto`: `relevanceScore?` (0–100), `note?` (nullable to clear). `200 { data: SinQuoteDto }`.
Codes `200`, `400`, `403`, `404`.

#### 51. `DELETE /admin/sin-quotes/:id`
`204`. Deletes the link only; the quote survives. Codes `204`, `403`, `404`.

#### 52. `POST /admin/sin-quotes/bulk`
Body: `{ sinId, links: [{ quoteId, relevanceScore?, note? }] }` (max 100 items, `@ArrayMaxSize(100)`).
Runs one `prisma.$transaction` of upserts. `200 { data: { created, updated, skipped, failed: [{ quoteId, reason }] } }`.
Purpose: after an ingestion run a curator triages a batch of new quotes against one sin in a single call.
Codes `200`, `207`-like semantics are **avoided** — partial results are reported inside a `200` body, not via a
non-standard status.

#### 53–57. `/admin/good-deed-quotes…`
Exactly the five routes above with `goodDeedId` instead of `sinId`, `LinkGoodDeedQuoteDto`, and the
`goodDeedId_quoteId` compound unique. Shared implementation via a small generic in `ClassificationService` —
one code path, two entity bindings, so the two sides cannot drift.

### 3.12 Admin — content sync & sync logs

#### 58. `POST /admin/content-sync/runs` — manual trigger

- **Auth:** admin
- **Body (`TriggerSyncDto`):** `sourceId` (uuid, must be a `Source` with `isExternalApi = true`), `scope?` (`{ surahFrom?, surahTo?, collection?, chapterFrom?, chapterTo? }`), `dryRun?` (bool, default `false`), `force?` (bool — bypass the "already ran recently" guard)
- **`202 Accepted`:** `{ data: { syncLogId, sourceId, status: "PENDING", startedAt } }` — the run is asynchronous; the response is the `SyncLog` handle. A long HTTP request must never hold an ingestion.
- **Codes:** `202`, `400`, `403`, `404` unknown source, `409 SYNC_ALREADY_RUNNING` (a `SyncLog` for that source is `PENDING`/`RUNNING`), `422 SOURCE_NOT_EXTERNAL`
- Mechanics: [content-pipeline-plan §3](./content-pipeline-plan.md#3-sync-job-mechanics).

#### 59. `GET /admin/sync-logs`
Query: `sourceId?`, `status?` (`SyncStatus`), `from?`/`to?` (ISO dates), `page`, `limit` (default sort `startedAt desc`).
Response:

```jsonc
{ "data": [ { "id": "…", "status": "SUCCESS", "startedAt": "…", "finishedAt": "…",
              "durationMs": 48213, "recordsImported": 1240, "errorMessage": null,
              "source": { "id": "…", "name": "Quran.com", "apiProvider": "quran.com" } } ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2, "hasNext": true } }
```

`durationMs` is derived (`finishedAt - startedAt`), not stored. Codes `200`, `400`, `403`.

#### 60. `GET /admin/sync-logs/:id`
Single run with the same fields. Codes `200`, `403`, `404`.

---

## 4. Core-loop implementation notes

### 4.1 One query path for both intents

`SinsService.findQuotesForSin` and `GoodDeedsService.findQuotesForGoodDeed` must be near-identical:

```ts
// shape only — sins variant
const sin = await this.prisma.sin.findUnique({ where: { slug } });
if (!sin) throw new NotFoundException(/* RESOURCE_NOT_FOUND */);

const where: Prisma.SinQuoteWhereInput = {
  sinId: sin.id,
  ...(minScore !== undefined && { relevanceScore: { gte: minScore } }),
  quote: {
    ...(types?.length && { type: { in: types } }),
    // grade filter must only constrain HADITH rows, never drop verses:
    OR: [{ type: { not: QuoteType.HADITH } }, { grade: { in: allowedGrades } }],
  },
};

const [rows, total, byType] = await this.prisma.$transaction([
  this.prisma.sinQuote.findMany({ where, orderBy: LINK_ORDER, skip, take,
    include: { quote: this.quotes.buildQuoteInclude(locale) } }),
  this.prisma.sinQuote.count({ where }),
  this.prisma.sinQuote.groupBy({ by: ['quoteId'], where, _count: true }), // → countsByType via a join, see note
]);
```

The grade `OR` clause is the subtle part: a naive `quote: { grade: { in: [...] } }` would exclude every Quran
verse (their `grade` is `NULL`) and silently empty the core response. Cover this with a unit test asserting a
verse survives `grades=SAHIH`.

`countsByType` is cheapest as a second `quote.groupBy({ by: ['type'], where: { sinLinks: { some: where } } })`;
if that proves slow, replace with a single `$queryRaw` aggregate — but only after measuring.

### 4.2 `shuffle` / variety mode

A user who returns to the same sin twice should not see the identical ten reminders. `shuffle=true` keeps the
top relevance band meaningful instead of fully randomising: take the rows with `relevanceScore >= 70` (config:
`VARIETY_SCORE_FLOOR`), order them by `md5(id || seed)` via `$queryRaw`, and append the remainder in normal
order. `seed` defaults to a daily bucket (`userId|ip-hash + yyyy-mm-dd`) so results are stable within a session
and pageable. Deterministic ordering is required for offset pagination to be coherent.

### 4.3 Grade policy (`modules/hadith/grade-policy.ts`)

```ts
export const DEFAULT_ALLOWED_GRADES = [HadithGrade.SAHIH, HadithGrade.HASAN];
export const WEAK_OPT_IN_GRADES   = [HadithGrade.DAIF, HadithGrade.UNGRADED];
export const NEVER_SERVE          = [HadithGrade.MAWDU];   // fabricated — 422 if requested
```

Enforced in the DTO (`@IsEnum` + a custom `@NotMawdu()` validator) **and** re-asserted in the service, because
"never show a fabricated narration as authentic" is a correctness guarantee, not a UI preference.
`UNGRADED` is opt-in: it is common in `API_CACHED` rows that arrive without grading, and showing it in the
default reminder flow would misrepresent authenticity.

### 4.4 Arabic text search

Phase 2: `common/text/arabic-normalizer.ts` strips tashkeel (`U+064B–U+0652`, `U+0670`, `U+06D6–U+06ED`) and
tatweel (`U+0640`), and folds `أإآ→ا`, `ى→ي`, `ة→ه`. Query and candidate text are normalised the same way, then
matched with `contains` + `mode: 'insensitive'`.

Phase 5 upgrade (when `API_CACHED` volume makes `ILIKE` too slow): a hand-written migration adds `pg_trgm` and a
GIN index on a normalised generated column. Prisma cannot express that, so it goes in a raw-SQL migration file —
see [devops-plan §4](./devops-plan.md#4-migration-workflow). Postgres has no Arabic stemming dictionary, so
`to_tsvector('simple', …)` + trigram is the realistic target; a dedicated engine (Meilisearch/OpenSearch) stays
out of scope and is listed in Open Decisions.

### 4.5 Caching

Phase 2: no cache layer. The catalogues are tiny and Postgres is local.
Phase 5: `CacheModule` (in-memory) on `GET /sins`, `GET /good-deeds`, `GET /quran/surahs`, `GET /tags` with a
60 s TTL, invalidated by the admin write paths. `Cache-Control: public, max-age=60, stale-while-revalidate=300`
on public read endpoints so the CDN in front of the frontend can help. Redis is only justified once there is
more than one API instance — Open Decisions.

---

## 5. DTO & validation conventions

Conventions (all enforceable by review):

1. One file per DTO, named after the operation: `dto/create-quote.dto.ts`, `dto/link-sin-quote.dto.ts`, `dto/sin-quotes-query.dto.ts`.
2. Request DTOs are **classes** with `class-validator` decorators; response shapes are **interfaces/types** in `entities/` (they are not validated, so a class buys nothing).
3. Every optional field carries `@IsOptional()` *before* its type validator.
4. Strings get explicit bounds (`@MaxLength`) — unbounded text into Postgres is a DoS surface.
5. Query DTOs use `@Type(() => Number)` / `@Transform` for coercion; the global `enableImplicitConversion` handles the simple cases but explicit is clearer for arrays.
6. Repeatable enum query params (`?type=A&type=B`) and CSV (`?type=A,B`) are both accepted via one shared `@TransformToArray()` decorator in `common/decorators/`.
7. `UpdateXDto extends PartialType(CreateXDto)` from **`@nestjs/mapped-types`** — note that this package is *not* installed yet (§10); until it is, write the partial explicitly rather than pulling in `@nestjs/swagger` just for `PartialType`.
8. `forbidNonWhitelisted: true` means a typo'd body key is a `400`, not a silent no-op. Keep it on.

### 5.1 `CreateQuoteDto` (endpoint 28) — the most field-heavy DTO

| Field | Validators | Notes |
| --- | --- | --- |
| `type` | `@IsEnum(QuoteType)` | required discriminator |
| `origin` | `@IsOptional() @IsEnum(QuoteOrigin)` | defaults to `LOCAL`; admins should not hand-create `API_CACHED` — reject it with `422 ORIGIN_RESERVED_FOR_SYNC` |
| `textAr` | `@IsString() @MinLength(3) @MaxLength(10000) @Matches(/[\u0600-\u06FF]/)` | the Arabic-script check catches a curator pasting English into the source-of-truth field |
| `sourceId` | `@IsUUID()` | must exist → `422` otherwise |
| `surahNumber` | `@IsOptional() @IsInt() @Min(1) @Max(114)` | required **iff** `type = QURAN_VERSE` |
| `surahName`, `surahNameAr` | `@IsOptional() @IsString() @MaxLength(100)` | |
| `ayahNumber` | `@IsOptional() @IsInt() @Min(1) @Max(286)` | 286 = longest surah |
| `narrator`, `narratorAr` | `@IsOptional() @IsString() @MaxLength(200)` | hadith only |
| `grade` | `@IsOptional() @IsEnum(HadithGrade)` | required **iff** `type = HADITH` (use `UNGRADED` explicitly rather than omitting — an absent grade is indistinguishable from "not checked") |
| `hadithReference` | `@IsOptional() @IsString() @MaxLength(200)` | e.g. `"Bukhari 13"` |
| `bookTitle`, `author` | `@IsOptional() @IsString() @MaxLength(300)` | book/scholar only |
| `pageOrChapter` | `@IsOptional() @IsString() @MaxLength(100)` | |
| `translations` | `@IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TranslationInputDto)` | `TranslationInputDto`: `languageCode` (`@IsISO31661Alpha2`-unsuitable → use `@Matches(/^[a-z]{2}(-[A-Z]{2})?$/)`), `text` (`@IsString() @MaxLength(10000)`) |
| `tagIds` | `@IsOptional() @IsArray() @IsUUID('4', { each: true }) @ArrayMaxSize(20)` | created as `QuoteTag` rows in the same transaction |

`externalId` / `apiProvider` / `rawPayload` are **absent from this DTO on purpose**: they are owned by
`content-sync`. A cross-field rule set (`type → required fields`) belongs in a custom class-level validator
`@ValidQuoteShape()` so the message names the real problem ("`grade` is required when `type` is `HADITH`")
instead of a generic failure.

### 5.2 `LinkSinQuoteDto` (endpoint 48) — the curation DTO

| Field | Validators | Notes |
| --- | --- | --- |
| `sinId` | `@IsUUID()` | `422` if the sin does not exist |
| `quoteId` | `@IsUUID()` | `422` if the quote does not exist |
| `relevanceScore` | `@IsOptional() @IsInt() @Min(0) @Max(100)` | **Convention decision: 0–100.** The schema says `Int? @default(0)` with no bound, so the range is an API-level contract. 0–100 reads as a percentage of "how on-point is this reminder" and leaves room between adjacent values. Document it in the admin UI copy too. |
| `note` | `@IsOptional() @IsString() @MaxLength(1000)` | the curator's reasoning; shown to reviewers, never to end users |

`LinkGoodDeedQuoteDto` is identical with `goodDeedId`. `BulkLinkSinQuotesDto`: `sinId` + `links`
(`@ValidateNested({ each: true }) @ArrayMaxSize(100)` of `{ quoteId, relevanceScore?, note? }`).

### 5.3 `SinQuotesQueryDto` (endpoint 3) — the most-called DTO

```ts
export class SinQuotesQueryDto extends PaginationQueryDto {  // page, limit
  @IsOptional() @IsIn(['ar', 'en'])                         lang?: 'ar' | 'en' = 'ar';
  @IsOptional() @TransformToArray() @IsEnum(QuoteType, { each: true })   type?: QuoteType[];
  @IsOptional() @TransformToArray() @IsEnum(HadithGrade, { each: true }) @NotMawdu() grades?: HadithGrade[];
  @IsOptional() @Type(() => Boolean) @IsBoolean()           includeWeak?: boolean = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)  minScore?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean()           shuffle?: boolean = false;
  @IsOptional() @IsString() @MaxLength(64)                  seed?: string;
}
```

`limit` is overridden here to `@Max(50)` — a reminder screen never needs 100 quotes, and the cap protects the
`include`-heavy query. Reused verbatim as `GoodDeedQuotesQueryDto` (extend, do not copy).

---

## 6. `main.ts` bootstrap (target)

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));                       // nestjs-pino, §8
app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
  transformOptions: { enableImplicitConversion: true } }));
app.useGlobalFilters(new AllExceptionsFilter(logger));
app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
app.enableCors({ origin: config.corsOrigins, credentials: true });
app.enableShutdownHooks();
await app.listen(config.port);                        // 3001 by default — see §0 port note
```

Env validation: a `validateEnv` function on `ConfigModule.forRoot` (class-validator over an `EnvDto`) so the
process fails fast on a missing `DATABASE_URL` or `JWT_ACCESS_SECRET` rather than at first request.

---

## 7. Auth implementation sketch (phase 4)

### 7.1 Decisions

| Question | Decision | Reason |
| --- | --- | --- |
| Strategy | **JWT access + rotating refresh**, via `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | Stateless, trivial for the future Expo client, no session store. |
| Hashing | **argon2** (`argon2` npm, `argon2id`, memory 19 MiB / time 2 / parallelism 1 — OWASP baseline) | Current password-hashing recommendation; memory-hard where bcrypt is not. Fallback `bcrypt` cost 12 if a native build is a problem on the deploy target — note which was chosen in the PR. |
| Access TTL | 15 min | Short enough to limit a leaked token. |
| Refresh TTL | 30 days, rotating on every `/auth/refresh` | Long-lived "stay signed in" without a long-lived access token. |
| Secrets | **Two separate secrets** (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) | An access token must never be replayable as a refresh token. |
| Transport | `Authorization: Bearer` header; the frontend keeps the refresh token in an **httpOnly cookie** set by the Next.js route handler, never in `localStorage` | XSS resistance; see [frontend-plan §6](./frontend-plan.md#6-state--data-fetching-plan). |
| Guest-first | No guard on endpoints 1–18 | The product must work at the moment of temptation, with zero friction. Login exists only for durable favorites. |

### 7.2 Pieces

```
modules/auth/
├── auth.module.ts            # JwtModule.registerAsync (ConfigService), PassportModule, UsersModule
├── auth.controller.ts        # endpoints 19–23
├── auth.service.ts           # register/login/refresh/issueTokens/validateUser
├── strategies/jwt.strategy.ts         # 'jwt'          — access token  → { sub, email, role }
├── strategies/jwt-refresh.strategy.ts # 'jwt-refresh'  — refresh token
├── guards/jwt-auth.guard.ts           # AuthGuard('jwt'), honours @Public()
├── guards/optional-jwt-auth.guard.ts  # overrides handleRequest to return undefined instead of throwing
├── guards/roles.guard.ts              # reads @Roles() metadata vs request.user.role
└── dto/{register,login,refresh-token}.dto.ts
```

- `JwtAuthGuard` is **not** global: with a guest-first product it is clearer to opt in per controller
  (`@UseGuards(JwtAuthGuard)`) than to register it globally and sprinkle `@Public()` on ~18 public routes. The
  `@Public()` decorator still exists for the health module and for a future global switch.
- `OptionalJwtAuthGuard` powers the `isFavorite` enrichment on endpoints 3, 7, 8, 9 — a malformed/expired token
  must degrade to anonymous, not `401`, or a stale token would break the core flow.
- `RolesGuard` reads `User.role` from the JWT payload (see the schema addition in §9) and is always composed
  **after** `JwtAuthGuard`.
- `@CurrentUser()` param decorator returns the typed `{ userId, email, role }`; services never read `req.user` directly.

---

## 8. Observability

| Concern | Decision |
| --- | --- |
| Logger | **`nestjs-pino`** (`pino-http` under the hood). JSON logs in production, `pino-pretty` in development. Chosen over Nest's built-in `Logger` because the built-in one emits unstructured strings — unusable for querying once the app is on a hosted platform, and this app has an auditable pipeline (`SyncLog`) worth correlating against. |
| Correlation | `genReqId` reuses an inbound `x-request-id` or generates one; it appears in every log line and in `error.requestId` (§2.5). |
| Redaction | `redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken']` — non-negotiable. Phase 4b adds masking of the calendar-feed token in the logged URL and `error.path`, plus kinship body fields ([silat-rahim-plan §6.4](./silat-rahim-plan.md#64-logging-and-redaction)). |
| Levels | `info` for requests, `warn` for `4xx`, `error` for `5xx` and for every `SyncLog` failure, `debug` for provider request/response summaries (never full `rawPayload`). |
| Health | `GET /health` → `{ status: 'ok', uptime, version }` with no DB call (liveness). `GET /health/ready` → `SELECT 1` and `503 { status: 'error', checks: { database: 'down' } }` on failure (readiness). `@nestjs/terminus` is optional; a 20-line controller is enough for phase 2. |
| Metrics | Out of scope until phase 5. If added: `prom-client` behind `GET /metrics`, admin-guarded or network-restricted. |
| Sync observability | `SyncLog` *is* the audit trail — [content-pipeline-plan §3.4](./content-pipeline-plan.md#34-synclog-bookkeeping). Logs complement it, never replace it. |

---

## 9. Proposed schema additions

Phase 1's schema is final **except** for these, which auth cannot be built without. Each is additive (no column
dropped, no semantics changed) and ships as one `prisma migrate dev --name add_user_auth_fields` in phase 4.

```prisma
// PROPOSED — phase 4 (auth). Additive only.
enum UserRole {
  USER
  ADMIN
}

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  displayName  String?
  passwordHash String?                        // NEW — nullable so existing/seeded rows and a future
                                              //       OAuth-only user remain valid
  role         UserRole   @default(USER)      // NEW — required by RolesGuard (§7)
  lastLoginAt  DateTime?                      // NEW — optional, cheap, useful for support
  favorites    Favorite[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

| Addition | Why it is unavoidable | Risk if skipped |
| --- | --- | --- |
| `User.passwordHash` | The current `User` model has **no credential field at all** — `POST /auth/login` is impossible to implement against it. | Blocks all of phase 4. |
| `User.role` (`UserRole`) | Every `/admin/*` endpoint in §3.10–3.12 is role-guarded. | Admin endpoints would be unprotected or env-whitelist hacks. |
| `User.lastLoginAt` | Nice-to-have; drop it if the reviewer prefers a minimal diff. | None. |

**Optional, not recommended for phase 4:** a `RefreshToken` model (`id`, `userId`, `tokenHash`, `expiresAt`,
`revokedAt`, `createdAt`) to make `POST /auth/logout` a real revocation and allow "sign out everywhere". It is a
clean upgrade, but it adds a write on every refresh for a single-user-per-device app; deferred to phase 5+ and
listed in Open Decisions.

**Also noted, not proposed now:** a normalised-text column + trigram index for Arabic search (§4.4) — that is a
raw-SQL migration rather than a schema-model change.

### 9.1 Phase 4b, proposed — Silat ar-Rahim & forgotten deeds

**Not pre-approved.** Unlike the phase-4 fields above, these require the owner's explicit approval
([backend/.cursorrules](../../backend/.cursorrules) "Schema Changes Are Exceptional") and ship as their own
migration, `prisma migrate dev --name add_kinship_reminders`. The authoritative `prisma` block and the
per-field justification are in [silat-rahim-plan §4](./silat-rahim-plan.md#4-data-model--proposed-schema-additions).
They are summarised here, not duplicated:

| Addition | Purpose |
| --- | --- |
| `Relative` + enums `KinRelation`, `ReminderFrequency`, `Weekday` | The private kinship list; `nextDueOn @db.Date` computed on write. |
| `ContactLog` + enum `ContactMethod` | "I contacted them" — restarts the cycle; supports undo. |
| `DeedReminder` (+ `GoodDeed.deedReminders` back-relation) | Forgotten deeds opted into the reminder schedule. |
| `User.calendarFeedTokenHash String? @unique`, `User.calendarShowNames Boolean @default(false)` (+ back-relations) | The hashed, rotatable ICS feed token and the names-in-titles opt-in. |

Forgotten deeds themselves need **no** schema change: a `THEME` tag `forgotten-deeds` on the deeds' linked
quotes ([silat-rahim-plan §4.4](./silat-rahim-plan.md#44-forgotten-deeds-need-no-schema-change)).

### 9.2 Phase 3b, proposed — vision v2

**Not pre-approved**; four migrations, each its own commit (`add_sin_rank`, `add_iman_branches`,
`add_explanations`, `add_external_references`). The authoritative `prisma` block, raw-SQL CHECKs and per-field
justification are in [vision-v2-plan §6](./vision-v2-plan.md#6-proposed-schema-additions):
`SinRank` + `Sin.rank`/`rankSourceId`/`rankReference` (`Sin.severity` kept); `ImanBranch` + `ImanBranchQuote`/
`ImanBranchGoodDeed`/`ImanBranchSin`; `ExplanationKind` + `Explanation`; `ExternalReference`. Phase 4b's
`DeedReminder` is unchanged but now accepts any `GoodDeed`
([vision-v2 §10](./vision-v2-plan.md#10-reminders-for-any-good-deed--phase-4b-amendment)).

---

## 10. Dependencies to add (none installed in this task)

> This document changes no files under `backend/`. The list is what the implementing commit must install.

| Phase | Package | Purpose |
| --- | --- | --- |
| 2 | `@nestjs/mapped-types` | `PartialType` for `Update*Dto` |
| 2 | `nestjs-pino`, `pino-http`, `pino-pretty` (dev) | structured logging (§8) |
| 4 | `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt` | auth (§7) |
| 4 | `argon2` | password hashing (§7.1) |
| 4 | `@nestjs/throttler` | auth rate limiting (§2.7) |
| 4b | `ical-generator` (`^11`) — **pending owner approval** | RFC 5545 calendar feed: escaping and UTF-8-safe line folding ([silat-rahim-plan §7.1](./silat-rahim-plan.md#71-library-vs-hand-written--recommendation-ical-generator-pending-approval)); the fallback is a hand-written serializer |
| 5 | `@nestjs/schedule` | cron sync ([content-pipeline-plan §3](./content-pipeline-plan.md#3-sync-job-mechanics)) |
| 5 | `helmet`, `compression` | hardening |
| 2–3 | `tsx` *(only if Node 24 native TS stripping proves insufficient for `prisma/seed.ts`)* | seed script |

Already present and **not** to be re-added: `@nestjs/config`, `@nestjs/axios`, `axios`, `class-validator`,
`class-transformer`, `@prisma/client`, `prisma`, `vitest`, `supertest`.

---

## 11. Testing strategy (Vitest, already configured)

### 11.1 Unit tests

Files: `src/**/*.spec.ts` — run with `pnpm --filter backend test`.

One spec per service. `PrismaService` is mocked (a plain object of `vi.fn()`s, or `vitest-mock-extended` if the
team wants deep mocks) and injected through `Test.createTestingModule({ providers: [X, { provide: PrismaService, useValue: mock }] })`.

Must-have cases, per module:

| Module | Non-negotiable tests |
| --- | --- |
| `sins` | ordering is `relevanceScore desc` with **nulls last**; the grade `OR` clause does **not** drop `QURAN_VERSE` rows (§4.1); unknown slug → `NotFoundException`; `alternatives` capped at 3; `countsByType` counts the full filtered set, not the page |
| `good-deeds` | same ordering invariants; `oppositeSin` expanded; `reward` present |
| `quotes` | `toQuoteDto` never emits `rawPayload`; correct `translation` picked for `lang`; `null` when missing; kind-specific group is `null` for the wrong `type` |
| `hadith` | `MAWDU` rejected; `DAIF` only with `includeWeak`; `UNGRADED` excluded by default |
| `classification` | upsert semantics (second link of the same pair updates, returns 200); `relevanceScore` bounds; bulk partial-failure report |
| `auth` | wrong password and unknown email produce the **same** error; hash never returned; refresh rotation issues a new refresh token |
| `favorites` | duplicate → `409`; delete by `quoteId` of a non-favorited quote → `404` |
| `content-sync` | idempotent upsert on `(apiProvider, externalId)`; one bad record does not abort the run; `SyncLog` transitions |
| `common` | Arabic normaliser: `الغيبه` ≡ `الغِيبة`; envelope interceptor passthrough; Prisma→HTTP error mapping table |
| `kinship` (Phase 4b) | The list in [silat-rahim-plan §11.1](./silat-rahim-plan.md#111-unit-tests-must-have) — `nextDueOn` maths, ownership → `404`, hashed token, ICS folding/escaping, no names in the default feed |
| `iman-branches`, explanations, external refs, book importers, tafsir (Phases 3b/5b) | The list in [vision-v2-plan §12.1](./vision-v2-plan.md#121-unit-must-have) — grade policy on branch quotes (verse survives `grades=SAHIH`, `MAWDU` never), `MAWDU` quote's explanations → `404`, allow-listed external hosts, idempotent imports that never write link/tag rows |

### 11.2 E2E tests

Files: `backend/test/*.e2e-spec.ts` — run with `pnpm --filter backend test:e2e`.

Uses the existing [`vitest.config.e2e.ts`](../../backend/vitest.config.e2e.ts) and the `supertest` pattern
already in [`test/app.e2e-spec.ts`](../../backend/test/app.e2e-spec.ts).

- **Database:** a real Postgres, not a mock — a `thekra_test` database from the same
  [`docker-compose.yml`](../../docker-compose.yml) service, selected by `DATABASE_URL` in `.env.test`. Reset per
  file with `prisma migrate reset --force --skip-seed` then a small `seedTestFixtures()` helper (a subset of the
  dev seed in [content-pipeline-plan §5](./content-pipeline-plan.md#5-development-seed-plan-prismaseedts)).
- **One spec per controller:** `sins.e2e-spec.ts`, `good-deeds.e2e-spec.ts`, `quotes.e2e-spec.ts`,
  `quran.e2e-spec.ts`, `hadith.e2e-spec.ts`, `tags.e2e-spec.ts`, `sources.e2e-spec.ts`, `auth.e2e-spec.ts`,
  `favorites.e2e-spec.ts`, `admin-classification.e2e-spec.ts`, `admin-content-sync.e2e-spec.ts`,
  `health.e2e-spec.ts`.
- **Assertions to insist on:** the envelope shape (`data`/`meta`) on every `200`; `/v1` prefix enforced;
  `401` vs `403` distinction on an admin route hit by a normal user; the exact `error.code` strings in §2.5;
  `GET /sins/:slug/quotes` returns `items` in descending `relevanceScore` for a fixture with known scores.
- **Note:** the existing `app.e2e-spec.ts` asserts `GET /` returns `Hello World!`. Adding the global `/v1`
  prefix breaks it — update or delete that spec **in the same commit** that adds the prefix, and say so in the PR.
- External providers are **never** called in tests: `ContentProvider` implementations are stubbed; raw fixture
  JSON lives in `backend/test/fixtures/<provider>/*.json`.
- Coverage target: 80 % lines on `src/modules/**/*.service.ts`; controllers are covered by e2e instead. Not a CI
  gate before phase 5 ([devops-plan §2](./devops-plan.md#2-continuous-integration-github-actions)).

---

## 12. Build order for Cursor (do these in sequence)

1. `prisma/prisma.service.ts` + `PrismaModule` (`@Global()`), registered in `app.module.ts`.
2. `common/`: `PaginationQueryDto`, `LocaleQueryDto`, `ResponseEnvelopeInterceptor`, `AllExceptionsFilter`, `arabic-normalizer.ts`, `TransformToArray`.
3. `main.ts` bootstrap (§6) — and fix `app.e2e-spec.ts` in the same commit.
4. `health/` module.
5. `quotes/` module — `QuoteDto` + `toQuoteDto` + `buildQuoteInclude` first; everything downstream depends on it.
6. `sources/`, `tags/` (public reads).
7. **`sins/`** then **`good-deeds/`** — endpoints 1–7, the core loop. Highest test coverage here. Their grade
   filtering (§4.1) needs `GradePolicy.assertRenderable`/`defaultAllowedGrades()`, which §1.6 assigns to
   `hadith/` — build *only* `modules/hadith/grade-policy.ts` (+ its §11.1 unit tests) first, exported from a thin
   `HadithModule` with no HTTP routes yet, before implementing `findQuotesForSin`/`findQuotesForGoodDeed`. This
   keeps the module ownership in §1.6 while fixing the ordering: the core loop must never ship without the grade
   policy already gating it.
8. `quran/`, the rest of `hadith/` (HTTP endpoints, collection reads — `GradePolicy` already exists from step 7).
9. `classification/` admin controller (endpoints 48–57) + admin CRUD (28–47).
10. `content-sync/` (endpoints 58–60) — see [content-pipeline-plan.md](./content-pipeline-plan.md).
11. `auth/` + `users/` + `favorites/` (endpoints 19–27) — phase 4.
12. `kinship/` + the `good-deeds`/`auth` additions (endpoints 62–83) — phase 4b, after approval; order in
    [silat-rahim-plan §12](./silat-rahim-plan.md#12-build-order-for-cursor).
13. `iman-branches/` + the `sins`/`classification`/`quotes`/`sources` additions (endpoints 84–103) — phase 3b,
    then book importers + tafsir — phase 5b, after approval; order in
    [vision-v2-plan §17](./vision-v2-plan.md#17-for-cursor--build-order).

Steps 1–9 are phase 2 in the [roadmap](./roadmap.md); each step is independently shippable and testable with a
REST client before any UI exists.
