-- Owner round 6 (docs/plan/2026-11-09-owner-round-6.md), practice data: «القدر الأدنى», the restart after a long archive,
-- «حال يومي», «قضاء الفوائت», the «تخفّف» covering switch, the reciter, habit reflections and read marks. Synced
-- (docs/plan/2026-10-practice-sync-contract.md «Round 6»). Additive only: nullable columns or safe defaults, three new
-- tables. Created with `prisma migrate diff --from-schema-datamodel <schema before> --to-schema-datamodel prisma/schema.prisma
-- --script` (not applied to production).
-- AlterTable
ALTER TABLE "PracticeSettings" ADD COLUMN     "dayStates" JSONB,
ADD COLUMN     "lightenCovered" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qada" JSONB,
ADD COLUMN     "reciter" TEXT;

-- AlterTable
ALTER TABLE "HabitPlan" ADD COLUMN     "minimum" DOUBLE PRECISION,
ADD COLUMN     "restartedOn" DATE,
ADD COLUMN     "startAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "HabitReflection" (
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "helped" TEXT,
    "hard" TEXT,
    "note" TEXT,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitReflection_pkey" PRIMARY KEY ("planId","date")
);

-- CreateTable
CREATE TABLE "QadaLog" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prayer" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QadaLog_pkey" PRIMARY KEY ("userId","date","prayer")
);

-- CreateTable
CREATE TABLE "QuoteRead" (
    "userId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRead_pkey" PRIMARY KEY ("userId","quoteId")
);

-- CreateIndex
CREATE INDEX "HabitReflection_updatedAt_idx" ON "HabitReflection"("updatedAt");

-- CreateIndex
CREATE INDEX "QadaLog_userId_updatedAt_idx" ON "QadaLog"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "QuoteRead_userId_updatedAt_idx" ON "QuoteRead"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "HabitReflection" ADD CONSTRAINT "HabitReflection_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HabitPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QadaLog" ADD CONSTRAINT "QadaLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRead" ADD CONSTRAINT "QuoteRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

