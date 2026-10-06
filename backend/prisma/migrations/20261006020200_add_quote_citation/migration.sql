-- Public book citation (volume / page). rawPayload stays private.
ALTER TABLE "Quote"
  ADD COLUMN "volume" TEXT,
  ADD COLUMN "page" TEXT;
