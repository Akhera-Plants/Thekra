-- Migration: 20261005000002_add_link_timestamps
--
-- D-2: Adds createdAt and updatedAt to SinQuote and GoodDeedQuote.
--
-- Rationale:
--   The admin sort=newest option (§3.11 #49) was removed in P2-6 because these
--   tables had no timestamp column (ordering by UUIDv4 id is random).  The owner
--   has approved an additive migration to restore it with a real timestamp column.
--
--   createdAt — records when the curator created the link; used for sort=newest.
--   updatedAt — records last edit; useful for curator audit trail.
--
-- Both columns use CURRENT_TIMESTAMP as the default so existing rows get a
-- sensible value on the first migration run (all pre-existing links will appear
-- to have been created "now", which is the best we can do without a history table).
--
-- Prisma's @updatedAt is implemented in the client layer (it sets the value on
-- every UPDATE call), but we also add a database-level default for consistency
-- and so that direct SQL writes are handled gracefully.

-- SinQuote ────────────────────────────────────────────────────────────────────

ALTER TABLE "SinQuote"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- GoodDeedQuote ───────────────────────────────────────────────────────────────

ALTER TABLE "GoodDeedQuote"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
