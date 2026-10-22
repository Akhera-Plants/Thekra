/**
 * Parity tests: verify that `thekra_normalize_ar()` in Postgres produces the
 * same output as the TypeScript `normalizeArabic()` helper for a fixed corpus.
 *
 * These tests are skipped when DATABASE_URL is not set so they don't break CI
 * pipelines that don't have a live DB.  Run locally with:
 *   DATABASE_URL=... pnpm test -- arabic-search
 */

import { PrismaClient } from '@prisma/client';
import { normalizeArabic } from './arabic-normalizer.js';

const DATABASE_URL = process.env['DATABASE_URL'];

const CORPUS: { label: string; input: string }[] = [
  // Plain Arabic with no diacritics — should be a no-op for stripping
  { label: 'plain الغيبة', input: 'الغيبة' },
  // ta-marbuta at end
  { label: 'صلاة (ta-marbuta)', input: 'صلاة' },
  // alef wasla (U+0671)
  { label: 'ٱلرحمن (alef wasla)', input: '\u0671\u0644\u0631\u062D\u0645\u0646' },
  // full tashkeel
  { label: 'الـلَّهُ (tashkeel + tatweel)', input: 'الـلَّهُ' },
  // alef variants
  { label: 'إيمان (hamza below)', input: 'إيمان' },
  { label: 'آمن (madda)', input: 'آمن' },
  { label: 'أمر (hamza above)', input: 'أمر' },
  // alef maqsura
  { label: 'على (alef maqsura)', input: 'على' },
  // extended marks (U+06D6)
  { label: 'extended mark U+06D6', input: 'الله\u06D6' },
  // mixed
  { label: 'full basmala opening', input: '\u0671\u0644\u0631\u064E\u0651\u062D\u0652\u0645\u064E\u0670\u0646\u0650' },
];

// Use describe.skipIf (vitest) to skip when there is no live DB
const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('thekra_normalize_ar SQL parity (requires DATABASE_URL)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  for (const { label, input } of CORPUS) {
    it(`matches TS output for: ${label}`, async () => {
      const tsResult = normalizeArabic(input);
      const [row] = await prisma.$queryRawUnsafe<{ result: string }[]>(
        `SELECT thekra_normalize_ar($1) AS result`,
        input,
      );
      expect(row?.result).toBe(tsResult);
    });
  }
});
