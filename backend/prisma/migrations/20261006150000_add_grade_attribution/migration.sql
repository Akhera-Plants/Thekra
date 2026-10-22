-- Who graded a narration, and where. A book never assigns one grade to every row.
ALTER TABLE "Quote" ADD COLUMN "gradeAuthority" TEXT;
ALTER TABLE "Quote" ADD COLUMN "gradeReference" TEXT;
