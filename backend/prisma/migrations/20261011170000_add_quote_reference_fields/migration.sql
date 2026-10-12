-- Structural printed reference. The work title stays on Source.
ALTER TABLE "Quote" ADD COLUMN "referenceNumber" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "referenceLabel" TEXT;

-- Volume/page locators such as "Ahmad 5/428" are not a single hadith number.
UPDATE "Quote"
SET "referenceLabel" = (regexp_match("hadithReference", '(\d+/\d+)\s*$'))[1]
WHERE "hadithReference" ~ '\d+/\d+\s*$';

-- Trailing number, with an optional parenthetical mark such as (أ).
UPDATE "Quote"
SET
  "referenceNumber" = (regexp_match("hadithReference", '(\d+)\s*(?:\([^)]+\))?\s*$'))[1]::integer,
  "referenceLabel" = COALESCE(
    "referenceLabel",
    (regexp_match("hadithReference", '\d+\s*\(([^)]+)\)\s*$'))[1]
  )
WHERE "hadithReference" ~ '\d+\s*(\([^)]+\))?\s*$'
  AND "hadithReference" !~ '\d+/\d+\s*$';
