-- Phase 6 (redesign §4.6): «مجموعات التذكير» (curated sets of published texts) and prayer-time anchors on habit slots.
-- Additive only: two new tables and one nullable column; existing rows are unchanged.
-- AlterTable
ALTER TABLE "HabitPlan" ADD COLUMN     "slotAnchors" JSONB;

-- CreateTable
CREATE TABLE "ReminderSet" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSetItem" (
    "setId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ReminderSetItem_pkey" PRIMARY KEY ("setId","quoteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSet_slug_key" ON "ReminderSet"("slug");

-- CreateIndex
CREATE INDEX "ReminderSet_published_sortOrder_idx" ON "ReminderSet"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "ReminderSetItem_setId_position_idx" ON "ReminderSetItem"("setId", "position");

-- CreateIndex
CREATE INDEX "ReminderSetItem_quoteId_idx" ON "ReminderSetItem"("quoteId");

-- AddForeignKey
ALTER TABLE "ReminderSetItem" ADD CONSTRAINT "ReminderSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ReminderSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSetItem" ADD CONSTRAINT "ReminderSetItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

