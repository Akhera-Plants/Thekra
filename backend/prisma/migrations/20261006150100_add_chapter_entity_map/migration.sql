-- Owner-reviewed chapter → sin / good deed / branch. One target only.
CREATE TYPE "ChapterMapTarget" AS ENUM ('SIN', 'GOOD_DEED', 'IMAN_BRANCH');

CREATE TABLE "ChapterEntityMap" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chapterKey" TEXT NOT NULL,
    "chapterTitleAr" TEXT NOT NULL,
    "targetType" "ChapterMapTarget" NOT NULL,
    "sinId" TEXT,
    "goodDeedId" TEXT,
    "imanBranchId" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterEntityMap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChapterEntityMap_sourceId_chapterKey_idx" ON "ChapterEntityMap"("sourceId", "chapterKey");
CREATE INDEX "ChapterEntityMap_sinId_idx" ON "ChapterEntityMap"("sinId");
CREATE INDEX "ChapterEntityMap_goodDeedId_idx" ON "ChapterEntityMap"("goodDeedId");
CREATE INDEX "ChapterEntityMap_imanBranchId_idx" ON "ChapterEntityMap"("imanBranchId");

ALTER TABLE "ChapterEntityMap" ADD CONSTRAINT "ChapterEntityMap_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterEntityMap" ADD CONSTRAINT "ChapterEntityMap_sinId_fkey" FOREIGN KEY ("sinId") REFERENCES "Sin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterEntityMap" ADD CONSTRAINT "ChapterEntityMap_goodDeedId_fkey" FOREIGN KEY ("goodDeedId") REFERENCES "GoodDeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterEntityMap" ADD CONSTRAINT "ChapterEntityMap_imanBranchId_fkey" FOREIGN KEY ("imanBranchId") REFERENCES "ImanBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChapterEntityMap" ADD CONSTRAINT "ChapterEntityMap_one_target" CHECK (
    ("targetType" = 'SIN' AND "sinId" IS NOT NULL AND "goodDeedId" IS NULL AND "imanBranchId" IS NULL)
    OR ("targetType" = 'GOOD_DEED' AND "goodDeedId" IS NOT NULL AND "sinId" IS NULL AND "imanBranchId" IS NULL)
    OR ("targetType" = 'IMAN_BRANCH' AND "imanBranchId" IS NOT NULL AND "sinId" IS NULL AND "goodDeedId" IS NULL)
);
