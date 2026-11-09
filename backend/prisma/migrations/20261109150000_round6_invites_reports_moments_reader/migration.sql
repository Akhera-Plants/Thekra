-- Round 6 (docs/plan/2026-11-09-owner-round-6.md), backend only. Additive: new tables, nullable columns, two enums.
--   C-01k  رفقة invite-only: User.circlesEnabledAt + CircleInvite (members from before are backfilled below).
--   C-01s  report-a-mistake protection: QuoteReport (one row per report, keyed reporter hash; no raw address).
--   C-09   «في لحظات مثل هذه» from the API: HomeMoment.
--   C-13 / C-01n  «وجه التذكير» per topic↔text link (empty until written by hand) and a «no real link» concern.

-- CreateEnum
CREATE TYPE "LinkConcern" AS ENUM ('NO_REAL_LINK');

-- CreateEnum
CREATE TYPE "HomeMomentTopic" AS ENUM ('SIN', 'GOOD_DEED', 'BRANCH');

-- AlterTable
ALTER TABLE "GoodDeedQuote" ADD COLUMN     "concern" "LinkConcern",
ADD COLUMN     "concernAt" TIMESTAMP(3),
ADD COLUMN     "concernNote" TEXT,
ADD COLUMN     "reminderAngle" TEXT,
ADD COLUMN     "reminderAngleEn" TEXT;

-- AlterTable
ALTER TABLE "ImanBranchQuote" ADD COLUMN     "concern" "LinkConcern",
ADD COLUMN     "concernAt" TIMESTAMP(3),
ADD COLUMN     "concernNote" TEXT,
ADD COLUMN     "reminderAngle" TEXT,
ADD COLUMN     "reminderAngleEn" TEXT;

-- AlterTable
ALTER TABLE "SinQuote" ADD COLUMN     "concern" "LinkConcern",
ADD COLUMN     "concernAt" TIMESTAMP(3),
ADD COLUMN     "concernNote" TEXT,
ADD COLUMN     "reminderAngle" TEXT,
ADD COLUMN     "reminderAngleEn" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "circlesEnabledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "QuoteReport" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "reporterKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "circleId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeMoment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "topicType" "HomeMomentTopic" NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "situationAr" TEXT,
    "situationEn" TEXT,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteReport_reporterKey_createdAt_idx" ON "QuoteReport"("reporterKey", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteReport_createdAt_idx" ON "QuoteReport"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteReport_quoteId_reporterKey_reason_idx" ON "QuoteReport"("quoteId", "reporterKey", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "CircleInvite_code_key" ON "CircleInvite"("code");

-- CreateIndex
CREATE INDEX "CircleInvite_inviterId_createdAt_idx" ON "CircleInvite"("inviterId", "createdAt");

-- CreateIndex
CREATE INDEX "CircleInvite_circleId_idx" ON "CircleInvite"("circleId");

-- CreateIndex
CREATE INDEX "CircleInvite_redeemedById_idx" ON "CircleInvite"("redeemedById");

-- CreateIndex
CREATE UNIQUE INDEX "HomeMoment_key_key" ON "HomeMoment"("key");

-- CreateIndex
CREATE INDEX "HomeMoment_published_sortOrder_idx" ON "HomeMoment"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "GoodDeedQuote_concern_idx" ON "GoodDeedQuote"("concern");

-- CreateIndex
CREATE INDEX "ImanBranchQuote_concern_idx" ON "ImanBranchQuote"("concern");

-- CreateIndex
CREATE INDEX "SinQuote_concern_idx" ON "SinQuote"("concern");

-- AddForeignKey
ALTER TABLE "QuoteReport" ADD CONSTRAINT "QuoteReport_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleInvite" ADD CONSTRAINT "CircleInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleInvite" ADD CONSTRAINT "CircleInvite_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleInvite" ADD CONSTRAINT "CircleInvite_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: whoever already belongs to a circle keeps رفقة on (no member loses access by this change).
UPDATE "User" SET "circlesEnabledAt" = CURRENT_TIMESTAMP
WHERE "circlesEnabledAt" IS NULL AND "id" IN (SELECT DISTINCT "userId" FROM "CircleMember");
