/**
 * Database reset helper for e2e tests.
 *
 * TRUNCATE … CASCADE is much faster than `prisma migrate reset --force --skip-seed`
 * for per-file resets. The global-setup runs the migration once; subsequent resets
 * between test files just wipe rows.
 *
 * Table list is derived from schema.prisma models (all public, non-migration tables).
 * Prisma generates quoted PascalCase table names in PostgreSQL — must be double-quoted
 * in raw SQL.
 */

import { PrismaClient } from '@prisma/client';

// Order respects FK dependencies: leaf tables first so CASCADE is just extra safety.
// We pass TRUNCATE…CASCADE anyway so the order does not actually matter.
const TABLES = [
  'CircleCheer',
  'CirclePresence',
  'CircleMember',
  'Circle',
  'PushReminder',
  'PushSubscription',
  'HabitLog',
  'HabitPlan',
  'RelativeContact',
  'Relative',
  'PracticeSettings',
  'SinVault',
  'Favorite',
  'SyncLog',
  'QuoteTag',
  'SinQuote',
  'GoodDeedQuote',
  'Translation',
  'Quote',
  'GoodDeed',
  'Tag',
  'Sin',
  'Source',
  'User',
] as const;

const TABLE_LIST = TABLES.map((t) => `"${t}"`).join(', ');

/**
 * Truncates every application table in the test database (CASCADE).
 * Excludes `_prisma_migrations`.
 *
 * @param prisma A connected PrismaClient (or PrismaService, which extends it).
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLE_LIST} CASCADE`);
}
