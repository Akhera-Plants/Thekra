-- Owner round 5 (docs/plan/2026-11-07-owner-round-5.md): «خصّص الرئيسية» (F-02 a) and «الفرائض» (F-05 a), synced.
-- Additive only: two settings columns with safe defaults (null = default home order, false = off) and one new table.
-- Created with `prisma migrate diff --from-migrations … --to-schema-datamodel … --script` (not applied to production).
-- AlterTable
ALTER TABLE "PracticeSettings" ADD COLUMN     "fardTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeSections" JSONB;

-- CreateTable
CREATE TABLE "FardMark" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prayer" TEXT NOT NULL,
    "status" TEXT,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FardMark_pkey" PRIMARY KEY ("userId","date","prayer")
);

-- CreateIndex
CREATE INDEX "FardMark_userId_updatedAt_idx" ON "FardMark"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "FardMark" ADD CONSTRAINT "FardMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

