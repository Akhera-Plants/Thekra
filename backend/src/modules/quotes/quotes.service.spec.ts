import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { HadithGrade, QuoteOrigin, QuoteType, SourceType, TagCategory } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { QuotesService } from './quotes.service.js';
import type { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import type { QuotesQueryDto } from './dto/quotes-query.dto.js';
import { vi } from 'vitest';

/** Minimal ConfigService mock — returns VARIETY_SCORE_FLOOR=70 by default. */
const makeConfigMock = () => ({ get: vi.fn().mockReturnValue(70) });

function makeRow(overrides: Partial<QuoteRowForDto> = {}): QuoteRowForDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: QuoteType.HADITH,
    origin: QuoteOrigin.LOCAL,
    textAr: 'نص عربي',
    sourceId: 'src-1',
    surahNumber: null,
    surahName: null,
    surahNameAr: null,
    ayahNumber: null,
    narrator: 'Anas',
    narratorAr: 'أنس',
    grade: 'SAHIH',
    hadithReference: 'Bukhari 13',
    bookTitle: null,
    author: null,
    pageOrChapter: null,
    externalId: null,
    apiProvider: null,
    rawPayload: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    source: {
      id: 'src-1',
      name: 'Bukhari',
      nameAr: 'البخاري',
      type: SourceType.HADITH_COLLECTION,
      author: null,
      authorAr: null,
      language: 'ar',
      isExternalApi: false,
      apiProvider: null,
      apiBaseUrl: null,
      lastSyncedAt: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    },
    translations: [
      {
        id: 'tr-1',
        quoteId: '00000000-0000-4000-8000-000000000001',
        languageCode: 'en',
        text: 'English text',
      },
    ],
    tags: [
      {
        id: 'qt-1',
        quoteId: '00000000-0000-4000-8000-000000000001',
        tagId: 'tag-1',
        tag: {
          id: 'tag-1',
          slug: 'sincerity',
          name: 'Sincerity',
          nameAr: 'الإخلاص',
          category: TagCategory.THEME,
        },
      },
    ],
    ...overrides,
  };
}

describe('QuotesService', () => {
  let service: QuotesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile();
    service = module.get(QuotesService);
  });

  describe('toQuoteDto', () => {
    it('never emits rawPayload', () => {
      const row = makeRow({
        origin: QuoteOrigin.API_CACHED,
        apiProvider: 'quran.com',
        externalId: '49:12',
        rawPayload: { secret: true },
      });
      const dto = service.toQuoteDto(row, 'en');
      expect(dto).not.toHaveProperty('rawPayload');
      expect(JSON.stringify(dto)).not.toContain('secret');
    });

    it('picks the translation for lang=en and returns null when missing', () => {
      expect(service.toQuoteDto(makeRow(), 'en').translation).toEqual({
        languageCode: 'en',
        text: 'English text',
      });
      expect(
        service.toQuoteDto(makeRow({ translations: [] }), 'en').translation,
      ).toBeNull();
    });

    it('keeps textAr and omits translation for lang=ar', () => {
      const dto = service.toQuoteDto(makeRow(), 'ar');
      expect(dto.textAr).toBe('نص عربي');
      expect(dto.translation).toBeNull();
    });

    it('sets kind-specific groups to null for the wrong type', () => {
      const hadith = service.toQuoteDto(makeRow(), 'ar');
      expect(hadith.quran).toBeNull();
      expect(hadith.book).toBeNull();
      expect(hadith.hadith).not.toBeNull();

      const verse = service.toQuoteDto(
        makeRow({
          type: QuoteType.QURAN_VERSE,
          surahNumber: 49,
          surahName: 'Al-Hujurat',
          surahNameAr: 'الحجرات',
          ayahNumber: 12,
          narrator: null,
          grade: null,
          hadithReference: null,
        }),
        'ar',
      );
      expect(verse.hadith).toBeNull();
      expect(verse.book).toBeNull();
      expect(verse.quran?.surahNumber).toBe(49);
    });
  });
});

// ─── P0-2 Grade-policy tests ─────────────────────────────────────────────────

/** Build a minimal Prisma mock that captures findMany's `where` argument. */
function makePrismaMock() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const findUnique = vi.fn().mockResolvedValue(null);

  const mock = {
    // $transaction with an array of promises: resolve each promise and return results
    $transaction: vi.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    quote: { findMany, count, findUnique },
  };
  return { mock, findMany, count, findUnique };
}

describe('QuotesService — grade policy (P0-2)', () => {
  let svc: QuotesService;
  let findMany: ReturnType<typeof vi.fn>;
  let findUnique: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { mock, findMany: fm, findUnique: fu } = makePrismaMock();
    findMany = fm;
    findUnique = fu;

    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: mock },
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile();
    svc = module.get(QuotesService);
  });

  /** Extract the grade-OR clause from the AND array returned to findMany. */
  function gradeOrClause(where: Prisma.QuoteWhereInput) {
    const and = (where as { AND?: Prisma.QuoteWhereInput[] }).AND ?? [];
    return and.find(
      (c) =>
        'OR' in c &&
        Array.isArray((c as { OR: unknown[] }).OR) &&
        (c as { OR: { grade?: unknown }[] }).OR.some((o) => 'grade' in o),
    ) as { OR: Array<{ type?: unknown; grade?: { in: string[] } }> } | undefined;
  }

  it('search() default — grade OR restricts HADITHs to SAHIH+HASAN only', async () => {
    await svc.search({} as QuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    expect(clause).toBeDefined();
    const allowed = clause!.OR.find((o) => o.grade)?.grade?.in ?? [];
    expect(allowed).toContain(HadithGrade.SAHIH);
    expect(allowed).toContain(HadithGrade.HASAN);
    expect(allowed).not.toContain(HadithGrade.MAWDU);
    expect(allowed).not.toContain(HadithGrade.DAIF);
    expect(allowed).not.toContain(HadithGrade.UNGRADED);
  });

  it('search() with includeWeak=true — DAIF+UNGRADED added, MAWDU still excluded', async () => {
    await svc.search({ includeWeak: true } as QuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    expect(clause).toBeDefined();
    const allowed = clause!.OR.find((o) => o.grade)?.grade?.in ?? [];
    expect(allowed).toContain(HadithGrade.SAHIH);
    expect(allowed).toContain(HadithGrade.HASAN);
    expect(allowed).toContain(HadithGrade.DAIF);
    expect(allowed).toContain(HadithGrade.UNGRADED);
    expect(allowed).not.toContain(HadithGrade.MAWDU);
  });

  it('adminSearch() — no default grade filter applied (curators see all grades)', async () => {
    await svc.adminSearch({} as AdminQuotesQueryDto);

    const where = findMany.mock.calls[0][0].where as Prisma.QuoteWhereInput;
    const clause = gradeOrClause(where);

    // No grade-OR clause should be injected for the admin route
    expect(clause).toBeUndefined();
  });

  it('findById() — MAWDU hadith resolves to 404 NotFoundException', async () => {
    findUnique.mockResolvedValue(makeRow({ grade: HadithGrade.MAWDU }));

    await expect(
      svc.findById('00000000-0000-4000-8000-000000000001', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('findById() — DAIF hadith is still served (carries grade badge)', async () => {
    findUnique.mockResolvedValue(makeRow({ grade: HadithGrade.DAIF }));

    // Should resolve (not throw) for a DAIF hadith
    await expect(
      svc.findById('00000000-0000-4000-8000-000000000001', {}),
    ).resolves.toBeDefined();
  });
});

// ─── P2-5 setQuoteTags tests ─────────────────────────────────────────────────

/** Build a mock suitable for setQuoteTags (needs tag, quoteTag, and interactive $transaction). */
function makeSetTagsPrismaMock() {
  const txClient = {
    quoteTag: { deleteMany: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({}) },
    tag: { findMany: vi.fn().mockResolvedValue([]) },
  };

  return {
    quote: { findUnique: vi.fn() },
    tag: { findMany: vi.fn() },
    quoteTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
    _txClient: txClient,
  };
}

describe('QuotesService — setQuoteTags (P2-5)', () => {
  let svc: QuotesService;
  let prisma: ReturnType<typeof makeSetTagsPrismaMock>;

  const QUOTE = { id: 'q-1', type: 'QURAN_VERSE' };
  const TAG_A = { id: 'tag-a', slug: 'anger', name: 'Anger', nameAr: 'الغضب', category: 'THEME' };
  const TAG_B = { id: 'tag-b', slug: 'humility', name: 'Humility', nameAr: 'التواضع', category: 'THEME' };

  beforeEach(async () => {
    prisma = makeSetTagsPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile();
    svc = module.get(QuotesService);
  });

  it('throws 404 when quote is not found', async () => {
    prisma.quote.findUnique.mockResolvedValue(null);

    await expect(svc.setQuoteTags('no-such-quote', [])).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
      status: 404,
    });
  });

  it('throws 422 RELATED_RESOURCE_INVALID when a tag ID does not exist', async () => {
    prisma.quote.findUnique.mockResolvedValue(QUOTE);
    // Only TAG_A found; TAG_B is missing
    prisma.tag.findMany.mockResolvedValue([TAG_A]);

    await expect(
      svc.setQuoteTags(QUOTE.id, [TAG_A.id, 'missing-tag']),
    ).rejects.toMatchObject({
      response: { code: 'RELATED_RESOURCE_INVALID' },
      status: 422,
    });
  });

  it('performs delete + createMany + final read inside ONE $transaction', async () => {
    prisma.quote.findUnique.mockResolvedValue(QUOTE);
    prisma.tag.findMany.mockResolvedValue([TAG_A, TAG_B]);
    prisma._txClient.tag.findMany.mockResolvedValue([TAG_A, TAG_B]);

    await svc.setQuoteTags(QUOTE.id, [TAG_A.id, TAG_B.id]);

    // The interactive $transaction callback was called exactly once
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // All three operations happened inside the transaction client
    expect(prisma._txClient.quoteTag.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: QUOTE.id },
    });
    expect(prisma._txClient.quoteTag.createMany).toHaveBeenCalledWith({
      data: [
        { quoteId: QUOTE.id, tagId: TAG_A.id },
        { quoteId: QUOTE.id, tagId: TAG_B.id },
      ],
    });
    expect(prisma._txClient.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [TAG_A.id, TAG_B.id] } } }),
    );

    // The outer tag.findMany (for existence check) should NOT be the transaction one
    expect(prisma.tag.findMany).toHaveBeenCalledTimes(1);
  });

  it('skips createMany and returns [] when tagIds is empty', async () => {
    prisma.quote.findUnique.mockResolvedValue(QUOTE);
    prisma._txClient.tag.findMany.mockResolvedValue([]);

    const result = await svc.setQuoteTags(QUOTE.id, []);

    expect(result).toEqual([]);
    expect(prisma._txClient.quoteTag.deleteMany).toHaveBeenCalledWith({
      where: { quoteId: QUOTE.id },
    });
    expect(prisma._txClient.quoteTag.createMany).not.toHaveBeenCalled();
  });
});

// ─── P2-10 sort=relevance tests ───────────────────────────────────────────────

/** Build a Prisma mock that can simulate $queryRaw for Arabic search. */
function makeRelevancePrismaMock() {
  return {
    $transaction: vi.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    $queryRaw: vi.fn(),
    quote: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('QuotesService — sort=relevance (P2-10)', () => {
  let svc: QuotesService;
  let prismaMock: ReturnType<typeof makeRelevancePrismaMock>;

  const now = new Date('2025-01-01T00:00:00.000Z');
  const earlier = new Date('2024-01-01T00:00:00.000Z');

  function makeQuoteRow(id: string, createdAt = now) {
    return makeRow({ id, createdAt });
  }

  beforeEach(async () => {
    prismaMock = makeRelevancePrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile();
    svc = module.get(QuotesService);
  });

  it('sort=relevance: exact Arabic matches appear before partial matches', async () => {
    const exactId = 'exact-1';
    const partialId = 'partial-2';

    // $queryRaw returns exact-first ordered IDs (rank 0 before rank 1)
    prismaMock.$queryRaw.mockResolvedValue([
      { id: exactId },   // rank 0 — exact
      { id: partialId }, // rank 1 — partial
    ]);
    // findMany returns rows in createdAt desc (DB order — but re-sort happens in memory)
    prismaMock.quote.findMany.mockResolvedValue([
      makeQuoteRow(partialId, now),    // newer but partial match
      makeQuoteRow(exactId, earlier),  // older but exact match
    ]);

    const result = await svc.search({ q: 'الغيبة', sort: 'relevance' } as QuotesQueryDto);

    // Exact match must surface first regardless of createdAt
    expect(result.data[0].id).toBe(exactId);
    expect(result.data[1].id).toBe(partialId);
  });

  it('sort=relevance: rows not in orderedArabicIds (e.g. translation-only matches) sort after Arabic matches', async () => {
    const arabicId = 'arabic-1';
    const latinId = 'latin-2';

    // Arabic search returns only the Arabic ID
    prismaMock.$queryRaw.mockResolvedValue([{ id: arabicId }]);
    prismaMock.quote.findMany.mockResolvedValue([
      makeQuoteRow(latinId, now),     // newer, but not in arabicIds
      makeQuoteRow(arabicId, earlier), // older, but in arabicIds (exact)
    ]);

    const result = await svc.search({ q: 'test', sort: 'relevance' } as QuotesQueryDto);

    expect(result.data[0].id).toBe(arabicId);
    expect(result.data[1].id).toBe(latinId);
  });

  it('sort=relevance: uses $queryRaw (findIdsByNormalizedArabicOrdered) not the regular findMany for ordering', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.quote.findMany.mockResolvedValue([]);

    await svc.search({ q: 'نص', sort: 'relevance' } as QuotesQueryDto);

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    // Verify the raw query includes a CASE WHEN for exact-match ordering
    const sqlArg = prismaMock.$queryRaw.mock.calls[0][0];
    const sqlString = String(sqlArg?.strings?.join?.('') ?? sqlArg);
    expect(sqlString).toContain('CASE WHEN');
  });

  it('sort=newest: does NOT call $queryRaw for ordered Arabic IDs (uses DB pagination)', async () => {
    prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    prismaMock.quote.findMany.mockResolvedValue([]);
    prismaMock.quote.count.mockResolvedValue(0);

    await svc.search({ sort: 'newest' } as QuotesQueryDto);

    // No Arabic raw query for non-relevance sort without a q param
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
