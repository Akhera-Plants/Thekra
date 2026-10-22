-- ============================================================================
-- docs/methodology/queries.sql
-- Read-only queries behind hadith-methodology.md and shuab-al-iman.md.
--
-- Run (the first statement makes the whole session read-only):
--   psql "postgresql://thekra:thekra_dev_password@localhost:5432/thekra" \
--        -v ON_ERROR_STOP=1 -P pager=off -f docs/methodology/queries.sql
--
-- Assumptions (state them in any report that quotes a number):
--   * ATHAR_PUBLIC_ENABLED=true, as in backend/.env:11. An athar row is public only when
--     isAthar AND atharSpeakerKey IS NOT NULL AND atharReviewDecision = 'KEEP'.
--   * "published" = GradePolicy.readerClause() (backend/src/modules/hadith/grade-policy.ts):
--       text_ok       : textSource <> 'OCR' OR textVerifiedAt IS NOT NULL
--       not_structure : NOT (apiProvider = 'book-structure' AND type = 'BOOK_EXCERPT')
--       no open HIGH : no QuoteFlag with status OPEN and severity HIGH
--       grade_src_ok : type <> 'HADITH' OR gradeSource IN (SAHIHAYN, AUTO_SAHIHAYN, MANUAL,
--                      SUNAN_TAHQIQ, HADEETHENC), or the athar KEEP rule above
--   * "shown" = published AND grade_ok, where grade_ok = type <> 'HADITH' OR grade IN (SAHIH, HASAN)
--     OR athar KEEP. This matches GradePolicy.whereClause() with the default grades, which the
--     branch and list endpoints apply (iman-branches.service.ts, hadith.service.ts).
--   * "topic link (accepted)" = SinQuote / GoodDeedQuote with reviewStatus 'ACCEPTED'.
--   * "public topic link" also applies autoLinkExclusion() from
--     backend/src/modules/classification/public-taxonomy.ts: note NOT LIKE 'باب %', and not
--     «تفسير السعدي» with relevanceScore NULL or 0.
--   * "branch link (accepted)" = ImanBranchQuote with reviewStatus 'ACCEPTED'.
--   * Sources are canonical rows only (canonicalId IS NULL).
--   * Every query repeats the same CTE block, so nothing is written (no temp tables).
-- ============================================================================

SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

-- ---------------------------------------------------------------------------
-- Q00  Snapshot: when, and the global counts used in the reports
-- ---------------------------------------------------------------------------
SELECT now() AS snapshot_taken_at,
       (SELECT count(*) FROM "Source" WHERE "canonicalId" IS NULL) AS canonical_sources,
       (SELECT count(*) FROM "Quote") AS quotes_total,
       (SELECT count(*) FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED') AS sin_links_accepted,
       (SELECT count(*) FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED') AS deed_links_accepted,
       (SELECT count(*) FROM "SinQuote" WHERE "reviewStatus" = 'NOT_REVIEWED') AS sin_links_not_reviewed,
       (SELECT count(*) FROM "GoodDeedQuote" WHERE "reviewStatus" = 'NOT_REVIEWED') AS deed_links_not_reviewed,
       (SELECT count(*) FROM "ImanBranchQuote" WHERE "reviewStatus" = 'ACCEPTED') AS branch_links_accepted,
       (SELECT count(*) FROM "ImanBranch") AS iman_branches;

-- ---------------------------------------------------------------------------
-- Q01  Per source: imported, published, topic-linked, branch-linked, not linked
--      kind: hadith = HADITH and not athar; athar = isAthar; verse = QURAN_VERSE;
--            author = BOOK_EXCERPT (author text, not counted as hadith)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
qa AS (
  SELECT q.id, q."sourceId", q.type, q."isAthar", q.grade,
         (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP') AS athar_kept,
         (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL) AS text_ok,
         NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT') AS not_structure,
         (q.id IN (SELECT "quoteId" FROM open_high)) AS high_flag,
         (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_src_ok
  FROM "Quote" q
  JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL
),
pub AS (
  SELECT qa.*,
         CASE WHEN type = 'QURAN_VERSE' THEN 'verse'
              WHEN "isAthar" THEN 'athar'
              WHEN type = 'HADITH' THEN 'hadith'
              ELSE 'author' END AS kind,
         (text_ok AND not_structure AND NOT high_flag AND (grade_src_ok OR athar_kept)) AS published,
         (text_ok AND not_structure AND NOT high_flag AND (grade_src_ok OR athar_kept)
           AND (type <> 'HADITH' OR grade IN ('SAHIH','HASAN') OR athar_kept)) AS shown
  FROM qa
),
acc_topic AS (
  SELECT DISTINCT "quoteId" AS qid FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION
  SELECT DISTINCT "quoteId" FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED'
),
pub_topic AS (
  SELECT DISTINCT "quoteId" AS qid FROM "SinQuote"
  WHERE "reviewStatus" = 'ACCEPTED' AND NOT (note LIKE 'باب %')
    AND NOT (note LIKE '%تفسير السعدي%' AND ("relevanceScore" IS NULL OR "relevanceScore" = 0))
  UNION
  SELECT DISTINCT "quoteId" FROM "GoodDeedQuote"
  WHERE "reviewStatus" = 'ACCEPTED' AND NOT (note LIKE 'باب %')
    AND NOT (note LIKE '%تفسير السعدي%' AND ("relevanceScore" IS NULL OR "relevanceScore" = 0))
),
acc_branch AS (
  SELECT DISTINCT "quoteId" AS qid FROM "ImanBranchQuote" WHERE "reviewStatus" = 'ACCEPTED'
)
SELECT s."nameAr" AS source,
       count(*) FILTER (WHERE p.kind = 'hadith') AS hadith,
       count(*) FILTER (WHERE p.kind = 'hadith' AND p.published) AS hadith_pub,
       count(*) FILTER (WHERE p.kind = 'athar') AS athar,
       count(*) FILTER (WHERE p.kind = 'athar' AND p.published) AS athar_pub,
       count(*) FILTER (WHERE p.kind = 'verse') AS verses,
       count(*) FILTER (WHERE p.kind = 'verse' AND p.published) AS verses_pub,
       count(*) FILTER (WHERE p.kind = 'author') AS author_text_not_counted,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND NOT p.published) AS hidden,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND at.qid IS NOT NULL) AS topic_linked,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND ab.qid IS NOT NULL) AS branch_linked,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND at.qid IS NULL AND ab.qid IS NULL) AS not_linked,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND p.published AND at.qid IS NULL AND ab.qid IS NULL) AS pub_unlinked,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND p.published AND pt.qid IS NOT NULL) AS pub_with_public_topic_link
FROM pub p
JOIN "Source" s ON s.id = p."sourceId"
LEFT JOIN acc_topic at ON at.qid = p.id
LEFT JOIN acc_branch ab ON ab.qid = p.id
LEFT JOIN pub_topic pt ON pt.qid = p.id
GROUP BY s.id, s."nameAr"
HAVING count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse')) > 0
ORDER BY hadith DESC, athar DESC, verses DESC, source;

-- Q01b  Totals of the Ibn Abi al-Dunya group (apiProvider starts with book:ibn-abi-dunya)
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
qa AS (
  SELECT q.id, q."sourceId", q.type, q."isAthar", q.grade,
         (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP') AS athar_kept,
         (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL) AS text_ok,
         NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT') AS not_structure,
         (q.id IN (SELECT "quoteId" FROM open_high)) AS high_flag,
         (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_src_ok
  FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL AND s."apiProvider" LIKE 'book:ibn-abi-dunya%'
),
pub AS (
  SELECT qa.*, CASE WHEN "isAthar" THEN 'athar' WHEN type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         (text_ok AND not_structure AND NOT high_flag AND (grade_src_ok OR athar_kept)) AS published
  FROM qa
),
acc_link AS (
  SELECT DISTINCT "quoteId" AS qid FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION SELECT DISTINCT "quoteId" FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION SELECT DISTINCT "quoteId" FROM "ImanBranchQuote" WHERE "reviewStatus" = 'ACCEPTED'
)
SELECT count(*) FILTER (WHERE kind = 'hadith') AS hadith,
       count(*) FILTER (WHERE kind = 'hadith' AND published) AS hadith_pub,
       count(*) FILTER (WHERE kind = 'athar') AS athar,
       count(*) FILTER (WHERE kind = 'athar' AND published) AS athar_pub,
       count(*) FILTER (WHERE kind = 'author') AS author_text_not_counted,
       count(*) FILTER (WHERE kind IN ('hadith','athar') AND NOT published) AS hidden,
       count(*) FILTER (WHERE kind IN ('hadith','athar') AND l.qid IS NOT NULL) AS linked_any,
       count(*) FILTER (WHERE kind IN ('hadith','athar') AND l.qid IS NULL) AS not_linked
FROM pub p LEFT JOIN acc_link l ON l.qid = p.id;

-- ---------------------------------------------------------------------------
-- Q02  Hidden hadith/athar/verse rows per source, by reason
--      Reason priority: OCR, book-structure, open HIGH flag, athar not kept, grade not public
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
qa AS (
  SELECT q.id, q."sourceId", q.type, q."isAthar", q.grade,
         (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP') AS athar_kept,
         (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL) AS text_ok,
         NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT') AS not_structure,
         (q.id IN (SELECT "quoteId" FROM open_high)) AS high_flag,
         (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_src_ok
  FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL
),
pub AS (
  SELECT qa.*,
         CASE WHEN type = 'QURAN_VERSE' THEN 'verse' WHEN "isAthar" THEN 'athar'
              WHEN type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         (text_ok AND not_structure AND NOT high_flag AND (grade_src_ok OR athar_kept)) AS published,
         CASE WHEN NOT text_ok THEN 'ocr'
              WHEN NOT not_structure THEN 'author'
              WHEN high_flag THEN 'flag'
              WHEN "isAthar" AND NOT (grade_src_ok OR athar_kept) THEN 'athar'
              WHEN NOT (grade_src_ok OR athar_kept) THEN 'grade' END AS hidden_reason
  FROM qa
)
SELECT s."nameAr" AS source,
       count(*) FILTER (WHERE p.hidden_reason = 'ocr') AS ocr_unverified,
       count(*) FILTER (WHERE p.hidden_reason = 'flag') AS open_high_flag,
       count(*) FILTER (WHERE p.hidden_reason = 'athar') AS athar_not_kept,
       count(*) FILTER (WHERE p.hidden_reason = 'grade') AS grade_not_public,
       count(*) FILTER (WHERE p.hidden_reason = 'author') AS author_structure,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND NOT p.published) AS hidden_total
FROM pub p JOIN "Source" s ON s.id = p."sourceId"
GROUP BY s.id, s."nameAr"
HAVING count(*) FILTER (WHERE p.kind IN ('hadith','athar','verse') AND NOT p.published) > 0
   OR count(*) FILTER (WHERE p.hidden_reason = 'author') > 0
ORDER BY hidden_total DESC, source;

-- Q02b  Open HIGH flags: count of flags and of distinct quotes, by flag type
SELECT f.type, f.severity, count(*) AS flags, count(DISTINCT f."quoteId") AS quotes
FROM "QuoteFlag" f
WHERE f.status = 'OPEN' AND f.severity = 'HIGH'
GROUP BY f.type, f.severity
ORDER BY f.type;

-- ---------------------------------------------------------------------------
-- Q03  Grade source x grade for hadith rows (not athar), canonical sources
-- ---------------------------------------------------------------------------
SELECT q."gradeSource", q.grade, count(*) AS rows
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."canonicalId" IS NULL AND q.type = 'HADITH' AND NOT q."isAthar"
GROUP BY 1, 2
ORDER BY 1, 2;

-- ---------------------------------------------------------------------------
-- Q04  Athar: review state (all rows with isAthar, canonical sources)
-- ---------------------------------------------------------------------------
SELECT count(*) AS athar_rows,
       count(*) FILTER (WHERE "atharSpeakerKey" IS NOT NULL) AS listed_speaker,
       count(*) FILTER (WHERE "atharReviewDecision" = 'KEEP') AS decision_keep,
       count(*) FILTER (WHERE "atharReviewDecision" = 'DROP') AS decision_drop,
       count(*) FILTER (WHERE "atharReviewDecision" IS NULL) AS decision_blank,
       count(*) FILTER (WHERE "atharSpeakerKey" IS NULL) AS unlisted_speaker,
       count(*) FILTER (WHERE "atharSpeakerKey" IS NOT NULL AND "atharReviewDecision" IS NULL) AS listed_without_decision
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."canonicalId" IS NULL AND q."isAthar";

-- Q04b  Policy check: athar rows that are public through a publishable gradeSource
--       without a listed speaker and a KEEP decision (should be 0 if athar is reviewer-only)
SELECT q.id, q."gradeSource", q.grade, q."atharSpeakerKey", q."atharReviewDecision", q."atharAttributionKind",
       left(q."textAr", 60) AS text_start,
       (SELECT count(*) FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED') AS sin_links_accepted,
       (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS deed_links_accepted
FROM "Quote" q
WHERE q."isAthar"
  AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
  AND NOT (q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP')
  AND (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "QuoteFlag" f WHERE f."quoteId" = q.id AND f.status = 'OPEN' AND f.severity = 'HIGH')
ORDER BY q.id;

-- Q04c  Athar with a DROP decision that still has an accepted topic link (linked but hidden)
SELECT count(DISTINCT q.id) AS drop_athar_with_accepted_link
FROM "Quote" q
WHERE q."isAthar" AND q."atharReviewDecision" = 'DROP'
  AND (EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
    OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED'));

-- ---------------------------------------------------------------------------
-- Q05  Mechanism: accepted links by source, basis and classifier
-- ---------------------------------------------------------------------------
WITH links AS (
  SELECT q."sourceId", l.basis, l."classifiedBy", 'topic' AS link_kind
  FROM "SinQuote" l JOIN "Quote" q ON q.id = l."quoteId" WHERE l."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT q."sourceId", l.basis, l."classifiedBy", 'topic'
  FROM "GoodDeedQuote" l JOIN "Quote" q ON q.id = l."quoteId" WHERE l."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT q."sourceId", l.basis, l."classifiedBy", 'branch'
  FROM "ImanBranchQuote" l JOIN "Quote" q ON q.id = l."quoteId" WHERE l."reviewStatus" = 'ACCEPTED'
)
SELECT s."nameAr" AS source, links.link_kind, links.basis, links."classifiedBy", count(*) AS links
FROM links
JOIN "Source" s ON s.id = links."sourceId"
WHERE s."canonicalId" IS NULL
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 5 DESC;

-- Q05b  Unreviewed keyword proposals (NOT_REVIEWED): not links, never public
SELECT s."nameAr" AS source, 'sin' AS kind, count(*) AS rows, count(DISTINCT l."quoteId") AS quotes
FROM "SinQuote" l JOIN "Quote" q ON q.id = l."quoteId" JOIN "Source" s ON s.id = q."sourceId"
WHERE l."reviewStatus" = 'NOT_REVIEWED'
GROUP BY s."nameAr"
UNION ALL
SELECT s."nameAr", 'deed', count(*), count(DISTINCT l."quoteId")
FROM "GoodDeedQuote" l JOIN "Quote" q ON q.id = l."quoteId" JOIN "Source" s ON s.id = q."sourceId"
WHERE l."reviewStatus" = 'NOT_REVIEWED'
GROUP BY s."nameAr"
ORDER BY 3 DESC, 1;

-- ---------------------------------------------------------------------------
-- Q06  Chapter coverage: book sections that contain hadith, and whether a CHAPTER link exists
-- ---------------------------------------------------------------------------
WITH sec_has_hadith AS (
  SELECT DISTINCT si."sectionId" AS sid
  FROM "SectionItem" si JOIN "Quote" q ON q.id = si."quoteId"
  WHERE q.type = 'HADITH'
),
sec_mapped AS (
  SELECT DISTINCT "sectionId" AS sid FROM "SinQuote"
  WHERE basis = 'CHAPTER' AND "reviewStatus" = 'ACCEPTED' AND "sectionId" IS NOT NULL
  UNION
  SELECT DISTINCT "sectionId" FROM "GoodDeedQuote"
  WHERE basis = 'CHAPTER' AND "reviewStatus" = 'ACCEPTED' AND "sectionId" IS NOT NULL
)
SELECT s."nameAr" AS source,
       count(DISTINCT b.id) AS sections_with_hadith,
       count(DISTINCT b.id) FILTER (WHERE m.sid IS NOT NULL) AS sections_chapter_mapped,
       count(DISTINCT b.id) FILTER (WHERE m.sid IS NULL) AS sections_unmapped
FROM "BookSection" b
JOIN "Source" s ON s.id = b."sourceId"
JOIN sec_has_hadith h ON h.sid = b.id
LEFT JOIN sec_mapped m ON m.sid = b.id
WHERE s."canonicalId" IS NULL
GROUP BY s.id, s."nameAr"
ORDER BY sections_with_hadith DESC;

-- ---------------------------------------------------------------------------
-- Q07  Branches: linked texts, public texts (shown), topic links through ImanBranchSin / ImanBranchGoodDeed
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id, q.type, q."isAthar", q.grade,
         CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
              WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
           AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
           AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
           AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
           AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
         ) AS shown
  FROM "Quote" q
)
SELECT ib.number, ib."titleAr" AS branch,
       count(l."quoteId") AS linked,
       count(l."quoteId") FILTER (WHERE l.basis = 'MANUAL') AS shuab_book_structure,
       count(l."quoteId") FILTER (WHERE l.basis IN ('TAKHRIJ','REVIEWER_SECTION')) AS from_sahihayn,
       count(l."quoteId") FILTER (WHERE p.kind = 'verse' AND p.shown) AS public_verse,
       count(l."quoteId") FILTER (WHERE p.kind = 'hadith' AND p.shown) AS public_hadith,
       count(l."quoteId") FILTER (WHERE p.kind = 'athar' AND p.shown) AS public_athar,
       (SELECT count(*) FROM "ImanBranchSin" x WHERE x."imanBranchId" = ib.id) AS sins,
       (SELECT count(*) FROM "ImanBranchGoodDeed" y WHERE y."imanBranchId" = ib.id) AS deeds
FROM "ImanBranch" ib
LEFT JOIN "ImanBranchQuote" l ON l."imanBranchId" = ib.id AND l."reviewStatus" = 'ACCEPTED'
LEFT JOIN pub p ON p.id = l."quoteId"
GROUP BY ib.id, ib.number, ib."titleAr"
ORDER BY ib.number;

-- Q07b  Branch totals
SELECT count(*) FILTER (WHERE public_hadith = 0) AS branches_with_0_public_hadith,
       count(*) FILTER (WHERE public_hadith + public_athar + public_verse = 0) AS branches_with_0_public_texts,
       sum(public_hadith) AS sum_public_hadith_links,
       sum(linked) AS sum_linked
FROM (
  SELECT ib.number,
         count(l."quoteId") FILTER (WHERE l."reviewStatus" = 'ACCEPTED') AS linked,
         count(l."quoteId") FILTER (WHERE p.kind = 'verse' AND p.shown) AS public_verse,
         count(l."quoteId") FILTER (WHERE p.kind = 'hadith' AND p.shown) AS public_hadith,
         count(l."quoteId") FILTER (WHERE p.kind = 'athar' AND p.shown) AS public_athar
  FROM "ImanBranch" ib
  LEFT JOIN "ImanBranchQuote" l ON l."imanBranchId" = ib.id
  LEFT JOIN (
    SELECT q.id, CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
                      WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
           ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
             AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
             AND NOT EXISTS (SELECT 1 FROM "QuoteFlag" f WHERE f."quoteId" = q.id AND f.status = 'OPEN' AND f.severity = 'HIGH')
             AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
             AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
           ) AS shown
    FROM "Quote" q
  ) p ON p.id = l."quoteId"
  GROUP BY ib.number
) per_branch;

-- ---------------------------------------------------------------------------
-- Q08  Direct branch links from Sahihayn (REVIEWER_SECTION): the 20 rows documented in sahihayn-hadith-map-notes.md
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS source, ib.number AS branch, l.basis, l."classifiedBy", count(*) AS links
FROM "ImanBranchQuote" l
JOIN "ImanBranch" ib ON ib.id = l."imanBranchId"
JOIN "Quote" q ON q.id = l."quoteId"
JOIN "Source" s ON s.id = q."sourceId"
WHERE l.basis = 'REVIEWER_SECTION' AND l."reviewStatus" = 'ACCEPTED'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;

-- ---------------------------------------------------------------------------
-- Q09  Shu'ab al-Iman source: presence and grade mix (every narration)
-- ---------------------------------------------------------------------------
SELECT s."nameAr", s.author, s."apiProvider", q."gradeSource", q.grade, q."isAthar", q."textSource",
       count(*) AS rows
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."apiProvider" = 'book:shuab-iman'
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY 8 DESC;

-- Q09b  Shu'ab: publish state and branch structure
SELECT count(*) AS narrations,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "ImanBranchQuote" l WHERE l."quoteId" = q.id AND l."reviewStatus" = 'ACCEPTED')) AS with_branch_link,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS with_topic_link,
       count(*) FILTER (WHERE q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_source_publishable,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ') AS sunan_tahqiq,
       count(*) FILTER (WHERE q."gradeSource" = 'HADEETHENC') AS hadeethenc,
       count(*) FILTER (WHERE q."gradeSource" = 'AUTO_SAHIHAYN') AS auto_sahihayn,
       count(*) FILTER (WHERE q."isAthar") AS athar
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."apiProvider" = 'book:shuab-iman';

-- ---------------------------------------------------------------------------
-- Q10  Sunan tahqiq (al-Arna'ut only) grades, by source
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS source, q.grade, count(*) AS rows
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE q."gradeSource" = 'SUNAN_TAHQIQ' AND s."canonicalId" IS NULL
GROUP BY 1, 2
ORDER BY 3 DESC;

-- ---------------------------------------------------------------------------
-- Q11  Ibn Rajab books: accepted topic/branch links (expected 0 except TAKHRIJ), text state
-- ---------------------------------------------------------------------------
SELECT count(*) AS quotes,
       count(*) FILTER (WHERE q."textSource" = 'OCR' AND q."textVerifiedAt" IS NULL) AS ocr_unverified,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS topic_linked,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "ImanBranchQuote" z WHERE z."quoteId" = q.id AND z."reviewStatus" = 'ACCEPTED')) AS branch_linked
FROM "Quote" q
WHERE q."apiProvider" = 'ibn-rajab';

-- ---------------------------------------------------------------------------
-- Q12  Quran: verses and their accepted topic links
-- ---------------------------------------------------------------------------
SELECT count(*) AS verses,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS topic_linked,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')) AS sin_linked,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS deed_linked
FROM "Quote" q
WHERE q.type = 'QURAN_VERSE';

-- ---------------------------------------------------------------------------
-- Q13  Excluded examples: per source, the first two rows (by printed number) that are
--      hidden or not linked. Text is textAr as stored, cut to the first 12 words.
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id, q."sourceId", q.type, q."isAthar", q.grade, q."gradeSource", q."textSource", q."textVerifiedAt",
         q."referenceNumber", q."referenceLabel", q."pageOrChapter", q."textAr", q."apiProvider",
         CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
              WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
           AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
           AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
           AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
         ) AS published,
         (SELECT string_agg(sec."titleAr", ' | ') FROM "SectionItem" si JOIN "BookSection" sec ON sec.id = si."sectionId"
           WHERE si."quoteId" = q.id) AS section_titles
  FROM "Quote" q
  JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL AND q.type = 'HADITH'
),
linked AS (
  SELECT DISTINCT "quoteId" AS qid FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION SELECT DISTINCT "quoteId" FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION SELECT DISTINCT "quoteId" FROM "ImanBranchQuote" WHERE "reviewStatus" = 'ACCEPTED'
),
ranked AS (
  SELECT p.*, (l.qid IS NOT NULL) AS is_linked,
         row_number() OVER (PARTITION BY p."sourceId" ORDER BY p."referenceNumber" NULLS LAST, p.id) AS rn
  FROM pub p LEFT JOIN linked l ON l.qid = p.id
  WHERE NOT (p.published AND l.qid IS NOT NULL)
)
SELECT s."nameAr" AS source, r.id, r."referenceNumber", r."referenceLabel", r."pageOrChapter",
       r."gradeSource", r.grade, r."textSource", r.published, r.is_linked,
       r.section_titles,
       array_to_string((regexp_split_to_array(r."textAr", '\s+'))[1:12], ' ') AS text_first_12_words
FROM ranked r JOIN "Source" s ON s.id = r."sourceId"
WHERE r.rn <= 2
ORDER BY s."nameAr", r.rn;

-- ---------------------------------------------------------------------------
-- Q14  Named examples taken from the reviewer files (book + number, as printed)
-- ---------------------------------------------------------------------------
-- Sahihayn low-confidence rows in docs/taxonomy/sahihayn-hadith-map.tsv (reason recorded there)
SELECT s."nameAr" AS source, q."referenceNumber", q.id, q."pageOrChapter", q."gradeSource", q.grade,
       (SELECT count(*) FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED') AS sin_links,
       (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS deed_links,
       array_to_string((regexp_split_to_array(q."textAr", '\s+'))[1:12], ' ') AS text_first_12_words
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE s."nameAr" = 'صحيح البخاري' AND q."referenceNumber" IN (2291, 2404, 3479)
ORDER BY q."referenceNumber";

-- Athar rows with a DROP reason recorded in docs/taxonomy/athar-review-notes.md («Example drops»)
SELECT q.id, q."atharSpeakerKey", q."atharReviewDecision", q."atharAttributionKind", q."gradeSource",
       (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS deed_links,
       array_to_string((regexp_split_to_array(q."textAr", '\s+'))[1:12], ' ') AS text_first_12_words
FROM "Quote" q
WHERE q.id IN ('0005a2ad-de89-451a-a3a1-b6d414a21742', '043e9669-7316-4da3-bd57-29072d6d8676', '072eeade-18e5-4196-9d13-874a94639c44', '11315c37-7fea-4e1c-a380-499628d90c40')
ORDER BY q.id;

-- Quran verses dropped by reviewer decision (docs/taxonomy/ayah-review-decisions.tsv)
SELECT q."surahNumber", q."ayahNumber", q.id, s."nameAr" AS source,
       (SELECT count(*) FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED') AS sin_links,
       (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS deed_links,
       q."textAr"
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE q.type = 'QURAN_VERSE' AND (q."surahNumber", q."ayahNumber") IN ((71, 5), (74, 35), (16, 47))
ORDER BY q."surahNumber", q."ayahNumber";

-- Athar rows whose speaker is not on the list (unlisted): sample of three by quote id
SELECT q.id, q."atharSpeakerKey", q."atharReviewDecision", q."gradeSource", left(q."textAr", 80) AS text_start
FROM "Quote" q
WHERE q."isAthar" AND q."atharSpeakerKey" IS NULL
ORDER BY q.id
LIMIT 3;

-- ---------------------------------------------------------------------------
-- Q15  OCR gate: unverified OCR rows that would publish if verified (grade and flag gates pass)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
)
SELECT s."nameAr" AS source, count(*) AS ocr_unverified,
       count(*) FILTER (WHERE q.type = 'HADITH' AND NOT q."isAthar"
             AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
             AND q.id NOT IN (SELECT "quoteId" FROM open_high)) AS hadith_would_publish,
       count(*) FILTER (WHERE q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'
             AND q.id NOT IN (SELECT "quoteId" FROM open_high)) AS athar_keep_would_publish
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE s."canonicalId" IS NULL AND q."textSource" = 'OCR' AND q."textVerifiedAt" IS NULL
GROUP BY s."nameAr"
ORDER BY ocr_unverified DESC;

-- ---------------------------------------------------------------------------
-- Q16  Published but unlinked, by kind (the pool a reviewer could link next)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id, CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
                    WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind
  FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL
    AND (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
    AND q.id NOT IN (SELECT "quoteId" FROM open_high)
    AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
)
SELECT p.kind, count(*) AS published_rows,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = p.id AND x."reviewStatus" = 'ACCEPTED')
                         AND NOT EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = p.id AND y."reviewStatus" = 'ACCEPTED')
                         AND NOT EXISTS (SELECT 1 FROM "ImanBranchQuote" z WHERE z."quoteId" = p.id AND z."reviewStatus" = 'ACCEPTED')) AS published_unlinked
FROM pub p
WHERE p.kind <> 'author'
GROUP BY p.kind
ORDER BY p.kind;

-- ---------------------------------------------------------------------------
-- Q17  Branch reach through paired topics (option 1): public texts of the topics linked to each branch
--      Uses ImanBranchSin / ImanBranchGoodDeed, then the accepted topic links of those topics.
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
shown AS (
  SELECT q.id, q.type, q."isAthar"
  FROM "Quote" q
  WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
    AND q.id NOT IN (SELECT "quoteId" FROM open_high)
    AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
    AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
),
topic_texts AS (
  SELECT x."sinId" AS topic_id, 'sin' AS tk, x."quoteId" AS qid FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."goodDeedId", 'deed', y."quoteId" FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
branch_topics AS (
  SELECT bs."imanBranchId" AS bid, 'sin' AS tk, bs."sinId" AS tid FROM "ImanBranchSin" bs
  UNION ALL
  SELECT bd."imanBranchId", 'deed', bd."goodDeedId" FROM "ImanBranchGoodDeed" bd
),
reach AS (
  SELECT DISTINCT bt.bid, tt.qid
  FROM branch_topics bt
  JOIN topic_texts tt ON tt.topic_id = bt.tid AND tt.tk = bt.tk
  JOIN shown s ON s.id = tt.qid
)
SELECT count(DISTINCT ib.id) AS branches_with_topic_pairs,
       count(DISTINCT r.bid) AS branches_with_reach,
       count(r.qid) AS reachable_public_texts_all_kinds,
       count(r.qid) FILTER (WHERE s.type = 'HADITH' AND NOT s."isAthar") AS reachable_public_hadith,
       count(r.qid) FILTER (WHERE s."isAthar") AS reachable_public_athar,
       count(r.qid) FILTER (WHERE s.type = 'QURAN_VERSE') AS reachable_public_verses
FROM "ImanBranch" ib
LEFT JOIN reach r ON r.bid = ib.id
LEFT JOIN shown s ON s.id = r.qid
WHERE EXISTS (SELECT 1 FROM branch_topics bt WHERE bt.bid = ib.id);

-- Q17b  Branches that have no topic pair at all (cannot be derived through topics)
SELECT count(*) AS branches_without_topic_pair
FROM "ImanBranch" ib
WHERE NOT EXISTS (SELECT 1 FROM "ImanBranchSin" bs WHERE bs."imanBranchId" = ib.id)
  AND NOT EXISTS (SELECT 1 FROM "ImanBranchGoodDeed" bd WHERE bd."imanBranchId" = ib.id);

-- ---------------------------------------------------------------------------
-- Q18  Athar DROP pool: drop rows by listed/unlisted speaker and by whether a topic link exists
-- ---------------------------------------------------------------------------
SELECT count(*) AS drop_rows,
       count(*) FILTER (WHERE "atharSpeakerKey" IS NOT NULL) AS drop_listed_speaker,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS drop_with_topic_link
FROM "Quote" q
WHERE q."isAthar" AND q."atharReviewDecision" = 'DROP';

-- Q17c  Per branch: public texts reachable through its paired topics (distinct per branch)
--       and the number of paired topics. Same definitions as Q17.
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
shown AS (
  SELECT q.id, q.type, q."isAthar"
  FROM "Quote" q
  WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
    AND q.id NOT IN (SELECT "quoteId" FROM open_high)
    AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
    AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
),
topic_texts AS (
  SELECT x."sinId" AS topic_id, 'sin' AS tk, x."quoteId" AS qid FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."goodDeedId", 'deed', y."quoteId" FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
branch_topics AS (
  SELECT bs."imanBranchId" AS bid, 'sin' AS tk, bs."sinId" AS tid FROM "ImanBranchSin" bs
  UNION ALL
  SELECT bd."imanBranchId", 'deed', bd."goodDeedId" FROM "ImanBranchGoodDeed" bd
),
reach AS (
  SELECT DISTINCT bt.bid, tt.qid
  FROM branch_topics bt
  JOIN topic_texts tt ON tt.topic_id = bt.tid AND tt.tk = bt.tk
  JOIN shown s ON s.id = tt.qid
)
SELECT ib.number, ib."titleAr" AS branch,
       (SELECT count(*) FROM branch_topics bt WHERE bt.bid = ib.id) AS paired_topics,
       count(r.qid) FILTER (WHERE s.type = 'HADITH' AND NOT s."isAthar") AS reach_hadith,
       count(r.qid) FILTER (WHERE s."isAthar") AS reach_athar,
       count(r.qid) FILTER (WHERE s.type = 'QURAN_VERSE') AS reach_verse
FROM "ImanBranch" ib
LEFT JOIN reach r ON r.bid = ib.id
LEFT JOIN shown s ON s.id = r.qid
GROUP BY ib.id, ib.number, ib."titleAr"
ORDER BY ib.number;

-- Q17d  Distinct texts reachable through topic pairs (a text counted once across all branches)
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
topic_texts AS (
  SELECT x."quoteId" AS qid, x."sinId" AS tid, 'sin' AS tk FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."quoteId", y."goodDeedId", 'deed' FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
paired AS (
  SELECT bs."sinId" AS tid, 'sin' AS tk FROM "ImanBranchSin" bs
  UNION
  SELECT bd."goodDeedId", 'deed' FROM "ImanBranchGoodDeed" bd
)
SELECT count(DISTINCT tt.qid) AS distinct_texts_on_paired_topics
FROM topic_texts tt
JOIN paired p ON p.tid = tt.tid AND p.tk = tt.tk
JOIN "Quote" q ON q.id = tt.qid
WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
  AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
  AND q.id NOT IN (SELECT "quoteId" FROM open_high)
  AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
       OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'));

-- ---------------------------------------------------------------------------
-- Q19  Source inventory: canonical sources with hadith or athar, Ibn Abi al-Dunya works with and without hadith
-- ---------------------------------------------------------------------------
WITH per AS (
  SELECT s.id, s."apiProvider",
         count(*) FILTER (WHERE q.type = 'HADITH') AS hadith_rows,
         count(*) FILTER (WHERE q."isAthar") AS athar_rows,
         count(*) FILTER (WHERE q.type = 'QURAN_VERSE') AS verse_rows,
         count(q.id) AS all_rows
  FROM "Source" s LEFT JOIN "Quote" q ON q."sourceId" = s.id
  WHERE s."canonicalId" IS NULL
  GROUP BY s.id, s."apiProvider"
)
SELECT count(*) FILTER (WHERE hadith_rows + athar_rows > 0) AS canonical_sources_with_hadith_or_athar,
       count(*) FILTER (WHERE verse_rows > 0) AS canonical_sources_with_verses,
       count(*) FILTER (WHERE all_rows = 0) AS canonical_sources_without_quotes,
       count(*) FILTER (WHERE "apiProvider" LIKE 'book:ibn-abi-dunya%') AS ibn_abi_dunya_works,
       count(*) FILTER (WHERE "apiProvider" LIKE 'book:ibn-abi-dunya%' AND hadith_rows + athar_rows > 0) AS ibn_abi_dunya_works_with_hadith,
       count(*) FILTER (WHERE "apiProvider" LIKE 'book:ibn-abi-dunya%' AND hadith_rows + athar_rows = 0) AS ibn_abi_dunya_works_author_text_only
FROM per;

-- ---------------------------------------------------------------------------
-- Q20  Grand totals over all canonical sources (hadith, athar, verses)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id,
         CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
              WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
           AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
           AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
           AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
         ) AS published,
         q.id IN (SELECT "quoteId" FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED'
                  UNION SELECT "quoteId" FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED') AS topic_linked,
         q.id IN (SELECT "quoteId" FROM "ImanBranchQuote" WHERE "reviewStatus" = 'ACCEPTED') AS branch_linked
  FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
  WHERE s."canonicalId" IS NULL
)
SELECT kind, count(*) AS imported, count(*) FILTER (WHERE published) AS published,
       count(*) FILTER (WHERE NOT published) AS hidden,
       count(*) FILTER (WHERE topic_linked) AS topic_linked,
       count(*) FILTER (WHERE branch_linked) AS branch_linked,
       count(*) FILTER (WHERE NOT topic_linked AND NOT branch_linked) AS not_linked,
       count(*) FILTER (WHERE published AND NOT topic_linked AND NOT branch_linked) AS published_unlinked
FROM pub
WHERE kind <> 'author'
GROUP BY kind
ORDER BY kind;

-- ---------------------------------------------------------------------------
-- Q21  Published (readerClause) hadith that fail the default grade list (SAHIH/HASAN, not athar KEEP).
--      Topic pages use readerClause only, so these still show there; list and branch pages do not.
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
)
SELECT q."gradeSource", q.grade, s."nameAr" AS source, count(*) AS rows
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE s."canonicalId" IS NULL AND q.type = 'HADITH' AND NOT q."isAthar"
  AND (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
  AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
  AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
  AND NOT (q.grade IN ('SAHIH','HASAN'))
GROUP BY 1, 2, 3
ORDER BY 4 DESC;

-- ---------------------------------------------------------------------------
-- Q22  Policy check: author excerpts (BOOK_EXCERPT) that are not book-structure rows and pass readerClause,
--      and how many of them carry an accepted topic link (they would be served on topic pages)
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS source, q."apiProvider",
       count(*) AS excerpt_rows,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS with_accepted_topic_link,
       (SELECT count(*) FROM "SinQuote" x JOIN "Quote" qq ON qq.id = x."quoteId"
          WHERE x."reviewStatus" = 'ACCEPTED' AND qq.type = 'BOOK_EXCERPT' AND qq."apiProvider" = q."apiProvider") +
       (SELECT count(*) FROM "GoodDeedQuote" y JOIN "Quote" qq ON qq.id = y."quoteId"
          WHERE y."reviewStatus" = 'ACCEPTED' AND qq.type = 'BOOK_EXCERPT' AND qq."apiProvider" = q."apiProvider") AS accepted_link_rows
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE q.type = 'BOOK_EXCERPT' AND q."apiProvider" IS DISTINCT FROM 'book-structure'
GROUP BY s."nameAr", q."apiProvider"
ORDER BY 3 DESC;

-- ---------------------------------------------------------------------------
-- Q23  Examples cited in the reports (texts not used). Text = textAr as stored (athar: atharTextAr),
--      first 12 words, whitespace collapsed to one space. Reasons are written in the reports from the
--      decision files and the grade/flag fields shown here.
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
ids(qid) AS (VALUES
  ('5f43234d-29d7-41ce-a6c8-8b2bee089ac1'), ('1198cf31-f5eb-4d25-9516-8e3441c901ae'),
  ('9a63b3e2-90a6-4f46-b9e1-45c9e2c6b7f2'), ('702832f9-b9c9-484b-bf5d-db2a150b34ad'),
  ('8dcbb5ad-7ddf-48b7-ac0d-0f9654703640'), ('fa6f7938-1ee9-4c94-bab6-662f82062401'),
  ('575bf7da-d80d-4676-9058-7f711609ed5e'), ('a5191bb9-fbde-4a68-a72f-ecdd309a7238'),
  ('7e26b252-852a-4725-bd28-0ebe175abd38'), ('f9844737-071f-4cc9-935a-746fc6fbb3a8'),
  ('b01fc5b2-2424-480a-9011-4056eb057c37'), ('5dd3e665-791e-4c95-8389-4ca45d973634'),
  ('001d0067-ac9c-41c6-856d-3ebe6be15f85'), ('00646a6c-3be0-43e7-9016-925ffd0b8da8'),
  ('a96808fd-3677-47d2-bf51-6f3cb9fdf2c8'), ('ddeec561-cc28-4c08-b901-01262b75c9c3'),
  ('f0429eee-75ab-4794-baa4-ac83e3980830'), ('3929f2a8-feb0-4b17-a5fc-a848c3e73b56'),
  ('08c8245c-254e-4ef0-827c-172d21153bbc'), ('6f8f654e-3593-4b6c-a3ce-d881d5f3ec00'),
  ('7d50f370-d6a4-43f0-82c2-2d43b1d171e8'), ('57f7f8a5-bdd1-4c58-8b8a-2d181a94af28'),
  ('3630f34a-ec2f-4555-b107-f5b799067468'), ('e8e25e85-de52-4d42-9a2a-6cf7a6723e30'),
  ('96073b4b-02b8-40d2-ae55-11cb4b322aaa'), ('385e5a88-41ed-4d33-8125-a14dc90b3477'),
  ('01a7c254-a951-43ea-ab4b-3f5bd0438edd'), ('021393ec-b3c5-4b3f-945b-d72c359060ba'),
  ('03b43bee-a407-4832-b89c-07d5957a5490'), ('1556d425-ceb9-4e82-a718-ddc8c7ef9622'),
  ('15996c0b-fed3-4e14-bddc-0e90a50273c0'),
  ('0005a2ad-de89-451a-a3a1-b6d414a21742'), ('043e9669-7316-4da3-bd57-29072d6d8676'),
  ('072eeade-18e5-4196-9d13-874a94639c44'), ('11315c37-7fea-4e1c-a380-499628d90c40')
)
SELECT s."nameAr" AS source, q.id, q."referenceNumber", q."pageOrChapter",
       q."isAthar", q."atharReviewDecision" AS athar_decision, q."gradeSource", q.grade, q."textSource",
       (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL) AS text_ok,
       (q.id IN (SELECT "quoteId" FROM open_high)) AS open_high_flag,
       (SELECT count(*) FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
         + (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS topic_links_accepted,
       (SELECT count(*) FROM "ImanBranchQuote" z WHERE z."quoteId" = q.id AND z."reviewStatus" = 'ACCEPTED') AS branch_links_accepted,
       (SELECT string_agg(sec."titleAr", ' | ') FROM "SectionItem" si JOIN "BookSection" sec ON sec.id = si."sectionId"
         WHERE si."quoteId" = q.id) AS section_titles,
       array_to_string((regexp_split_to_array(COALESCE(CASE WHEN q."isAthar" THEN q."atharTextAr" END, q."textAr"), '\s+'))[1:12], ' ') AS text_first_12_words
FROM ids
JOIN "Quote" q ON q.id = ids.qid
JOIN "Source" s ON s.id = q."sourceId"
ORDER BY s."nameAr", q."referenceNumber" NULLS LAST, q.id;

-- ---------------------------------------------------------------------------
-- Q24  Ibn Abi al-Dunya per work: texts, published, linked, sections with hadith and mapped sections
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id, q."sourceId", q.type, q."isAthar",
         CASE WHEN q."isAthar" THEN 'athar' WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
           AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
           AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
           AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
         ) AS published
  FROM "Quote" q
),
linked AS (
  SELECT DISTINCT "quoteId" AS qid FROM "SinQuote" WHERE "reviewStatus" = 'ACCEPTED'
  UNION SELECT DISTINCT "quoteId" FROM "GoodDeedQuote" WHERE "reviewStatus" = 'ACCEPTED'
),
sec_hadith AS (
  SELECT DISTINCT si."sectionId" AS sid FROM "SectionItem" si JOIN "Quote" q ON q.id = si."quoteId" WHERE q.type = 'HADITH'
),
sec_mapped AS (
  SELECT DISTINCT "sectionId" AS sid FROM "SinQuote" WHERE basis = 'CHAPTER' AND "reviewStatus" = 'ACCEPTED' AND "sectionId" IS NOT NULL
  UNION SELECT DISTINCT "sectionId" FROM "GoodDeedQuote" WHERE basis = 'CHAPTER' AND "reviewStatus" = 'ACCEPTED' AND "sectionId" IS NOT NULL
)
SELECT s."apiProvider" AS provider, s."nameAr" AS work,
       count(*) FILTER (WHERE p.kind = 'hadith') AS hadith,
       count(*) FILTER (WHERE p.kind = 'hadith' AND p.published) AS hadith_pub,
       count(*) FILTER (WHERE p.kind = 'athar') AS athar,
       count(*) FILTER (WHERE p.kind = 'athar' AND p.published) AS athar_pub,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar') AND l.qid IS NOT NULL) AS topic_linked,
       count(*) FILTER (WHERE p.kind IN ('hadith','athar') AND l.qid IS NULL) AS not_linked,
       (SELECT count(*) FROM "BookSection" b WHERE b."sourceId" = s.id AND b.id IN (SELECT sid FROM sec_hadith)) AS sections_with_hadith,
       (SELECT count(*) FROM "BookSection" b WHERE b."sourceId" = s.id AND b.id IN (SELECT sid FROM sec_mapped)) AS sections_chapter_mapped
FROM pub p
JOIN "Source" s ON s.id = p."sourceId"
LEFT JOIN linked l ON l.qid = p.id
WHERE s."canonicalId" IS NULL AND s."apiProvider" LIKE 'book:ibn-abi-dunya%'
GROUP BY s.id, s."apiProvider", s."nameAr"
HAVING count(*) FILTER (WHERE p.kind IN ('hadith','athar')) > 0
ORDER BY hadith DESC, athar DESC, work;

-- ---------------------------------------------------------------------------
-- Q25  Rule checks on grade attribution (expected: 0 in the publishable columns)
-- ---------------------------------------------------------------------------
SELECT count(*) FILTER (WHERE q."gradeAuthority" LIKE '%الألباني%' OR q."gradeAuthority" ILIKE '%albani%') AS albani_authority_rows,
       count(*) FILTER (WHERE (q."gradeAuthority" LIKE '%الألباني%' OR q."gradeAuthority" ILIKE '%albani%')
                         AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS albani_authority_publishable,
       count(*) FILTER (WHERE q."gradeAuthority" LIKE '%بشار%' OR q."gradeAuthority" ILIKE '%bashar%') AS bashar_authority_rows,
       count(*) FILTER (WHERE q."gradeSource" = 'IBN_RAJAB') AS ibn_rajab_grade_source_rows,
       count(*) FILTER (WHERE q."gradeAuthority" LIKE '%ابن رجب%' AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS ibn_rajab_authority_publishable,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ') AS sunan_tahqiq_rows,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ' AND q."gradeAuthority" NOT LIKE '%الأرنؤوط%' AND q."gradeAuthority" NOT ILIKE '%arna%') AS sunan_rows_not_arnaut
FROM "Quote" q;

-- ---------------------------------------------------------------------------
-- Q26  Public hadith/athar/verse links on branches, by source (what the branch pages show today)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
)
SELECT s."nameAr" AS source,
       CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar' WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
       count(*) AS branch_links_accepted,
       count(*) FILTER (WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
             AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
             AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
             AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
             AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
       ) AS shown_on_branch_pages
FROM "ImanBranchQuote" l
JOIN "Quote" q ON q.id = l."quoteId"
JOIN "Source" s ON s.id = q."sourceId"
WHERE l."reviewStatus" = 'ACCEPTED'
GROUP BY s."nameAr", 2
ORDER BY 4 DESC, 1, 2;

-- ---------------------------------------------------------------------------
-- Q27  Ibn Abi al-Dunya works with author text only (no hadith and no athar rows)
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS work, s."apiProvider" AS provider,
       count(q.id) FILTER (WHERE q.type = 'BOOK_EXCERPT') AS author_text_rows,
       count(q.id) FILTER (WHERE q.type = 'HADITH') AS hadith_rows
FROM "Source" s LEFT JOIN "Quote" q ON q."sourceId" = s.id
WHERE s."canonicalId" IS NULL AND s."apiProvider" LIKE 'book:ibn-abi-dunya%'
GROUP BY s.id, s."nameAr", s."apiProvider"
HAVING count(q.id) FILTER (WHERE q.type = 'HADITH' OR q."isAthar") = 0
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- Q28  Spot-check rows (one per reviewer-file example). Compare with the TSV lines in tsv-counts / check-tsv-links.
-- ---------------------------------------------------------------------------
SELECT q.id, s."nameAr" AS source, q."referenceNumber", q."gradeSource", q.grade, q."textSource",
       q."isAthar", q."atharReviewDecision", q."atharSpeakerKey",
       (SELECT count(*) FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED') AS sin_accepted,
       (SELECT count(*) FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED') AS deed_accepted,
       (SELECT count(*) FROM "ImanBranchQuote" z WHERE z."quoteId" = q.id AND z."reviewStatus" = 'ACCEPTED') AS branch_accepted,
       q."externalId",
       array_to_string((regexp_split_to_array(COALESCE(CASE WHEN q."isAthar" THEN q."atharTextAr" END, q."textAr"), '\s+'))[1:12], ' ') AS text_first_12_words
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE q.id IN ('8dcbb5ad-7ddf-48b7-ac0d-0f9654703640','575bf7da-d80d-4676-9058-7f711609ed5e',
               '001d0067-ac9c-41c6-856d-3ebe6be15f85','1556d425-ceb9-4e82-a718-ddc8c7ef9622',
               '043e9669-7316-4da3-bd57-29072d6d8676')
ORDER BY s."nameAr", q.id;

-- ---------------------------------------------------------------------------
-- Q29  Grade source mix per canonical source for hadith rows (not athar), pivoted
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS source,
       count(*) AS hadith_rows,
       count(*) FILTER (WHERE q."gradeSource" = 'AUTO_SAHIHAYN') AS auto_sahihayn,
       count(*) FILTER (WHERE q."gradeSource" = 'SAHIHAYN') AS sahihayn,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ') AS sunan_tahqiq,
       count(*) FILTER (WHERE q."gradeSource" = 'HADEETHENC') AS hadeethenc,
       count(*) FILTER (WHERE q."gradeSource" = 'MANUAL') AS manual,
       count(*) FILTER (WHERE q."gradeSource" = 'AUTHORITY_LEGACY') AS authority_legacy,
       count(*) FILTER (WHERE q."gradeSource" = 'AUTHORITY_LEGACY' AND q.grade = 'UNGRADED') AS authority_legacy_ungraded
FROM "Quote" q JOIN "Source" s ON s.id = q."sourceId"
WHERE s."canonicalId" IS NULL AND q.type = 'HADITH' AND NOT q."isAthar"
GROUP BY s."nameAr"
HAVING count(*) > 0
ORDER BY hadith_rows DESC;
