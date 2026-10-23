# API latency: measurements and changes

## Method

Production slowness is round trips: Vercel `iad1` (Washington) to Neon `eu-central-1` (Frankfurt) is
about 90 ms per round trip, so a page with 20 sequential database steps costs seconds. To measure that
locally, a scratch TCP proxy in front of the local Postgres adds 45 ms each way (90 ms RTT) and counts
statements (Bind/Query messages). The same proxy reproduced production: `/v1/sins/ghibah/quotes` took
**4.09 s** at 90 ms RTT against 0.2 s without delay (production measured 4.3 s). Each figure below is the median
of 3 warm requests, local `thekra` database, `NODE_ENV=test` (no throttling), own copy of the API.

## Before / after (90 ms simulated RTT)

| Endpoint | Statements before → after | ms before → after |
| --- | --- | --- |
| `/v1/sins/ghibah/quotes?limit=10&lang=ar` | 31 → 22 | 4087 → **813** |
| `/v1/sins/ghadab/quotes?limit=10&lang=en` | 33 → 23 | 4218 → **808** |
| `/v1/sins/ghadab/quotes?…&theme=…` (merged theme; was `kaff-milk`) | 17 → 17 | 1933 → 797 |
| `/v1/good-deeds/hifz-al-lisan/quotes?limit=10&lang=ar` | 32 → 23 | 3385 → **978** |
| `/v1/branches/1/quotes?limit=10&lang=ar` | 14 → 10 | 1850 → **603** |
| `/v1/quotes/:id/explanations?lang=ar` | 4 → 4 | 399 → 326 |
| `/v1/topic-themes` | 2 → 2 | 104 → 114 |
| `/v1/sins?limit=100&lang=ar` | 5 → 3 | 625 → 280 |
| `/v1/good-deeds?limit=100&lang=ar` | 6 → 3 | 676 → 326 |
| `/v1/branches?lang=ar` | 5 → 3 | 520 → 239 |
| `/v1/sins/ghibah?lang=en` | 4 → 4 | 427 → 443 |

Statements are not round trips: independent statements now run together, so the sequential depth fell from
about 17 steps to 5 on the topic quote pages (slug lookup, ranked rows and their `quote` select, then the page's
texts and their tags).

## What changed

- **No `$transaction([...])` on public reads.** A batch transaction runs BEGIN, each statement, COMMIT one
  after another. Now `Promise.all` (sins, good-deeds, branches lists and quotes, sources, tags, quran, hadith).
- **Topic quote pages (sins, good-deeds):** one wave for everything that needs only the topic (ranked links,
  kind counts, theme counts, alternatives, the paired side's ranked links, derived-topic links), then one wave
  for the page texts. `meta.total` and `countsByType` come from the ranked rows, so the separate `count` and
  `groupBy` are gone. The paired side is read with a relation filter instead of looking the deed up first.
- **`countsByKind`:** one grouped query instead of three counts.
- **Quote relations in parallel (`QuotesService.hydrateLinks`).** Prisma runs the sibling relations of a nested
  `include` one after another (quote, source, tags, tag, matches, referenceHadith: six sequential statements per
  page, 190 ms each at 90 ms RTT). The page's texts, sources, translations, tags and best match now load as five
  flat queries at once, and the result has the same shape the include produced.
- **Explanations:** the open-flag check runs beside the explanation query.
- **Derived topics:** groups load in parallel, in the same order.
- **Region:** `"regions": ["fra1"]` in `backend/vercel.json` (see `docs/deploy/VERCEL.md`): the remaining database
  round trips cost ~1 ms instead of ~90 ms in production.
- **CDN cache:** `Cache-Control` on public GET routes only (see below).

Not changed on purpose: `relationLoadStrategy: "join"` is a preview feature in Prisma 6.19 (the client type is
absent without `previewFeatures = ["relationJoins"]`), so it needs a schema change and its own review.

## Behaviour check

Before/after JSON for 10 topics (sins `ghadab ghibah riya zina tark-as-salah`, good deeds
`kaff-al-ghadab hifz-al-lisan ikhlas iffa salah`), `ar` and `en`, plain, `kind=hadith`, `kind=verse`, every
`theme=` (and `theme + kind=hadith` in `ar`), plus the sins, good-deeds and branches lists (ar, en), branches
1, 7, 30 quotes, `kind=hadith` on branch 3, `topic-themes`, `sins/ghibah`, and three quotes with
explanations and detail: 248 responses. 217 are byte-identical. The other 31 are the `ghadab` ↔ `kaff-al-ghadab` pages
(merged chip, merged `?theme=` list) and one `en` label in `/v1/topic-themes` (see `THEME_AUDIT.md`).

## CDN cache

Public, read-only GET routes carry `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`
(`@PublicCache(PUBLIC_CACHE.<preset>)` per route; no global default). A request with an `Authorization` header or
a cookie gets `private, no-store`; errors get nothing. A test walks every controller's route metadata and pins the
exact list of cached routes, so a new route is uncached until it is added to that list.

## What remains slow, and why

- A cold CDN miss still runs ~5 sequential database steps: slug lookup, ranked rows (the `quote` select inside
  them is a second statement), then the page's texts and tags. In Frankfurt that is a few tens of ms.
- Each new Prisma connection prepares statements again (two round trips per new statement), so the first request
  on a fresh function instance is slower than the medians above.
- `/v1/sins?limit=100`: the "has public text" filter is a large subquery per sin; ~100 ms even locally.
- Ranked rows load every link of a topic (hundreds of rows) to order a page in memory; a SQL window query would cut
  the payload but needs the reading order (`compareReading`) expressed in SQL.
- Admin edits and `release-db.sh push` show up after `s-maxage` (≤ 5 min on topic pages).

## Hosting cost (5 lines)

1. Fewer sequential round trips shortens each invocation (fewer GB-seconds of active time) by roughly 4 to 5 times on topic pages.
2. Cache hits are served by the CDN without invoking the function, so repeat reads of a topic page cost no function time or Neon compute.
3. Neon's compute wakes less often and for less time, which matters on its free/launch tier.
4. `fra1` is one region, which Hobby allows; moving to Pro for more regions is not required.
5. Parallel waves use up to ~7 connections at once; keep the Neon pooled URL (`DATABASE_URL`) so that does not exhaust direct connections.
