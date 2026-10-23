-- Musnad Ahmad and Sahih Ibn Hibban grades (Shu'ayb al-Arna'ut), kept apart from SUNAN_TAHQIQ.
ALTER TYPE "GradeSource" ADD VALUE 'AHMAD_TAHQIQ';
ALTER TYPE "GradeSource" ADD VALUE 'IBN_HIBBAN_TAHQIQ';

-- The import run that created or last changed a quote.
ALTER TABLE "Quote" ADD COLUMN "importBatch" TEXT;
CREATE INDEX "Quote_importBatch_idx" ON "Quote"("importBatch");

-- What a batch replaced, so it can be reverted.
CREATE TABLE "ImportChange" (
    "id" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportChange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportChange_batch_quoteId_key" ON "ImportChange"("batch", "quoteId");
CREATE INDEX "ImportChange_batch_idx" ON "ImportChange"("batch");
