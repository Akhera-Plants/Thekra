-- Vision v2: scholarly sin rank (كبيرة / صغيرة), cited to a Source.
-- severity is unchanged. rank stays null until a curator sets it.

CREATE TYPE "SinRank" AS ENUM ('KABIRA', 'SAGHIRA');

ALTER TABLE "Sin"
  ADD COLUMN "rank" "SinRank",
  ADD COLUMN "rankSourceId" TEXT,
  ADD COLUMN "rankReference" TEXT;

CREATE INDEX "Sin_rank_idx" ON "Sin"("rank");

ALTER TABLE "Sin"
  ADD CONSTRAINT "Sin_rankSourceId_fkey"
  FOREIGN KEY ("rankSourceId") REFERENCES "Source"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sin" ADD CONSTRAINT "Sin_rank_source_needs_rank"
  CHECK ("rankSourceId" IS NULL OR "rank" IS NOT NULL);
