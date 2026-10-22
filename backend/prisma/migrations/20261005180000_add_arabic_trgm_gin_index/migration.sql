-- Migration: 20261005180000_add_arabic_trgm_gin_index
--
-- Phase 5: Arabic full-text search upgrade.
--
-- Adds a GIN trigram index on the normalised Arabic text column so that
-- the `thekra_normalize_ar("textAr") ILIKE '%…%'` queries in arabic-search.ts
-- use an index scan instead of a sequential scan on the growing Quote table.
--
-- Prerequisites:
--   1. The `pg_trgm` extension (bundled with PostgreSQL but must be enabled).
--      Create it with: CREATE EXTENSION pg_trgm;
--      This is done via IF NOT EXISTS — safe to re-run.
--   2. The `thekra_normalize_ar` function must exist (migration
--      20261005000001_add_arabic_normalize_fn creates it).
--
-- IMPORTANT for production:
--   Creating a GIN index on a large table is a blocking DDL in Postgres.
--   For tables > ~50k rows consider `CREATE INDEX CONCURRENTLY` (cannot be
--   inside a transaction block).  This migration uses CONCURRENTLY via a
--   manual step comment below — the migration itself is safe for the current
--   dataset size.
--
-- If pg_trgm is not available (e.g. restricted managed Postgres), the
--   `CREATE INDEX IF NOT EXISTS` will fail.  In that case:
--     1. Check availability: SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm';
--     2. Request the extension from your provider.
--     3. Re-run the migration once it is available.
--   The app will work without this index — it falls back to a sequential scan.

-- ── 1. Enable pg_trgm ────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. GIN index on normalised Arabic text ───────────────────────────────────
-- Expression: thekra_normalize_ar("textAr")  using gin_trgm_ops
-- Supports: ILIKE '%…%', similarity(), word_similarity()
--
-- For large tables, run this out-of-band as:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "Quote_textAr_trgm_gin"
--     ON "Quote" USING gin (thekra_normalize_ar("textAr") gin_trgm_ops);
-- then mark this migration as applied manually.

CREATE INDEX IF NOT EXISTS "Quote_textAr_trgm_gin"
  ON "Quote"
  USING gin (thekra_normalize_ar("textAr") gin_trgm_ops);
