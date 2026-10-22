-- Release cleaning (scripts/release-db.sh build). Runs on the scratch copy
-- `thekra_release` only, never on the local `thekra`: the guard below aborts on
-- any other database. Executed with `psql -v ON_ERROR_STOP=1 --single-transaction`,
-- so it either applies completely or not at all.
--
-- What ships and why: docs/build/RELEASE_DB.md («Tables»). In short, every
-- content, curation and reviewer table the API reads stays whole (Quote,
-- Explanation, Source, the four link tables, QuoteFlag, HadithMatch,
-- ReferenceHadith, BookSection, SectionItem, Translation, the taxonomy tables).
-- Only rows that belong to people or to local development are removed here.

-- Refuse to run anywhere but the scratch release copy. A mistyped -d must not
-- delete the local accounts or anything else in `thekra`.
DO $$
BEGIN
  IF current_database() <> 'thekra_release' THEN
    RAISE EXCEPTION 'clean.sql runs only on thekra_release, not on %', current_database();
  END IF;
END
$$;

-- Favorite: each row is one user's saved quote (personal data). Its FK to User
-- cascades, but it is deleted explicitly so the intent does not depend on the FK.
DELETE FROM "Favorite";

-- User: the local accounts are development seeds (user@thekra.local and
-- admin@thekra.local, both with the published password `password123456`) plus
-- anyone registered locally. None may reach production; the production admin is
-- created afterwards with `pnpm --filter backend admin:create`.
-- Refresh tokens are stateless JWTs (no table), so there is nothing else to revoke.
DELETE FROM "User";

-- SyncLog: history of local content-sync runs (timings, error messages from the
-- developer's machine). The API only reads it on admin routes; production starts
-- with an empty history. Source.lastSyncedAt stays: it describes the content.
DELETE FROM "SyncLog";

-- QuoteFlag.resolvedBy holds the local user id (JWT sub) of whoever resolved a
-- flag. Those users were deleted above, so the ids would point at nobody in
-- production. The flag itself, its status, note and resolvedAt stay: OPEN HIGH
-- flags hide quotes from the public, and resolved ones record reviewer work.
UPDATE "QuoteFlag" SET "resolvedBy" = NULL WHERE "resolvedBy" IS NOT NULL;

-- Guard: every table with a foreign key to User must now be empty. This catches
-- a child table added by a later migration that this file does not know about.
DO $$
DECLARE
  child regclass;
  remaining bigint;
BEGIN
  FOR child IN
    SELECT conrelid::regclass FROM pg_constraint
    WHERE contype = 'f' AND confrelid = '"User"'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', child) INTO remaining;
    IF remaining > 0 THEN
      RAISE EXCEPTION 'table % still has % rows that reference "User"', child, remaining;
    END IF;
  END LOOP;
END
$$;

-- Not done here, on purpose:
-- * _prisma_migrations is replaced by release-db.sh with the rows a fresh
--   `prisma migrate deploy` writes, because three local rows carry checksums of
--   older versions of their migration files (the schema itself is identical; the
--   script diffs it on every build).
-- * Quote.rawPayload / Explanation.rawPayload stay: provenance (OpenITI corpus
--   URI and commit, pre-cleanup originals); about 33 MB.
-- * HadithMatch stays whole, CANDIDATE rows included: the public quote mapper
--   reads non-REJECTED strong matches (src/common/mappers/quote.mapper.ts:6).
