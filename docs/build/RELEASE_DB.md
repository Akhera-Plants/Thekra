# Release database: local content → production Neon

The local Postgres (`thekra`, docker compose service `db`) is the single source of truth for
the curated content. Production gets a **cleaned copy** of it, built and checked by
[`scripts/release-db.sh`](../../scripts/release-db.sh). This replaces
`scripts/db-push-to-neon.sh`, which copied the local database as is, including the
development accounts. That script is now a stub that refuses to run.

```
thekra ──pg_dump──▶ thekra_release ──clean.sql──▶ verify ──▶ /tmp/thekra-release.dump ──push──▶ Neon
(read only)          (scratch copy)                (SQL + API)                                (direct URL)
```

## What is removed, and why

All cleaning happens in the scratch copy `thekra_release`, never in `thekra`. The statements
are in [`backend/prisma/release/clean.sql`](../../backend/prisma/release/clean.sql), and each
one carries a comment explaining it.

| Removed | Why |
| --- | --- |
| Every `User` row | The local accounts are development seeds: `user@thekra.local` and `admin@thekra.local`, both with the published password `password123456`. Anything else is someone who registered locally. Production gets a fresh admin from `admin:create`. |
| Every `Favorite` row | Each row is one user's saved quote (personal data). It is the only table with a foreign key to `User`. |
| Refresh tokens / sessions | Nothing to remove: refresh tokens are stateless JWTs, and there is no token or session table. |
| Every `SyncLog` row | Run history of local content-sync jobs: timings and error text from the developer's machine. The API only shows it on admin routes. |
| `QuoteFlag.resolvedBy` values | These hold local user ids, which would point at nobody in production. Today every value is already NULL. The flags themselves stay. |
| Local `_prisma_migrations` rows | Replaced by the rows a fresh `prisma migrate deploy` writes. Three local rows (`add_query_indexes`, `add_sin_rank`, `add_iman_branches`) carry checksums of older versions of their files. The schema itself is identical, and each build diffs it to prove so. |

A guard in `clean.sql` fails the build if any table with a foreign key to `User` still has
rows, so a child table added later cannot slip through.

## Tables: keep or drop

Sizes are local totals (heap + indexes + TOAST) as of 2026-10-22.

| Table | Rows | Size | Ships | Reason |
| --- | ---: | ---: | --- | --- |
| Quote | 65 182 | 158 MB | keep | The content. `rawPayload` (29 MB) is never serialised. It stays as provenance: OpenITI corpus URI and commit, plus pre-cleanup originals. |
| Explanation | 44 916 | 69 MB | keep | Tafsir and sharh served on quote and ayah pages. `rawPayload` is 3.8 MB and kept for the same reason. |
| ReferenceHadith | 10 407 | 29 MB | keep | The Bukhari/Muslim matn shown through HadithMatch. The review screens read it too. |
| SectionItem | 70 868 | 28 MB | keep | The book structure, in the author's order. |
| HadithMatch | 46 288 | 21 MB | keep | The public quote mapper reads non-REJECTED strong matches, CANDIDATE rows included (`src/common/mappers/quote.mapper.ts:6`). Review routes confirm and reject them. |
| GoodDeedQuote, SinQuote, ImanBranchQuote | 13 827 / 4 279 / 10 991 | 24 MB | keep | Topic links and their reviewer status. Public feeds serve ACCEPTED links only. |
| Translation | 17 470 | 10 MB | keep | Quote translations. |
| BookSection | 10 052 | 4.4 MB | keep | Book headings (the reviewer's taxonomy). |
| QuoteFlag | 8 530 | 3.7 MB | keep | OPEN HIGH flags hide quotes from the public (`grade-policy.ts:139`). Resolved flags record reviewer work. |
| Sin, GoodDeed, ImanBranch, TopicDomain, TopicDerivation | 89 / 80 / 77 / 12 / 24 | 1.2 MB | keep | Topics and their structure. |
| ImanBranchGoodDeed, ImanBranchSin, ChapterEntityMap | 72 / 14 / 117 | 0.5 MB | keep | Curation maps the API reads and writes. |
| Source | 89 (88 canonical) | 72 kB | keep | Book catalogue, including the alias row `Quran.com (API)`. |
| Tag, QuoteTag | 12 / 15 | 0.1 MB | keep | Served by `/v1/tags` and the quote DTO. |
| TopicLabel | 20 | 64 kB | keep | Not read by the API today (deferred akhlaq labels). It is reviewer data and tiny, so it stays. |
| _prisma_migrations | 31 | 32 kB | keep (rewritten) | See above. |
| User | 2 | 48 kB | **drop rows** | Development seed accounts. |
| Favorite | 3 | 48 kB | **drop rows** | Belongs to users. |
| SyncLog | 494 | 296 kB | **drop rows** | Local job history. |

Nothing else is trimmed. The API never reads `rawPayload`, but dropping it would save only
~33 MB and lose provenance. The custom-format dump is **50 MB** compressed, and restores to
roughly the local 360 MB.

## Run it

Prerequisites:
- The local stack is up: `docker compose up -d db`.
- The API is built: `pnpm --filter backend build`. The build boots `backend/dist/main.js` once.
- `psql`, `curl`, `node` and `pnpm` are on `PATH`.

The host's Homebrew client tools are v14 and cannot dump the v16 server. The script notices
and uses `pg_dump`/`pg_restore` from inside the `db` container instead. To use other
binaries, set `PG_BIN=/path/to/pg16/bin`.

### 1. Build

```bash
scripts/release-db.sh build
```

The build runs these steps, and any miss fails it:

1. `pg_dump` of `thekra` (read only).
2. Drops and recreates `thekra_release`, then restores into it in a single transaction.
3. Runs `clean.sql`, which refuses any database other than `thekra_release`.
4. Schema probe: a fresh `prisma migrate deploy` into `thekra_release_schema`. The script diffs that schema against `thekra_release`, copies the probe's `_prisma_migrations` rows over, and drops the probe.
5. [`verify.sql`](../../backend/prisma/release/verify.sql) on both databases. It prints every check side by side (see *Verify* below).
6. Boots the API on a free port (3190+) against `thekra_release`, curls the endpoints below, and stops the API. Each must return 200 with data, and the totals must equal the SQL counts:
   - `/health` and `/health/ready`
   - `/v1/sins?limit=1&lang=ar`
   - `/v1/good-deeds/dhikr/quotes?limit=1&lang=ar`
   - `/v1/sources?limit=5`
7. `pg_dump` of `thekra_release` to `/tmp/thekra-release.dump`. The script checks that the archive contains `EXTENSION pg_trgm` and `thekra_normalize_ar(text)`. It also scans the whole data section and fails if it finds `@thekra.local` or an `$argon2` hash.
8. Writes `/tmp/thekra-release.manifest` (time, sha256, size, server version) and `/tmp/thekra-release.verify.txt`, then prints the dump size.

`thekra_release` is kept afterwards for inspection. The next build drops and recreates it.

### 2. Push (owner, with the Neon URL)

Neon's schema must already be deployed: the API's Vercel build runs `prisma migrate deploy`.

```bash
export NEON_DATABASE_URL='postgresql://…@ep-….neon.tech/neondb?sslmode=require'   # DIRECT host, no -pooler
scripts/release-db.sh push          # asks you to type PUSH; --yes skips the prompt
```

Before it touches anything, `push` refuses when:
- `NEON_DATABASE_URL` is missing;
- the URL is the pooled host (`-pooler`, `pgbouncer=true`);
- the URL points at the local `thekra` or `thekra_release`;
- the dump is missing;
- no completed build is recorded;
- the dump is older than the last build start (that build did not finish);
- the dump's sha256 differs from the manifest;
- Neon's PostgreSQL major version is older than the dump's;
- Neon lacks `_prisma_migrations`, or its applied migrations differ from `backend/prisma/migrations`. In that case, deploy this commit's API first.

The URL is never printed: only `host/database` is shown.

If Neon already has users, `push` warns that they will be deleted: every table is replaced.

The restore runs as `pg_restore --clean --if-exists --no-owner --no-acl --single-transaction
--exit-on-error`. One transaction means any error leaves Neon as it was. pg_restore follows
the archive's dependency order, so `CREATE EXTENSION pg_trgm` and `thekra_normalize_ar` come
before the tables and the two trigram indexes that need them. `_prisma_migrations` arrives
with the repo checksums, identical to what `migrate deploy` wrote. Afterwards the script runs
`ANALYZE` on the public tables, then runs `verify.sql` on Neon and on `thekra_release` and
prints them side by side. If the release DB is gone or has changed, it compares against the
build-time snapshot instead.

Tested before the first real push (2026-10-22): two full pushes into a Neon-like local
database. Its owner was a non-superuser, as on Neon, and its schema came from
`prisma migrate deploy`. The second push went over an already-filled copy with one user in
it. Both passes ended with 87/87 checks ok. A real Neon project has not been pushed to yet.

### 3. Create the production admin

```bash
DATABASE_URL='<Neon URL>' ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='<16+ characters>' \
  pnpm --filter backend admin:create
```

- It creates the user with role ADMIN or, if the email exists, resets its password and sets ADMIN. Running it twice is safe.
- It hashes with the same argon2id settings as `AuthService` (`src/modules/auth/password-hash.ts`: 19 MiB, t=2, p=1).
- It refuses:
  - a password under 16 or over 128 characters;
  - a password with leading or trailing whitespace;
  - a password equal to the email;
  - a malformed email;
  - the two seed emails.
- It does **not** read `backend/.env`, so `DATABASE_URL` must be set explicitly. The log line shows only `host/database`.
- Re-run it after every `push`, because a push replaces the `User` table.

## Verify

`verify.sql` is read-only and runs identically on `thekra`, `thekra_release` and Neon. Each row
is `key|value`:

| Keys | Rule |
| --- | --- |
| `content.rows.*` | Row count of every shipped table. Must be equal everywhere. |
| `content.digest.*` | md5 over Source names, Quote text/grade/updatedAt, link review status, flags and athar decisions. Equal counts with different rows still fail. |
| `content.public.*` | What the public API serves. Must be equal everywhere. Covers: published quotes (`readerClause` + SAHIH/HASAN), quotes hidden by OPEN HIGH flags, listed sins and good deeds with per-topic link counts (digest), canonical sources, and published quotes per source. |
| `content.topic.*` | Verses, hadith, athar and other texts for the four largest sins, the four largest good deeds, and `dhikr`. Split the same way as `QuotesService.countsByKind`. |
| `private.*` | User, Favorite, SyncLog, `resolvedBy`, `@thekra.local` mentions. Must be 0 in release and Neon. |
| `schema.*` | `thekra_normalize_ar(text)` and `pg_trgm` exist (=1), the function's output on a sample, plus table/index/trigram-index/constraint/enum counts. |
| `migrations.*` | Applied count and digest. Must equal the repo (sha256 of each `migration.sql`). |

The SQL predicates mirror the API. On 2026-10-22 they were checked against the running API on
the full local DB, and they agreed:
- every one of the 84 public sins and 77 good deeds had the same `quoteCount`;
- source totals and `publishedQuoteCount` matched (88 sources, 21 250 published);
- `countsByKind` matched for dhikr, sadaqah, kadhib and sabb-lan.

When `grade-policy.ts` or `public-taxonomy.ts` change, update `verify.sql` with them.

After a push, check by hand:

```bash
curl -s https://<api>/health/ready                 # {"data":{"status":"ok","checks":{"database":"up"}}}
curl -s 'https://<api>/v1/sources?limit=5'         # meta.total = 88
curl -s 'https://<api>/v1/sins?limit=1&lang=ar'    # meta.total = 84
```

These numbers were measured with `ATHAR_PUBLIC_ENABLED=true` (the local `.env`). With the flag
off, the API serves no athar, so totals that include kept athar come out lower. The database
checks in `verify.sql` do not depend on the flag.

## After a push: what readers see, and when

Public GET routes are cached by Vercel's CDN (`s-maxage` 60–600 s plus a stale window, see
[`docs/deploy/VERCEL.md`](../deploy/VERCEL.md) "Latency"). A pushed content change therefore shows within
`s-maxage` (at most 5 minutes for topic pages, plus one stale answer inside `stale-while-revalidate`).
Nothing needs purging; to see it at once, redeploy the API (a new deployment has an empty CDN cache).

## Environment variables used here

These are inputs to one-off commands, not app config. The API never reads them, so CI does
not set them, and they must not be stored in `backend/.env`.

| Name | Used by | Value |
| --- | --- | --- |
| `NEON_DATABASE_URL` | `release-db.sh push` | Neon **direct** connection string |
| `LOCAL_DATABASE_URL` | `release-db.sh` (optional) | Source DB; default is `DATABASE_URL` from `backend/.env` |
| `PG_BIN`, `PG_CONTAINER` | `release-db.sh` (optional) | pg_dump/pg_restore location |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin:create` | Production admin; password ≥ 16 characters |
