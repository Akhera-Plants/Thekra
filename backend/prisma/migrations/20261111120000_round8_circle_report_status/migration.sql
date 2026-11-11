-- Round 8 (B5): the owner marks a صحبة report handled. Additive: every existing report starts OPEN.
CREATE TYPE "CircleReportStatus" AS ENUM ('OPEN', 'HANDLED');

ALTER TABLE "CircleReport"
  ADD COLUMN "status" "CircleReportStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "handledAt" TIMESTAMP(3);

CREATE INDEX "CircleReport_status_createdAt_idx" ON "CircleReport"("status", "createdAt");
