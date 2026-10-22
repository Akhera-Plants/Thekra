-- Migration: 20261005000003_add_query_indexes
--
-- D-3: Additive indexes for hot query paths identified in P2-17.
--
-- Every statement uses IF NOT EXISTS so the migration is safe to re-run and
-- idempotent against databases that already have some of these indexes.
--
-- Hot paths covered:
--   SinQuote(quoteId)                — filter by quote across all sins
--   SinQuote(sinId, relevanceScore)  — list sin's links ordered by score (core reminder loop)
--   GoodDeedQuote(quoteId)           — filter by quote across all good deeds
--   GoodDeedQuote(goodDeedId, relevanceScore) — list deed's links ordered by score
--   GoodDeed(oppositeSinId)          — fetch all good deeds opposite a given sin (P1-8)
--   QuoteTag(tagId)                  — fetch all quotes for a tag
--   Quote(grade)                     — grade-policy filter on hadith queries
--   Quote(type, grade)               — combined type+grade filter (public quote search)
--   Tag(category)                    — filter tags by category
--
-- Existing indexes (no-op / already covered):
--   Quote(type)                      — @@index([type]) in init migration
--   Quote(sourceId)                  — @@index([sourceId]) in init migration
--   SinQuote(sinId, quoteId)         — @@unique covers sinId as leading column
--   GoodDeedQuote(goodDeedId, quoteId) — @@unique covers goodDeedId as leading column
--   Translation(quoteId, languageCode) — @@unique covers quoteId lookups
--
-- Phase 5 note (backend-plan §4.4): GIN trigram indexes on
--   thekra_normalize_ar("textAr") will be added in a separate Phase 5 migration
--   to avoid blocking the table during Phase 2/3 ingestion.

-- SinQuote ────────────────────────────────────────────────────────────────────

-- Filter by quoteId to find which sins reference a given quote.
CREATE INDEX IF NOT EXISTS "SinQuote_quoteId_idx"
  ON "SinQuote" ("quoteId");

-- Support the core reminder loop: fetch links for a sin sorted by relevanceScore.
-- Composite (sinId, relevanceScore DESC) lets Postgres satisfy the WHERE sinId=?
-- ORDER BY relevanceScore DESC with an index-only scan.
CREATE INDEX IF NOT EXISTS "SinQuote_sinId_relevanceScore_idx"
  ON "SinQuote" ("sinId", "relevanceScore" DESC NULLS LAST);

-- GoodDeedQuote ───────────────────────────────────────────────────────────────

-- Filter by quoteId to find which good deeds reference a given quote.
CREATE INDEX IF NOT EXISTS "GoodDeedQuote_quoteId_idx"
  ON "GoodDeedQuote" ("quoteId");

-- Support the core reminder loop: fetch links for a good deed sorted by score.
CREATE INDEX IF NOT EXISTS "GoodDeedQuote_goodDeedId_relevanceScore_idx"
  ON "GoodDeedQuote" ("goodDeedId", "relevanceScore" DESC NULLS LAST);

-- GoodDeed ────────────────────────────────────────────────────────────────────

-- P1-8 / P2-17: fetch all good deeds that are the opposite of a given sin.
-- Used by GET /sins/:slug (relatedGoodDeeds) and GET /sins/:slug/quotes (alternatives).
CREATE INDEX IF NOT EXISTS "GoodDeed_oppositeSinId_idx"
  ON "GoodDeed" ("oppositeSinId");

-- QuoteTag ────────────────────────────────────────────────────────────────────

-- P2-17: fetch all quotes for a given tag (e.g. for tag detail page in Phase 3).
-- The @@unique([quoteId, tagId]) index is already on quoteId as the leading column,
-- but we need a standalone index on tagId for the reverse lookup.
CREATE INDEX IF NOT EXISTS "QuoteTag_tagId_idx"
  ON "QuoteTag" ("tagId");

-- Quote ───────────────────────────────────────────────────────────────────────

-- Grade-policy filter: WHERE grade IN ('SAHIH', 'HASAN') on HADITH-type quotes.
CREATE INDEX IF NOT EXISTS "Quote_grade_idx"
  ON "Quote" ("grade");

-- Combined type+grade filter used by the public quote search grade policy:
-- WHERE (type != 'HADITH') OR (grade IN (...)) maps to a scan on (type, grade).
CREATE INDEX IF NOT EXISTS "Quote_type_grade_idx"
  ON "Quote" ("type", "grade");

-- P2-17: ayah lookups within a surah (GET /quran/surahs/:n/ayahs, findAyah).
CREATE INDEX IF NOT EXISTS "Quote_type_surahNumber_ayahNumber_idx"
  ON "Quote" ("type", "surahNumber", "ayahNumber");

-- Tag ─────────────────────────────────────────────────────────────────────────

-- Filter tags by category (e.g. SIN, GOOD_DEED, THEME, EMOTION).
CREATE INDEX IF NOT EXISTS "Tag_category_idx"
  ON "Tag" ("category");
