-- Migration: add_auth_fields (Phase 4)
-- Additive only: adds UserRole enum, passwordHash, role, lastLoginAt to User.
-- No column removed, no semantics changed.

-- 1. Create the UserRole enum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- 2. Add new columns to "User" (all nullable / with defaults so existing rows stay valid)
ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "role"         "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "lastLoginAt"  TIMESTAMP(3);
