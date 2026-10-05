import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { SinsService } from './sins.service.js';

const SIN = {
  id: 'sin-1',
  slug: 'ghibah',
  name: 'Backbiting',
  nameAr: 'الغيبة',
  severity: 4,
  description: null,
  descriptionAr: null,
};

describe('SinsService', () => {
  const prisma = {
    sin: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sinQuote: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    quote: {
      groupBy: vi.fn(),
    },
    goodDeed: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const quotes = {
    buildQuoteInclude: vi.fn().mockReturnValue({ source: true }),
    toQuoteDto: vi.fn().mockImplementation((row) => ({ id: row?.id, type: row?.type })),
    linkOrderBy: vi.fn().mockReturnValue([
      { relevanceScore: { sort: 'desc', nulls: 'last' } },
    ]),
    shuffleLinksPage: vi.fn(),
    getVarietyScoreFloor: vi.fn().mockReturnValue(70),
    // P2-1: new shared helpers — delegate to real GradePolicy so existing
    // grade-filter tests continue to assert the correct Prisma where clause.
    buildLinkQuoteFilter: vi.fn().mockImplementation((query: {
      type?: QuoteType[];
      grades?: string[];
      includeWeak?: boolean;
    }) => {
      const allowedGrades = GradePolicy.resolveAllowedGrades({
        grades: query.grades as never,
        includeWeak: query.includeWeak,
      });
      const quoteFilter = {
        ...(query.type?.length ? { type: { in: query.type } } : {}),
        ...GradePolicy.whereClause(allowedGrades),
      };
      return { quoteFilter, allowedGrades };
    }),
    countsByTypeFromGroups: vi.fn().mockImplementation(
      (groups: Array<{ type: string; _count: { _all: number } }>) => {
        const result: Record<string, number> = {
          QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0,
        };
        for (const g of groups) result[g.type] = g._count._all;
        return result;
      },
    ),
  };

  const goodDeeds = {
    findByOppositeSinId: vi.fn().mockResolvedValue([]),
    toDto: vi.fn(),
  };

  let service: SinsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SinsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotesService, useValue: quotes },
        { provide: GoodDeedsService, useValue: goodDeeds },
      ],
    }).compile();
    service = module.get(SinsService);
  });

  it('throws NotFoundException for an unknown slug', async () => {
    prisma.sin.findUnique.mockResolvedValue(null);
    await expect(
      service.findQuotesForSin('missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('orders by relevanceScore desc with nulls last (normal path)', async () => {
    prisma.sin.findUnique.mockResolvedValue(SIN);
    prisma.sinQuote.findMany.mockResolvedValue([]);
    prisma.sinQuote.count.mockResolvedValue(0);
    prisma.quote.groupBy.mockResolvedValue([]);
    prisma.goodDeed.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await service.findQuotesForSin('ghibah', {});
    expect(quotes.linkOrderBy).toHaveBeenCalled();
    expect(prisma.sinQuote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.arrayContaining([
          expect.objectContaining({
            relevanceScore: { sort: 'desc', nulls: 'last' },
          }),
        ]),
      }),
    );
  });

  it('does not drop QURAN_VERSE rows when filtering grades=SAHIH', async () => {
    prisma.sin.findUnique.mockResolvedValue(SIN);
    prisma.sinQuote.findMany.mockResolvedValue([]);
    prisma.sinQuote.count.mockResolvedValue(0);
    prisma.quote.groupBy.mockResolvedValue([]);
    prisma.goodDeed.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await service.findQuotesForSin('ghibah', {
      grades: ['SAHIH'] as never,
    });

    const call = prisma.sinQuote.findMany.mock.calls[0][0];
    expect(call.where.quote.OR).toEqual([
      { type: { not: QuoteType.HADITH } },
      { grade: { in: ['SAHIH'] } },
    ]);
  });

  it('caps alternatives at 3', async () => {
    prisma.sin.findUnique.mockResolvedValue(SIN);
    prisma.sinQuote.findMany.mockResolvedValue([]);
    prisma.sinQuote.count.mockResolvedValue(0);
    prisma.quote.groupBy.mockResolvedValue([]);
    prisma.goodDeed.findMany.mockResolvedValue([
      { id: '1', slug: 'a', name: 'A', nameAr: 'أ', reward: null, rewardAr: null },
      { id: '2', slug: 'b', name: 'B', nameAr: 'ب', reward: null, rewardAr: null },
      { id: '3', slug: 'c', name: 'C', nameAr: 'ج', reward: null, rewardAr: null },
    ]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const result = await service.findQuotesForSin('ghibah', {});
    expect(prisma.goodDeed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(result.data.alternatives).toHaveLength(3);
  });

  it('countsByType counts the full filtered set, not the page', async () => {
    prisma.sin.findUnique.mockResolvedValue(SIN);
    prisma.sinQuote.findMany.mockResolvedValue([]);
    prisma.sinQuote.count.mockResolvedValue(12);
    prisma.quote.groupBy.mockResolvedValue([
      { type: QuoteType.QURAN_VERSE, _count: { _all: 5 } },
      { type: QuoteType.HADITH, _count: { _all: 6 } },
      { type: QuoteType.SCHOLAR_QUOTE, _count: { _all: 1 } },
    ]);
    prisma.goodDeed.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const result = await service.findQuotesForSin('ghibah', { limit: 2 });
    expect(result.meta.total).toBe(12);
    expect(result.meta.countsByType).toEqual({
      QURAN_VERSE: 5,
      HADITH: 6,
      SCHOLAR_QUOTE: 1,
      BOOK_EXCERPT: 0,
    });
  });

  // ─── Shuffle variety mode (P1-2) ──────────────────────────────────────────────

  describe('shuffle=true (variety mode)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Restore default mocks that beforeEach clears
      quotes.buildQuoteInclude.mockReturnValue({ source: true });
      quotes.toQuoteDto.mockImplementation((row) => ({ id: row?.id, type: row?.type }));
      quotes.linkOrderBy.mockReturnValue([{ relevanceScore: { sort: 'desc', nulls: 'last' } }]);
      quotes.getVarietyScoreFloor.mockReturnValue(70);
      quotes.buildLinkQuoteFilter.mockImplementation((query: { type?: QuoteType[]; grades?: string[]; includeWeak?: boolean }) => {
        const allowedGrades = GradePolicy.resolveAllowedGrades({ grades: query.grades as never, includeWeak: query.includeWeak });
        return { quoteFilter: GradePolicy.whereClause(allowedGrades), allowedGrades };
      });
      quotes.countsByTypeFromGroups.mockImplementation((groups: Array<{ type: string; _count: { _all: number } }>) => {
        const result: Record<string, number> = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
        for (const g of groups) result[g.type] = g._count._all;
        return result;
      });
    });

    it('calls shuffleLinksPage with correct table/parentKey and echoes seed in meta', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      quotes.shuffleLinksPage.mockResolvedValue(['link-a', 'link-b']);
      prisma.sinQuote.findMany.mockResolvedValue([
        { id: 'link-a', relevanceScore: 90, note: null, quote: { id: 'q-a', type: 'HADITH' } },
        { id: 'link-b', relevanceScore: 85, note: null, quote: { id: 'q-b', type: 'QURAN_VERSE' } },
      ]);
      prisma.sinQuote.count.mockResolvedValue(2);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.goodDeed.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      const result = await service.findQuotesForSin('ghibah', {
        shuffle: true,
        seed: 'test-seed-abc',
      });

      expect(quotes.shuffleLinksPage).toHaveBeenCalledWith(
        expect.objectContaining({
          table: '"SinQuote"',
          parentKey: '"sinId"',
          parentId: SIN.id,
          seed: 'test-seed-abc',
          floor: 70,
        }),
      );
      expect(result.meta.ordering).toMatch(/^variety:md5\(seed\),floor=\d+$/);
      expect(result.meta.seed).toBe('test-seed-abc');
    });

    it('defaults seed to today (yyyy-mm-dd) when no seed provided', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      quotes.shuffleLinksPage.mockResolvedValue([]);
      prisma.sinQuote.findMany.mockResolvedValue([]);
      prisma.sinQuote.count.mockResolvedValue(0);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.goodDeed.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      const result = await service.findQuotesForSin('ghibah', { shuffle: true });

      const today = new Date().toISOString().slice(0, 10);
      expect(result.meta.seed).toBe(today);
      expect((quotes.shuffleLinksPage as ReturnType<typeof vi.fn>).mock.calls[0][0].seed).toBe(today);
    });

    it('re-orders rows to match shuffle ID ordering', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      // shuffleLinksPage says link-b should come first
      quotes.shuffleLinksPage.mockResolvedValue(['link-b', 'link-a']);
      // findMany returns them in DB order (a before b)
      prisma.sinQuote.findMany.mockResolvedValue([
        { id: 'link-a', relevanceScore: 90, note: null, quote: { id: 'q-a' } },
        { id: 'link-b', relevanceScore: 85, note: null, quote: { id: 'q-b' } },
      ]);
      prisma.sinQuote.count.mockResolvedValue(2);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.goodDeed.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      const result = await service.findQuotesForSin('ghibah', {
        shuffle: true,
        seed: 's',
      });

      // Items should be in b, a order (shuffle order)
      expect(result.data.items[0]?.link.id).toBe('link-b');
      expect(result.data.items[1]?.link.id).toBe('link-a');
    });

    it('does NOT call shuffleLinksPage when shuffle=false', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.sinQuote.findMany.mockResolvedValue([]);
      prisma.sinQuote.count.mockResolvedValue(0);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.goodDeed.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      await service.findQuotesForSin('ghibah', { shuffle: false });

      expect(quotes.shuffleLinksPage).not.toHaveBeenCalled();
      // Normal ordering: meta.ordering should be the LINK_ORDER constant
      // (not a variety string)
    });
  });
});
