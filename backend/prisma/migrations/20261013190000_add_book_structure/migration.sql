-- Book structure for the reviewer's taxonomy. No classification is stored here.

CREATE TYPE "BookLevel" AS ENUM ('KITAB', 'BAB', 'FASL', 'TARGHIB', 'TARHIB', 'KABIRA', 'BRANCH', 'OTHER');

CREATE TYPE "SectionItemKind" AS ENUM ('AYAH', 'HADITH', 'AUTHOR_TEXT');

CREATE TABLE "BookSection" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "BookLevel" NOT NULL,
    "number" TEXT,
    "titleAr" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "volume" TEXT,
    "page" TEXT,

    CONSTRAINT "BookSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectionItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "SectionItemKind" NOT NULL,
    "quoteId" TEXT,
    "ayahFrom" TEXT,
    "ayahTo" TEXT,

    CONSTRAINT "SectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookSection_sourceId_order_key" ON "BookSection"("sourceId", "order");

CREATE INDEX "BookSection_parentId_idx" ON "BookSection"("parentId");

CREATE UNIQUE INDEX "SectionItem_sectionId_order_key" ON "SectionItem"("sectionId", "order");

CREATE INDEX "SectionItem_quoteId_idx" ON "SectionItem"("quoteId");

ALTER TABLE "BookSection" ADD CONSTRAINT "BookSection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookSection" ADD CONSTRAINT "BookSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionItem" ADD CONSTRAINT "SectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionItem" ADD CONSTRAINT "SectionItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
