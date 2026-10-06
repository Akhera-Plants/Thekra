-- Suggested sin/deed links are not published until a human accepts them.
-- Existing curated rows are backfilled to ACCEPTED, then the column default
-- becomes NOT_REVIEWED so a later insert that omits the status stays hidden.

CREATE TYPE "LinkReviewStatus" AS ENUM (
  'NOT_REVIEWED',
  'UNDER_REVIEW',
  'REVIEWED',
  'ACCEPTED',
  'REJECTED'
);

ALTER TABLE "SinQuote"
  ADD COLUMN "reviewStatus" "LinkReviewStatus" NOT NULL DEFAULT 'ACCEPTED';

ALTER TABLE "GoodDeedQuote"
  ADD COLUMN "reviewStatus" "LinkReviewStatus" NOT NULL DEFAULT 'ACCEPTED';

ALTER TABLE "SinQuote"
  ALTER COLUMN "reviewStatus" SET DEFAULT 'NOT_REVIEWED';

ALTER TABLE "GoodDeedQuote"
  ALTER COLUMN "reviewStatus" SET DEFAULT 'NOT_REVIEWED';
