-- Commentary attached to a quote, an ayah, or a branch. Attribution is required.
-- Exactly one target, and kind must match that target (CHECK).

CREATE TYPE "ExplanationKind" AS ENUM ('TAFSIR', 'SHARH', 'BRANCH_SHARH');

CREATE TABLE "Explanation" (
  "id" TEXT NOT NULL,
  "kind" "ExplanationKind" NOT NULL,
  "quoteId" TEXT,
  "ayahKey" TEXT,
  "imanBranchId" TEXT,
  "languageCode" TEXT NOT NULL DEFAULT 'ar',
  "text" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "reference" TEXT,
  "origin" "QuoteOrigin" NOT NULL DEFAULT 'LOCAL',
  "apiProvider" TEXT,
  "externalId" TEXT,
  "rawPayload" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Explanation_apiProvider_externalId_key"
  ON "Explanation"("apiProvider", "externalId");
CREATE INDEX "Explanation_quoteId_idx" ON "Explanation"("quoteId");
CREATE INDEX "Explanation_ayahKey_languageCode_idx"
  ON "Explanation"("ayahKey", "languageCode");
CREATE INDEX "Explanation_imanBranchId_idx" ON "Explanation"("imanBranchId");

ALTER TABLE "Explanation"
  ADD CONSTRAINT "Explanation_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Explanation"
  ADD CONSTRAINT "Explanation_imanBranchId_fkey"
  FOREIGN KEY ("imanBranchId") REFERENCES "ImanBranch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Explanation"
  ADD CONSTRAINT "Explanation_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_one_target"
  CHECK (num_nonnulls("quoteId", "ayahKey", "imanBranchId") = 1);
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_kind_matches_target"
  CHECK (
    (("kind" = 'TAFSIR') = ("ayahKey" IS NOT NULL))
    AND (("kind" = 'BRANCH_SHARH') = ("imanBranchId" IS NOT NULL))
  );
