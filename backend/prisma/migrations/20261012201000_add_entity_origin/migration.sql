-- Chapter classification may create a sin or a deed. Existing rows stay curated.
CREATE TYPE "EntityOrigin" AS ENUM ('CURATED', 'AUTO_CHAPTER');

ALTER TABLE "Sin" ADD COLUMN "origin" "EntityOrigin" NOT NULL DEFAULT 'CURATED';
ALTER TABLE "GoodDeed" ADD COLUMN "origin" "EntityOrigin" NOT NULL DEFAULT 'CURATED';
