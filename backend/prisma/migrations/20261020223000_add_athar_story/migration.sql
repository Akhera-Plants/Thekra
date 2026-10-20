CREATE TYPE "AtharAttributionKind" AS ENUM ('SAID', 'NARRATED');

ALTER TABLE "Quote" ADD COLUMN "atharTextAr" TEXT;
ALTER TABLE "Quote" ADD COLUMN "atharAttributionKind" "AtharAttributionKind";
