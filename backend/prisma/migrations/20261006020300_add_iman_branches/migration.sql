-- شعب الإيمان path. Titles are entered by the owner; this migration is structure only.
-- Branch-quote links default to NOT_REVIEWED (not published).

CREATE TABLE "ImanBranch" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "titleAr" TEXT NOT NULL,
  "title" TEXT,
  "summaryAr" TEXT,
  "summary" TEXT,
  "sourceId" TEXT,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImanBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImanBranchQuote" (
  "id" TEXT NOT NULL,
  "imanBranchId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "relevanceScore" INTEGER DEFAULT 0,
  "note" TEXT,
  "reviewStatus" "LinkReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImanBranchQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImanBranchGoodDeed" (
  "id" TEXT NOT NULL,
  "imanBranchId" TEXT NOT NULL,
  "goodDeedId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImanBranchGoodDeed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImanBranchSin" (
  "id" TEXT NOT NULL,
  "imanBranchId" TEXT NOT NULL,
  "sinId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImanBranchSin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImanBranch_number_key" ON "ImanBranch"("number");

CREATE UNIQUE INDEX "ImanBranchQuote_imanBranchId_quoteId_key"
  ON "ImanBranchQuote"("imanBranchId", "quoteId");
CREATE INDEX "ImanBranchQuote_quoteId_idx" ON "ImanBranchQuote"("quoteId");
CREATE INDEX "ImanBranchQuote_imanBranchId_relevanceScore_idx"
  ON "ImanBranchQuote"("imanBranchId", "relevanceScore" DESC NULLS LAST);

CREATE UNIQUE INDEX "ImanBranchGoodDeed_imanBranchId_goodDeedId_key"
  ON "ImanBranchGoodDeed"("imanBranchId", "goodDeedId");
CREATE INDEX "ImanBranchGoodDeed_goodDeedId_idx" ON "ImanBranchGoodDeed"("goodDeedId");

CREATE UNIQUE INDEX "ImanBranchSin_imanBranchId_sinId_key"
  ON "ImanBranchSin"("imanBranchId", "sinId");
CREATE INDEX "ImanBranchSin_sinId_idx" ON "ImanBranchSin"("sinId");

ALTER TABLE "ImanBranch"
  ADD CONSTRAINT "ImanBranch_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImanBranchQuote"
  ADD CONSTRAINT "ImanBranchQuote_imanBranchId_fkey"
  FOREIGN KEY ("imanBranchId") REFERENCES "ImanBranch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImanBranchQuote"
  ADD CONSTRAINT "ImanBranchQuote_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImanBranchGoodDeed"
  ADD CONSTRAINT "ImanBranchGoodDeed_imanBranchId_fkey"
  FOREIGN KEY ("imanBranchId") REFERENCES "ImanBranch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImanBranchGoodDeed"
  ADD CONSTRAINT "ImanBranchGoodDeed_goodDeedId_fkey"
  FOREIGN KEY ("goodDeedId") REFERENCES "GoodDeed"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImanBranchSin"
  ADD CONSTRAINT "ImanBranchSin_imanBranchId_fkey"
  FOREIGN KEY ("imanBranchId") REFERENCES "ImanBranch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImanBranchSin"
  ADD CONSTRAINT "ImanBranchSin_sinId_fkey"
  FOREIGN KEY ("sinId") REFERENCES "Sin"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
