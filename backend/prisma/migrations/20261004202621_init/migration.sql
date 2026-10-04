-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('QURAN', 'HADITH_COLLECTION', 'BOOK', 'SCHOLAR', 'OTHER');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('QURAN_VERSE', 'HADITH', 'SCHOLAR_QUOTE', 'BOOK_EXCERPT');

-- CreateEnum
CREATE TYPE "QuoteOrigin" AS ENUM ('LOCAL', 'API_CACHED');

-- CreateEnum
CREATE TYPE "HadithGrade" AS ENUM ('SAHIH', 'HASAN', 'DAIF', 'MAWDU', 'UNGRADED');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('SIN', 'GOOD_DEED', 'THEME', 'EMOTION');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "SourceType" NOT NULL,
    "author" TEXT,
    "authorAr" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "isExternalApi" BOOLEAN NOT NULL DEFAULT false,
    "apiProvider" TEXT,
    "apiBaseUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "type" "QuoteType" NOT NULL,
    "origin" "QuoteOrigin" NOT NULL DEFAULT 'LOCAL',
    "textAr" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "surahNumber" INTEGER,
    "surahName" TEXT,
    "surahNameAr" TEXT,
    "ayahNumber" INTEGER,
    "narrator" TEXT,
    "narratorAr" TEXT,
    "grade" "HadithGrade",
    "hadithReference" TEXT,
    "bookTitle" TEXT,
    "author" TEXT,
    "pageOrChapter" TEXT,
    "externalId" TEXT,
    "apiProvider" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "severity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodDeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "reward" TEXT,
    "rewardAr" TEXT,
    "oppositeSinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodDeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SinQuote" (
    "id" TEXT NOT NULL,
    "sinId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "relevanceScore" INTEGER DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "SinQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodDeedQuote" (
    "id" TEXT NOT NULL,
    "goodDeedId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "relevanceScore" INTEGER DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "GoodDeedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "slug" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTag" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "QuoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsImported" INTEGER DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quote_type_idx" ON "Quote"("type");

-- CreateIndex
CREATE INDEX "Quote_sourceId_idx" ON "Quote"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_apiProvider_externalId_key" ON "Quote"("apiProvider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_quoteId_languageCode_key" ON "Translation"("quoteId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sin_slug_key" ON "Sin"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GoodDeed_slug_key" ON "GoodDeed"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SinQuote_sinId_quoteId_key" ON "SinQuote"("sinId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodDeedQuote_goodDeedId_quoteId_key" ON "GoodDeedQuote"("goodDeedId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteTag_quoteId_tagId_key" ON "QuoteTag"("quoteId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_quoteId_key" ON "Favorite"("userId", "quoteId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodDeed" ADD CONSTRAINT "GoodDeed_oppositeSinId_fkey" FOREIGN KEY ("oppositeSinId") REFERENCES "Sin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SinQuote" ADD CONSTRAINT "SinQuote_sinId_fkey" FOREIGN KEY ("sinId") REFERENCES "Sin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SinQuote" ADD CONSTRAINT "SinQuote_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodDeedQuote" ADD CONSTRAINT "GoodDeedQuote_goodDeedId_fkey" FOREIGN KEY ("goodDeedId") REFERENCES "GoodDeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodDeedQuote" ADD CONSTRAINT "GoodDeedQuote_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTag" ADD CONSTRAINT "QuoteTag_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTag" ADD CONSTRAINT "QuoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
