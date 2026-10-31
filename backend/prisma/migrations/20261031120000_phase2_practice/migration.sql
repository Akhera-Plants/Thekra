-- AlterTable
ALTER TABLE "HabitPlan" ADD COLUMN     "establishedOn" DATE,
ADD COLUMN     "pausedOn" DATE,
ADD COLUMN     "resumedOn" DATE;

-- AlterTable
ALTER TABLE "PracticeSettings" ADD COLUMN     "excusedDays" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Relative" ADD COLUMN     "circle" TEXT NOT NULL DEFAULT 'kin';

