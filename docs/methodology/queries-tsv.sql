-- ============================================================================
-- docs/methodology/queries-tsv.sql  (read-only; variables come from check-tsv-links.sh)
--   :low_ids, :high_ids   quoteIds from docs/taxonomy/sahihayn-hadith-map.tsv (confidence low / high)
--   :keep_ids, :drop_ids  quoteIds from docs/taxonomy/athar-review.tsv (decision keep / drop)
--   :he_ids               HadeethEnc ids (externalId) from docs/taxonomy/hadeethenc-map.tsv with topics
--   :ayah_drop_link_ids   linkIds from docs/taxonomy/ayah-dropped.tsv
-- ============================================================================
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
flags AS (
  SELECT q.id, (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL) AS text_ok,
         (q.id IN (SELECT "quoteId" FROM open_high)) AS high_flag,
         (q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_ok,
         (EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
          OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS topic_linked
  FROM "Quote" q
)
SELECT 'sahihayn low rows' AS set_name,
       count(*) AS ids_in_db,
       count(*) FILTER (WHERE f.text_ok AND NOT f.high_flag AND f.grade_ok) AS published,
       count(*) FILTER (WHERE NOT f.topic_linked) AS not_topic_linked
FROM "Quote" q JOIN flags f ON f.id = q.id
WHERE q.id IN (:low_ids)
UNION ALL
SELECT 'sahihayn high rows', count(*),
       count(*) FILTER (WHERE f.text_ok AND NOT f.high_flag AND f.grade_ok),
       count(*) FILTER (WHERE NOT f.topic_linked)
FROM "Quote" q JOIN flags f ON f.id = q.id
WHERE q.id IN (:high_ids);

-- athar-review.tsv: does the database hold the same decision for each file row?
SELECT 'athar keep (file)' AS set_name, count(*) AS ids_in_db,
       count(*) FILTER (WHERE q."atharReviewDecision" = 'KEEP') AS db_keep,
       count(*) FILTER (WHERE q."atharSpeakerKey" IS NOT NULL) AS db_listed
FROM "Quote" q WHERE q.id IN (:keep_ids)
UNION ALL
SELECT 'athar drop (file)', count(*),
       count(*) FILTER (WHERE q."atharReviewDecision" = 'DROP'),
       count(*) FILTER (WHERE q."atharSpeakerKey" IS NOT NULL)
FROM "Quote" q WHERE q.id IN (:drop_ids);

-- HadeethEnc rows with topics: are they linked in the database?
SELECT 'hadeethenc rows with topics' AS set_name, count(*) AS ids_in_db,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS topic_linked
FROM "Quote" q
WHERE q."apiProvider" = 'hadeethenc.com' AND q."externalId" IN (:he_ids);

-- ayah-dropped.tsv: the dropped link rows must be gone
SELECT 'ayah dropped link ids' AS set_name,
       (SELECT count(*) FROM "SinQuote" WHERE id IN (:ayah_drop_link_ids))
       + (SELECT count(*) FROM "GoodDeedQuote" WHERE id IN (:ayah_drop_link_ids)) AS still_present;
