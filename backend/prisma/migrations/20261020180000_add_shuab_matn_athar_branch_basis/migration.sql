-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "matnAr" TEXT;
ALTER TABLE "Quote" ADD COLUMN "isAthar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quote" ADD COLUMN "atharSpeakerKey" TEXT;

-- AlterTable
ALTER TABLE "ImanBranchQuote" ADD COLUMN "basis" "LinkBasis" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ImanBranchQuote" ADD COLUMN "classifiedBy" "ClassifiedBy" NOT NULL DEFAULT 'BOOK';

-- CreateIndex
CREATE INDEX "ImanBranchQuote_basis_idx" ON "ImanBranchQuote"("basis");
