-- AlterTable: a nullable column, existing rows keep the old max-wins behaviour.
ALTER TABLE "HabitLog" ADD COLUMN "correctedAt" TIMESTAMP(3);
