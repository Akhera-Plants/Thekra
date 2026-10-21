CREATE TYPE "AtharReviewDecision" AS ENUM ('KEEP', 'DROP');

ALTER TABLE "Quote" ADD COLUMN "atharReviewDecision" "AtharReviewDecision";
