-- Additive taxonomy fields. Existing sins, deeds, and links keep their current values.
ALTER TYPE "EntityOrigin" ADD VALUE 'TAXONOMY';

CREATE TYPE "LinkBasis" AS ENUM (
  'CHAPTER',
  'CHAPTER_AYAH',
  'TAKHRIJ',
  'AUTHOR_CITATION',
  'REVIEWER_SECTION',
  'AI_ITEM',
  'KEYWORD_PROPOSAL',
  'MANUAL'
);

CREATE TYPE "ClassifiedBy" AS ENUM ('BOOK', 'REVIEWER', 'AI');

CREATE TYPE "TopicSide" AS ENUM ('AVOID', 'DO');

CREATE TABLE "TopicDomain" (
  "key" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "TopicDomain_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Sin" ADD COLUMN "domainKey" TEXT;
ALTER TABLE "Sin" ADD COLUMN "isContemporary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sin" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sin" ADD COLUMN "isListed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Sin" ADD COLUMN "taxonomyOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sin" ADD COLUMN "oppositeGoodDeedId" TEXT;

ALTER TABLE "GoodDeed" ADD COLUMN "domainKey" TEXT;
ALTER TABLE "GoodDeed" ADD COLUMN "isContemporary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GoodDeed" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GoodDeed" ADD COLUMN "isListed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoodDeed" ADD COLUMN "taxonomyOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SinQuote" ADD COLUMN "basis" "LinkBasis" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "SinQuote" ADD COLUMN "classifiedBy" "ClassifiedBy" NOT NULL DEFAULT 'BOOK';
ALTER TABLE "SinQuote" ADD COLUMN "sectionId" TEXT;

ALTER TABLE "GoodDeedQuote" ADD COLUMN "basis" "LinkBasis" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "GoodDeedQuote" ADD COLUMN "classifiedBy" "ClassifiedBy" NOT NULL DEFAULT 'BOOK';
ALTER TABLE "GoodDeedQuote" ADD COLUMN "sectionId" TEXT;

CREATE TABLE "TopicDerivation" (
  "id" TEXT NOT NULL,
  "fromSinId" TEXT,
  "fromGoodDeedId" TEXT,
  "toSinId" TEXT,
  "toGoodDeedId" TEXT,
  CONSTRAINT "TopicDerivation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TopicDerivation_one_from" CHECK (
    (CASE WHEN "fromSinId" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "fromGoodDeedId" IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT "TopicDerivation_one_to" CHECK (
    (CASE WHEN "toSinId" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "toGoodDeedId" IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE "TopicLabel" (
  "id" TEXT NOT NULL,
  "labelKey" TEXT NOT NULL,
  "labelAr" TEXT NOT NULL,
  "side" "TopicSide" NOT NULL,
  "slug" TEXT NOT NULL,
  CONSTRAINT "TopicLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopicLabel_labelKey_side_slug_key" ON "TopicLabel"("labelKey", "side", "slug");
CREATE INDEX "TopicLabel_slug_idx" ON "TopicLabel"("slug");

CREATE INDEX "Sin_domainKey_idx" ON "Sin"("domainKey");
CREATE INDEX "Sin_oppositeGoodDeedId_idx" ON "Sin"("oppositeGoodDeedId");
CREATE INDEX "GoodDeed_domainKey_idx" ON "GoodDeed"("domainKey");
CREATE INDEX "SinQuote_sectionId_idx" ON "SinQuote"("sectionId");
CREATE INDEX "SinQuote_classifiedBy_idx" ON "SinQuote"("classifiedBy");
CREATE INDEX "GoodDeedQuote_sectionId_idx" ON "GoodDeedQuote"("sectionId");
CREATE INDEX "GoodDeedQuote_classifiedBy_idx" ON "GoodDeedQuote"("classifiedBy");
CREATE INDEX "TopicDerivation_fromSinId_idx" ON "TopicDerivation"("fromSinId");
CREATE INDEX "TopicDerivation_fromGoodDeedId_idx" ON "TopicDerivation"("fromGoodDeedId");
CREATE INDEX "TopicDerivation_toSinId_idx" ON "TopicDerivation"("toSinId");
CREATE INDEX "TopicDerivation_toGoodDeedId_idx" ON "TopicDerivation"("toGoodDeedId");

ALTER TABLE "Sin" ADD CONSTRAINT "Sin_domainKey_fkey" FOREIGN KEY ("domainKey") REFERENCES "TopicDomain"("key") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sin" ADD CONSTRAINT "Sin_oppositeGoodDeedId_fkey" FOREIGN KEY ("oppositeGoodDeedId") REFERENCES "GoodDeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoodDeed" ADD CONSTRAINT "GoodDeed_domainKey_fkey" FOREIGN KEY ("domainKey") REFERENCES "TopicDomain"("key") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SinQuote" ADD CONSTRAINT "SinQuote_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BookSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoodDeedQuote" ADD CONSTRAINT "GoodDeedQuote_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BookSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TopicDerivation" ADD CONSTRAINT "TopicDerivation_fromSinId_fkey" FOREIGN KEY ("fromSinId") REFERENCES "Sin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicDerivation" ADD CONSTRAINT "TopicDerivation_fromGoodDeedId_fkey" FOREIGN KEY ("fromGoodDeedId") REFERENCES "GoodDeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicDerivation" ADD CONSTRAINT "TopicDerivation_toSinId_fkey" FOREIGN KEY ("toSinId") REFERENCES "Sin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicDerivation" ADD CONSTRAINT "TopicDerivation_toGoodDeedId_fkey" FOREIGN KEY ("toGoodDeedId") REFERENCES "GoodDeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
