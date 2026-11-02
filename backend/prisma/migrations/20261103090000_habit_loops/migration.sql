-- «حلقة العادة» (owner decision 2026-11-01): the habit loops a member builds for a habit, synced with the plan.
-- Additive only: one nullable column; existing rows are unchanged (null = no loops).
-- AlterTable
ALTER TABLE "HabitPlan" ADD COLUMN     "loops" JSONB;
