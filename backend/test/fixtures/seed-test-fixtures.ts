/**
 * Test-only fixture seed for e2e tests.
 *
 * Calls the dev-seed exported functions (reusing their idempotent upserts) and then
 * inserts additional rows that MUST NOT appear in the production/dev seed:
 *
 *   QF_MAWDU        — HADITH with grade MAWDU     (grade policy must block it)
 *   QF_UNGRADED     — HADITH with grade UNGRADED   (opt-in via includeWeak)
 *   QF_NULL_GRADE   — HADITH with grade=null        (same treatment as UNGRADED)
 *   SIN_TEST_MANY   — Sin with slug "test-sin-many-opposites"
 *   DEED_TEST_1..4  — GoodDeeds whose oppositeSinId = SIN_TEST_MANY
 *
 * The MAWDU and UNGRADED quotes are also linked to ghibah with relevanceScore=90
 * so grade-filtering assertions can use the existing ghibah endpoint.
 *
 * The dev seed's ghibah already has 6 SinQuote links with score ≥ 70
 * (scores: 95, 92, 88, 80, 75, 70) — sufficient for the shuffle spec.
 *
 * IMPORTANT — import ordering:
 *   The dev seed (prisma/seed.ts) constructs its own PrismaClient at module
 *   evaluation time.  We import it DYNAMICALLY inside seedTestFixtures() so the
 *   import runs AFTER setup-e2e.ts has set DATABASE_URL in process.env.
 *   Do NOT add a top-level `import … from '../../prisma/seed.js'`.
 *
 * Usage in specs:
 *   beforeAll(async () => {
 *     await truncateAll(prisma);
 *     await seedTestFixtures();
 *   });
 */

import { HadithGrade, PrismaClient, QuoteType, UserRole } from '@prisma/client';
import { hash as argon2hash, argon2id } from 'argon2';

// ── Exported fixed IDs for test-only rows ────────────────────────────────────
// Prefix 0000…f_ differentiates test rows from the dev seed (0000…00N).

/** MAWDU hadith — must never appear in public responses */
export const QF_MAWDU = '00000000-0000-4000-8000-0000000000f1';
/** UNGRADED hadith — visible only with includeWeak=true */
export const QF_UNGRADED = '00000000-0000-4000-8000-0000000000f2';
/** HADITH with grade=null — same treatment as UNGRADED */
export const QF_NULL_GRADE = '00000000-0000-4000-8000-0000000000f3';

/** Sin with 4 opposite good deeds — for P1-8 detail assertions */
export const SIN_TEST_MANY = 'a0000000-0000-4000-8000-0000000000f1';
export const DEED_TEST_1 = 'b0000000-0000-4000-8000-0000000000f1';
export const DEED_TEST_2 = 'b0000000-0000-4000-8000-0000000000f2';
export const DEED_TEST_3 = 'b0000000-0000-4000-8000-0000000000f3';
export const DEED_TEST_4 = 'b0000000-0000-4000-8000-0000000000f4';

/** Fixed-ID test users (separate from dev-seed to avoid clashes) */
export const TEST_USER_ID  = 'd0000000-0000-4000-8000-0000000000f1';
export const TEST_ADMIN_ID = 'd0000000-0000-4000-8000-0000000000f2';
/** Dev password used for both test users (satisfies RegisterDto ≥10 chars) */
export const TEST_PASSWORD = 'password123456';

// Fixed IDs from dev seed used for FK references (not re-exported — already in seed.ts)
const SRC_BUKHARI = '10000000-0000-4000-8000-000000000002';
const SIN_GHIBAH = 'a0000000-0000-4000-8000-000000000001';

/**
 * Seeds the test database: first runs the dev-seed subsets, then adds test-only rows.
 *
 * Callers must call `truncateAll(prisma)` before this function to start clean.
 */
export async function seedTestFixtures(): Promise<void> {
  // Dynamic import ensures seed.ts's PrismaClient is constructed AFTER setup-e2e.ts
  // has set DATABASE_URL to thekra_test in process.env.
  const {
    seedSources,
    seedTags,
    seedSins,
    seedGoodDeeds,
    seedQuotes,
    seedTranslations,
    seedLinks,
  } = await import('../../prisma/seed.js');

  await seedSources();
  await seedTags();
  await seedSins();
  await seedGoodDeeds();
  await seedQuotes();
  await seedTranslations();
  await seedLinks();

  // ── Test-only rows ──────────────────────────────────────────────────────────
  // Use a dedicated PrismaClient so we never depend on seed.ts's internal instance.
  // DATABASE_URL is already set in process.env by setup-e2e.ts.
  const prisma = new PrismaClient();

  try {
    // 1. MAWDU hadith — must be blocked by GradePolicy on every public endpoint
    await prisma.quote.upsert({
      where: { id: QF_MAWDU },
      create: {
        id: QF_MAWDU,
        type: QuoteType.HADITH,
        textAr: 'هَذَا حَدِيثٌ مَوْضُوعٌ لِأَغْرَاضِ الِاخْتِبَارِ فَقَطْ',
        sourceId: SRC_BUKHARI,
        grade: HadithGrade.MAWDU,
        hadithReference: 'TEST-MAWDU',
      },
      update: { grade: HadithGrade.MAWDU },
    });

    // 2. UNGRADED hadith — visible only with includeWeak=true
    await prisma.quote.upsert({
      where: { id: QF_UNGRADED },
      create: {
        id: QF_UNGRADED,
        type: QuoteType.HADITH,
        textAr: 'هَذَا حَدِيثٌ غَيْرُ مُصَنَّفٍ لِأَغْرَاضِ الِاخْتِبَارِ فَقَطْ',
        sourceId: SRC_BUKHARI,
        grade: HadithGrade.UNGRADED,
        hadithReference: 'TEST-UNGRADED',
      },
      update: { grade: HadithGrade.UNGRADED },
    });

    // 3. HADITH with grade=null — schema allows it (grade HadithGrade?); treated same as UNGRADED
    await prisma.quote.upsert({
      where: { id: QF_NULL_GRADE },
      create: {
        id: QF_NULL_GRADE,
        type: QuoteType.HADITH,
        textAr: 'هَذَا حَدِيثٌ بِدُونِ دَرَجَةٍ لِأَغْرَاضِ الِاخْتِبَارِ فَقَطْ',
        sourceId: SRC_BUKHARI,
        hadithReference: 'TEST-NULL-GRADE',
        // grade intentionally omitted → null
      },
      update: { grade: null },
    });

    // 4. Link MAWDU + UNGRADED to ghibah with high relevance so grade-filter specs
    //    can verify they are excluded from the default response.
    const testLinks: Array<{ quoteId: string; note: string }> = [
      { quoteId: QF_MAWDU, note: 'Test-only: MAWDU linked to ghibah — must be filtered' },
      { quoteId: QF_UNGRADED, note: 'Test-only: UNGRADED linked to ghibah — opt-in only' },
    ];

    for (const { quoteId, note } of testLinks) {
      await prisma.sinQuote.upsert({
        where: { sinId_quoteId: { sinId: SIN_GHIBAH, quoteId } },
        create: { sinId: SIN_GHIBAH, quoteId, relevanceScore: 90, note },
        update: { relevanceScore: 90, note },
      });
    }

    // 5. Test sin with 4 opposite good deeds — for P1-8: GET /sins/:slug returns all 4
    await prisma.sin.upsert({
      where: { slug: 'test-sin-many-opposites' },
      create: {
        id: SIN_TEST_MANY,
        name: 'Test Sin Many Opposites',
        nameAr: 'خطيئة اختبار المقابلات',
        slug: 'test-sin-many-opposites',
        category: 'test',
        severity: 1,
      },
      update: { name: 'Test Sin Many Opposites' },
    });

    const testDeeds = [
      { id: DEED_TEST_1, slug: 'test-deed-opposite-1', name: 'Test Deed 1', nameAr: 'عمل اختبار 1' },
      { id: DEED_TEST_2, slug: 'test-deed-opposite-2', name: 'Test Deed 2', nameAr: 'عمل اختبار 2' },
      { id: DEED_TEST_3, slug: 'test-deed-opposite-3', name: 'Test Deed 3', nameAr: 'عمل اختبار 3' },
      { id: DEED_TEST_4, slug: 'test-deed-opposite-4', name: 'Test Deed 4', nameAr: 'عمل اختبار 4' },
    ] as const;

    for (const deed of testDeeds) {
      await prisma.goodDeed.upsert({
        where: { slug: deed.slug },
        create: { ...deed, oppositeSinId: SIN_TEST_MANY },
        update: { oppositeSinId: SIN_TEST_MANY },
      });
    }

    // 6. Seed test users with hashed passwords for auth e2e tests.
    const passwordHash = await argon2hash(TEST_PASSWORD, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const testUsers = [
      {
        id: TEST_USER_ID,
        email: 'e2e-user@thekra.test',
        displayName: 'E2E Test User',
        passwordHash,
        role: UserRole.USER,
      },
      {
        id: TEST_ADMIN_ID,
        email: 'e2e-admin@thekra.test',
        displayName: 'E2E Test Admin',
        passwordHash,
        role: UserRole.ADMIN,
      },
    ];
    for (const user of testUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        create: user,
        update: { passwordHash, role: user.role },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
