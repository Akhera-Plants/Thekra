-- Release verification queries (scripts/release-db.sh). READ-ONLY: SELECTs only,
-- so the same file runs against the local `thekra`, the scratch `thekra_release`,
-- and production Neon. psql is called with -At -F'|', so every row is `key|value`.
--
-- Key families and how release-db.sh judges them:
--   content.*     must be identical in every database (thekra = thekra_release = Neon).
--   private.*     must be 0 in thekra_release and Neon (the local thekra keeps its rows).
--   schema.*      must be identical in thekra_release and Neon, and the existence checks must be 1.
--   migrations.*  must be identical in thekra_release and Neon (thekra may differ, see clean.sql).
--
-- The public predicates mirror backend/src (keep them in step when those change):
--   GradePolicy.readerClause()       src/modules/hadith/grade-policy.ts:144
--   GradePolicy.whereClause(SAHIH, HASAN) for «published» (sources' publishedQuoteCount)
--   publicAcceptedLinkWhere()        src/modules/classification/public-taxonomy.ts:38
--   visibleOrigins / sinHasPublicText src/modules/classification/reading.ts
-- Every ORDER BY that feeds a digest uses COLLATE "C", so Neon's default collation cannot change it.
-- Athar count as public (KEEP + listed speaker), i.e. ATHAR_PUBLIC_ENABLED=true; they are
-- also reported on their own (`.athar`) so the flag-off numbers can be read off.

WITH
kept_athar AS (
  SELECT q.id FROM "Quote" q
  WHERE q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'
),
-- GradePolicy.readerClause(): public text, publishable, no open HIGH flag, not author commentary.
reader AS (
  SELECT q.id, q.type, q."isAthar", q."atharReviewDecision" AS decision, q.grade, q."sourceId"
  FROM "Quote" q
  WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND (q.type <> 'HADITH'
         OR q."gradeSource" IN ('SAHIHAYN', 'AUTO_SAHIHAYN', 'MANUAL', 'SUNAN_TAHQIQ', 'HADEETHENC')
         OR q.id IN (SELECT id FROM kept_athar))
    AND NOT EXISTS (
      SELECT 1 FROM "QuoteFlag" f
      WHERE f."quoteId" = q.id AND f.status = 'OPEN' AND f.severity = 'HIGH')
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
),
-- readerClause + whereClause([SAHIH, HASAN]): what /v1/sources counts as published.
published AS (
  SELECT r.* FROM reader r
  WHERE r.type <> 'HADITH' OR r.grade IN ('SAHIH', 'HASAN') OR r.id IN (SELECT id FROM kept_athar)
),
-- publicAcceptedLinkWhere(): ACCEPTED, reader quote, not a «باب …» chapter note or an unscored Sa'di match.
sin_link AS (
  SELECT l."sinId" AS topic_id, r.id AS quote_id, r.type, r."isAthar", r.decision
  FROM "SinQuote" l JOIN reader r ON r.id = l."quoteId"
  WHERE l."reviewStatus" = 'ACCEPTED'
    AND NOT (l.note LIKE 'باب %'
             OR (l.note LIKE '%تفسير السعدي%' AND (l."relevanceScore" IS NULL OR l."relevanceScore" = 0)))
),
deed_link AS (
  SELECT l."goodDeedId" AS topic_id, r.id AS quote_id, r.type, r."isAthar", r.decision
  FROM "GoodDeedQuote" l JOIN reader r ON r.id = l."quoteId"
  WHERE l."reviewStatus" = 'ACCEPTED'
    AND NOT (l.note LIKE 'باب %'
             OR (l.note LIKE '%تفسير السعدي%' AND (l."relevanceScore" IS NULL OR l."relevanceScore" = 0)))
),
-- Public, listed topics (origin CURATED/TAXONOMY, not hidden, listed) with their own public texts,
-- or a contemporary topic that derives texts from a visible one (sinHasPublicText / deedHasPublicText).
public_sin AS (
  SELECT s.id, s.slug, (SELECT count(*) FROM sin_link k WHERE k.topic_id = s.id) AS n
  FROM "Sin" s
  WHERE s.origin IN ('CURATED', 'TAXONOMY') AND NOT s."isHidden" AND s."isListed"
    AND (EXISTS (SELECT 1 FROM sin_link k WHERE k.topic_id = s.id)
         OR (s."isContemporary" AND EXISTS (
               SELECT 1 FROM "TopicDerivation" d
               LEFT JOIN "Sin" ts ON ts.id = d."toSinId"
               WHERE d."fromSinId" = s.id
                 AND ((ts.id IS NOT NULL AND NOT ts."isHidden" AND EXISTS (SELECT 1 FROM sin_link k WHERE k.topic_id = ts.id))
                      OR EXISTS (SELECT 1 FROM deed_link k WHERE k.topic_id = d."toGoodDeedId")))))
),
public_deed AS (
  SELECT g.id, g.slug, (SELECT count(*) FROM deed_link k WHERE k.topic_id = g.id) AS n
  FROM "GoodDeed" g
  WHERE g.origin IN ('CURATED', 'TAXONOMY') AND NOT g."isHidden" AND g."isListed"
    AND (EXISTS (SELECT 1 FROM deed_link k WHERE k.topic_id = g.id)
         OR (g."isContemporary" AND EXISTS (
               SELECT 1 FROM "TopicDerivation" d
               LEFT JOIN "Sin" ts ON ts.id = d."toSinId"
               WHERE d."fromGoodDeedId" = g.id
                 AND ((ts.id IS NOT NULL AND NOT ts."isHidden" AND EXISTS (SELECT 1 FROM sin_link k WHERE k.topic_id = ts.id))
                      OR EXISTS (SELECT 1 FROM deed_link k WHERE k.topic_id = d."toGoodDeedId")))))
),
-- A handful of topics in detail: the four largest public sins and good deeds, plus dhikr
-- (the smoke-tested /v1/good-deeds/dhikr/quotes). Deterministic: count desc, then slug.
sample_topic AS (
  (SELECT 'sin' AS kind, id, slug FROM public_sin ORDER BY n DESC, slug COLLATE "C" LIMIT 4)
  UNION
  (SELECT 'deed', id, slug FROM public_deed ORDER BY n DESC, slug COLLATE "C" LIMIT 4)
  UNION
  (SELECT 'deed', id, slug FROM "GoodDeed" WHERE slug = 'dhikr')
),
sample_link AS (
  SELECT t.kind, t.slug, k.type, k."isAthar", k.decision
  FROM sample_topic t JOIN sin_link k ON t.kind = 'sin' AND k.topic_id = t.id
  UNION ALL
  SELECT t.kind, t.slug, k.type, k."isAthar", k.decision
  FROM sample_topic t JOIN deed_link k ON t.kind = 'deed' AND k.topic_id = t.id
),
checks(key, value) AS (
  -- ── private: rows that belong to people or to local development ──────────────
            SELECT 'private.rows.User', (SELECT count(*) FROM "User")::text
  UNION ALL SELECT 'private.rows.Favorite', (SELECT count(*) FROM "Favorite")::text
  UNION ALL SELECT 'private.rows.SyncLog', (SELECT count(*) FROM "SyncLog")::text
  UNION ALL SELECT 'private.rows.QuoteFlag.resolvedBy', (SELECT count(*) FROM "QuoteFlag" WHERE "resolvedBy" IS NOT NULL)::text
  UNION ALL SELECT 'private.rows.dev_email_mentions',
    (SELECT count(*) FROM "QuoteFlag" WHERE note ILIKE '%@thekra.local%' OR details::text ILIKE '%@thekra.local%')::text

  -- ── schema: what the app needs beyond the tables ─────────────────────────────
  UNION ALL SELECT 'schema.exists.fn_thekra_normalize_ar',
    (to_regprocedure('public.thekra_normalize_ar(text)') IS NOT NULL)::int::text
  UNION ALL SELECT 'schema.exists.ext_pg_trgm',
    (SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm')::text
  UNION ALL SELECT 'schema.fn_thekra_normalize_ar.sample',
    (SELECT public.thekra_normalize_ar('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ — أُولَٰئِكَ هُدًى'))
  UNION ALL SELECT 'schema.count.tables',
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::text
  UNION ALL SELECT 'schema.count.indexes',
    (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public')::text
  UNION ALL SELECT 'schema.count.trgm_indexes',
    (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '%gin_trgm_ops%')::text
  -- contype 'n' excluded: PostgreSQL 18 (Neon) records every NOT NULL column as a
  -- pg_constraint row, PostgreSQL 16 (local) does not. Same schema, different catalog.
  UNION ALL SELECT 'schema.count.constraints',
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = 'public' AND c.contype <> 'n')::text
  UNION ALL SELECT 'schema.count.enum_labels',
    (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public')::text

  -- ── migrations: Prisma's history (checksums are compared with the repo by the script) ─
  UNION ALL SELECT 'migrations.count',
    (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text
  UNION ALL SELECT 'migrations.digest',
    (SELECT md5(string_agg(migration_name || ':' || checksum, ',' ORDER BY migration_name COLLATE "C"))
     FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)

  -- ── content: row counts of every table that ships ────────────────────────────
  UNION ALL SELECT 'content.rows.Source', (SELECT count(*) FROM "Source")::text
  UNION ALL SELECT 'content.rows.Quote', (SELECT count(*) FROM "Quote")::text
  UNION ALL SELECT 'content.rows.Explanation', (SELECT count(*) FROM "Explanation")::text
  UNION ALL SELECT 'content.rows.ReferenceHadith', (SELECT count(*) FROM "ReferenceHadith")::text
  UNION ALL SELECT 'content.rows.HadithMatch', (SELECT count(*) FROM "HadithMatch")::text
  UNION ALL SELECT 'content.rows.QuoteFlag', (SELECT count(*) FROM "QuoteFlag")::text
  UNION ALL SELECT 'content.rows.Translation', (SELECT count(*) FROM "Translation")::text
  UNION ALL SELECT 'content.rows.BookSection', (SELECT count(*) FROM "BookSection")::text
  UNION ALL SELECT 'content.rows.SectionItem', (SELECT count(*) FROM "SectionItem")::text
  UNION ALL SELECT 'content.rows.Sin', (SELECT count(*) FROM "Sin")::text
  UNION ALL SELECT 'content.rows.GoodDeed', (SELECT count(*) FROM "GoodDeed")::text
  UNION ALL SELECT 'content.rows.SinQuote', (SELECT count(*) FROM "SinQuote")::text
  UNION ALL SELECT 'content.rows.GoodDeedQuote', (SELECT count(*) FROM "GoodDeedQuote")::text
  UNION ALL SELECT 'content.rows.ImanBranch', (SELECT count(*) FROM "ImanBranch")::text
  UNION ALL SELECT 'content.rows.ImanBranchQuote', (SELECT count(*) FROM "ImanBranchQuote")::text
  UNION ALL SELECT 'content.rows.ImanBranchGoodDeed', (SELECT count(*) FROM "ImanBranchGoodDeed")::text
  UNION ALL SELECT 'content.rows.ImanBranchSin', (SELECT count(*) FROM "ImanBranchSin")::text
  UNION ALL SELECT 'content.rows.ChapterEntityMap', (SELECT count(*) FROM "ChapterEntityMap")::text
  UNION ALL SELECT 'content.rows.TopicDomain', (SELECT count(*) FROM "TopicDomain")::text
  UNION ALL SELECT 'content.rows.TopicDerivation', (SELECT count(*) FROM "TopicDerivation")::text
  UNION ALL SELECT 'content.rows.TopicLabel', (SELECT count(*) FROM "TopicLabel")::text
  UNION ALL SELECT 'content.rows.Tag', (SELECT count(*) FROM "Tag")::text
  UNION ALL SELECT 'content.rows.QuoteTag', (SELECT count(*) FROM "QuoteTag")::text

  -- ── content: digests, so equal counts with different rows still fail ─────────
  UNION ALL SELECT 'content.digest.Source',
    (SELECT md5(string_agg(id || '|' || name || '|' || coalesce("nameAr", '') || '|' || coalesce("canonicalId", ''), ',' ORDER BY id COLLATE "C")) FROM "Source")
  UNION ALL SELECT 'content.digest.Quote',
    (SELECT md5(string_agg(id || '|' || md5("textAr") || '|' || "gradeSource" || '|' || coalesce(grade::text, '') || '|' || to_char("updatedAt", 'YYYYMMDDHH24MISSUS'), ',' ORDER BY id COLLATE "C")) FROM "Quote")
  UNION ALL SELECT 'content.digest.links',
    (SELECT md5(string_agg(x, ',' ORDER BY x COLLATE "C")) FROM (
       SELECT 's' || id || "reviewStatus" || basis AS x FROM "SinQuote"
       UNION ALL SELECT 'g' || id || "reviewStatus" || basis FROM "GoodDeedQuote"
       UNION ALL SELECT 'i' || id || "reviewStatus" || basis FROM "ImanBranchQuote") l)
  UNION ALL SELECT 'content.digest.QuoteFlag',
    (SELECT md5(string_agg(id || status || severity || type, ',' ORDER BY id COLLATE "C")) FROM "QuoteFlag")
  UNION ALL SELECT 'content.digest.athar_review',
    (SELECT md5(string_agg(id || coalesce("atharReviewDecision"::text, '-'), ',' ORDER BY id COLLATE "C")) FROM "Quote" WHERE "isAthar")

  -- ── content: what the public API serves ──────────────────────────────────────
  UNION ALL SELECT 'content.public.sources_canonical', (SELECT count(*) FROM "Source" WHERE "canonicalId" IS NULL)::text
  UNION ALL SELECT 'content.public.quotes_reader', (SELECT count(*) FROM reader)::text
  UNION ALL SELECT 'content.public.quotes_published', (SELECT count(*) FROM published)::text
  UNION ALL SELECT 'content.public.quotes_published.athar', (SELECT count(*) FROM published WHERE "isAthar")::text
  UNION ALL SELECT 'content.public.quotes_hidden_by_open_high_flag',
    (SELECT count(DISTINCT "quoteId") FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH')::text
  UNION ALL SELECT 'content.public.sins_listed', (SELECT count(*) FROM public_sin)::text
  UNION ALL SELECT 'content.public.sins_links', (SELECT coalesce(sum(n), 0) FROM public_sin)::text
  UNION ALL SELECT 'content.public.sins_digest', (SELECT md5(string_agg(slug || ':' || n, ',' ORDER BY slug COLLATE "C")) FROM public_sin)
  UNION ALL SELECT 'content.public.good_deeds_listed', (SELECT count(*) FROM public_deed)::text
  UNION ALL SELECT 'content.public.good_deeds_links', (SELECT coalesce(sum(n), 0) FROM public_deed)::text
  UNION ALL SELECT 'content.public.good_deeds_digest', (SELECT md5(string_agg(slug || ':' || n, ',' ORDER BY slug COLLATE "C")) FROM public_deed)
  UNION ALL SELECT 'content.public.sources_published_digest',
    (SELECT md5(string_agg("sourceId" || ':' || n, ',' ORDER BY "sourceId" COLLATE "C"))
     FROM (SELECT "sourceId", count(*) AS n FROM published GROUP BY 1) p)

  -- ── content: public texts per sample topic, split like QuotesService.countsByKind ──
  --   verses = QURAN_VERSE; hadith = HADITH, not athar; athar = HADITH, athar, KEEP; other = the rest.
  UNION ALL
  SELECT 'content.topic.' || t.kind || '.' || t.slug || '.' || part.name,
         (SELECT count(*) FROM sample_link s
          WHERE s.kind = t.kind AND s.slug = t.slug
            AND CASE part.name
                  WHEN 'verses' THEN s.type = 'QURAN_VERSE'
                  WHEN 'hadith' THEN s.type = 'HADITH' AND NOT s."isAthar"
                  WHEN 'athar'  THEN s.type = 'HADITH' AND s."isAthar" AND s.decision IS NOT DISTINCT FROM 'KEEP'
                  ELSE NOT (s.type = 'QURAN_VERSE' OR (s.type = 'HADITH' AND NOT s."isAthar")
                            OR (s.type = 'HADITH' AND s."isAthar" AND s.decision IS NOT DISTINCT FROM 'KEEP'))
                END)::text
  FROM sample_topic t
  CROSS JOIN (VALUES ('verses'), ('hadith'), ('athar'), ('other')) AS part(name)
)
SELECT key, coalesce(value, '<null>') FROM checks ORDER BY key COLLATE "C";
