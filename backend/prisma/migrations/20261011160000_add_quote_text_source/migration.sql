-- CreateEnum
CREATE TYPE "TextSource" AS ENUM ('DIGITAL', 'OCR', 'MANUAL');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "textSource" "TextSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Quote" ADD COLUMN "textVerifiedAt" TIMESTAMP(3);

-- OpenITI book rows are keyed digital text, not OCR and not hand entry.
UPDATE "Quote"
SET "textSource" = 'DIGITAL'
WHERE "apiProvider" IN ('book:shuab-iman', 'book:adab-al-mufrad', 'book:dhahabi-kabair')
   OR ("rawPayload"->>'corpusUri') LIKE 'OpenITI/%';

-- CreateIndex
CREATE INDEX "Quote_textSource_textVerifiedAt_idx" ON "Quote"("textSource", "textVerifiedAt");
