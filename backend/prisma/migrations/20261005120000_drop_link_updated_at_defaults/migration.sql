-- Align @updatedAt columns with Prisma's expected SQL shape (no DB default;
-- the client sets updatedAt on write). createdAt keeps DEFAULT CURRENT_TIMESTAMP.
ALTER TABLE "SinQuote" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "GoodDeedQuote" ALTER COLUMN "updatedAt" DROP DEFAULT;
