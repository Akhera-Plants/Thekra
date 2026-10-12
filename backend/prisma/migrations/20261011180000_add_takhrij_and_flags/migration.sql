-- Public grades come only from a sahihayn match or a manual decision.
-- Existing rows keep their stored grade and become AUTHORITY_LEGACY via the column default.
CREATE TYPE "GradeSource" AS ENUM ('AUTHORITY_LEGACY', 'AUTO_SAHIHAYN', 'MANUAL');
CREATE TYPE "ReferenceBook" AS ENUM ('BUKHARI', 'MUSLIM');
CREATE TYPE "MatchDecision" AS ENUM ('CANDIDATE', 'CONFIRMED', 'REJECTED');
CREATE TYPE "FlagType" AS ENUM (
  'WEAK_MATCH',
  'DUPLICATE_DIFFERENT_GRADE',
  'QURAN_MISMATCH',
  'OCR_SUSPECT',
  'REFERENCE_MISMATCH',
  'USER_REPORT'
);
CREATE TYPE "FlagSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "FlagOrigin" AS ENUM ('AUTO', 'USER');
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'REVIEWER';

ALTER TABLE "Quote" ADD COLUMN "gradeSource" "GradeSource" NOT NULL DEFAULT 'AUTHORITY_LEGACY';
ALTER TABLE "Quote" ADD COLUMN "legacyGrade" "HadithGrade";
ALTER TABLE "Quote" ADD COLUMN "legacyGradeAuthority" TEXT;
ALTER TABLE "Quote" ADD COLUMN "legacyGradeReference" TEXT;
CREATE INDEX "Quote_gradeSource_idx" ON "Quote"("gradeSource");

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "ReferenceHadith" (
  "id" TEXT NOT NULL,
  "book" "ReferenceBook" NOT NULL,
  "number" INTEGER NOT NULL,
  "kitab" TEXT,
  "bab" TEXT,
  "isnadText" TEXT NOT NULL,
  "matnText" TEXT NOT NULL,
  "normalizedMatn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferenceHadith_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferenceHadith_book_number_key" ON "ReferenceHadith"("book", "number");
CREATE INDEX "ReferenceHadith_book_idx" ON "ReferenceHadith"("book");
CREATE INDEX "ReferenceHadith_normalizedMatn_trgm_idx" ON "ReferenceHadith" USING GIN ("normalizedMatn" gin_trgm_ops);

CREATE TABLE "HadithMatch" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "referenceHadithId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "decision" "MatchDecision" NOT NULL DEFAULT 'CANDIDATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HadithMatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HadithMatch_quoteId_referenceHadithId_key" ON "HadithMatch"("quoteId", "referenceHadithId");
CREATE INDEX "HadithMatch_quoteId_idx" ON "HadithMatch"("quoteId");
CREATE INDEX "HadithMatch_score_idx" ON "HadithMatch"("score");
ALTER TABLE "HadithMatch" ADD CONSTRAINT "HadithMatch_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HadithMatch" ADD CONSTRAINT "HadithMatch_referenceHadithId_fkey" FOREIGN KEY ("referenceHadithId") REFERENCES "ReferenceHadith"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuoteFlag" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "type" "FlagType" NOT NULL,
  "severity" "FlagSeverity" NOT NULL,
  "source" "FlagOrigin" NOT NULL,
  "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
  "details" JSONB,
  "note" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteFlag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuoteFlag_status_severity_idx" ON "QuoteFlag"("status", "severity");
CREATE INDEX "QuoteFlag_quoteId_type_status_idx" ON "QuoteFlag"("quoteId", "type", "status");
ALTER TABLE "QuoteFlag" ADD CONSTRAINT "QuoteFlag_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
