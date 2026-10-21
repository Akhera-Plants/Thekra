import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { GoodDeedsService } from './good-deeds.service.js';

describe('GoodDeedsService', () => {
  const prisma = {
    goodDeed: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    goodDeedQuote: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sinQuote: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    quote: { groupBy: vi.fn() },
    $transaction: vi.fn(),
  };

  const quotes = {
    buildQuoteInclude: vi.fn().mockReturnValue({ source: true }),
    toQuoteDto: vi.fn().mockImplementation((row) => row),
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
    countsByKind: vi.fn().mockResolvedValue({ all: 0, verse: 0, hadith: 0, athar: 0 }),
  };

  let service: GoodDeedsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GoodDeedsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotesService, useValue: quotes },
      ],
    }).compile();
    service = module.get(GoodDeedsService);
  });

  it('expands oppositeSin and keeps reward on the intent payload', async () => {
    prisma.goodDeed.findUnique.mockResolvedValue({
      id: 'gd-1',
      slug: 'hifz-al-lisan',
      name: 'Guarding the tongue',
      nameAr: 'حفظ اللسان',
      reward: 'Reward',
      rewardAr: 'أجر',
      description: null,
      descriptionAr: null,
      oppositeSin: {
        id: 'sin-1',
        slug: 'ghibah',
        name: 'Backbiting',
        nameAr: 'الغيبة',
      },
    });
    prisma.goodDeedQuote.findMany.mockResolvedValue([]);
    prisma.goodDeedQuote.count.mockResolvedValue(0);
    prisma.quote.groupBy.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const result = await service.findQuotesForGoodDeed('hifz-al-lisan', {});
    expect(result.data.goodDeed.reward).toBe('Reward');
    expect(result.data.goodDeed.oppositeSin).toEqual({
      id: 'sin-1',
      slug: 'ghibah',
      name: 'Backbiting',
      nameAr: 'الغيبة',
    });
  });

  it('uses the grade OR clause so verses survive grades=SAHIH', async () => {
    prisma.goodDeed.findUnique.mockResolvedValue({
      id: 'gd-1',
      slug: 'hifz-al-lisan',
      name: 'Guarding the tongue',
      nameAr: 'حفظ اللسان',
      reward: null,
      rewardAr: null,
      description: null,
      descriptionAr: null,
      oppositeSin: null,
    });
    prisma.goodDeedQuote.findMany.mockResolvedValue([]);
    prisma.goodDeedQuote.count.mockResolvedValue(0);
    prisma.quote.groupBy.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await service.findQuotesForGoodDeed('hifz-al-lisan', {
      grades: ['SAHIH'] as never,
    });
    expect(prisma.goodDeedQuote.findMany.mock.calls[0][0].where.reviewStatus).toBe('ACCEPTED');
    expect(prisma.goodDeedQuote.findMany.mock.calls[0][0].where.quote.OR).toEqual([
      { type: { not: QuoteType.HADITH } },
      { grade: { in: ['SAHIH'] } },
    ]);
    expect(prisma.goodDeedQuote.findMany.mock.calls[0][0].select.basis).toBe(true);
  });

  // ─── Shuffle variety mode (P1-2) ──────────────────────────────────────────────

  describe('shuffle=true (variety mode)', () => {
    const DEED = {
      id: 'gd-1',
      slug: 'hifz-al-lisan',
      name: 'Guarding the tongue',
      nameAr: 'حفظ اللسان',
      reward: null,
      rewardAr: null,
      description: null,
      descriptionAr: null,
      oppositeSin: null,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      quotes.buildQuoteInclude.mockReturnValue({ source: true });
      quotes.toQuoteDto.mockImplementation((row) => row);
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

    it('calls shuffleLinksPage with GoodDeedQuote table/parentKey and echoes seed', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(DEED);
      quotes.shuffleLinksPage.mockResolvedValue(['gql-a']);
      quotes.buildQuoteInclude.mockReturnValue({ source: true });
      quotes.toQuoteDto.mockImplementation((row) => row);
      quotes.getVarietyScoreFloor.mockReturnValue(70);
      prisma.goodDeedQuote.findMany.mockResolvedValue([
        { id: 'gql-a', relevanceScore: 90, note: null, quote: { id: 'q-a' } },
      ]);
      prisma.goodDeedQuote.count.mockResolvedValue(1);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      const result = await service.findQuotesForGoodDeed('hifz-al-lisan', {
        shuffle: true,
        seed: 'my-seed',
      });

      expect(quotes.shuffleLinksPage).toHaveBeenCalledWith(
        expect.objectContaining({
          table: '"GoodDeedQuote"',
          parentKey: '"goodDeedId"',
          parentId: DEED.id,
          seed: 'my-seed',
          floor: 70,
        }),
      );
      expect(result.meta.ordering).toMatch(/^variety:md5\(seed\),floor=\d+$/);
      expect(result.meta.seed).toBe('my-seed');
    });

    it('does NOT call shuffleLinksPage when shuffle=false', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(DEED);
      quotes.buildQuoteInclude.mockReturnValue({ source: true });
      quotes.linkOrderBy.mockReturnValue([{ relevanceScore: { sort: 'desc', nulls: 'last' } }]);
      prisma.goodDeedQuote.findMany.mockResolvedValue([]);
      prisma.goodDeedQuote.count.mockResolvedValue(0);
      prisma.quote.groupBy.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

      await service.findQuotesForGoodDeed('hifz-al-lisan', { shuffle: false });

      expect(quotes.shuffleLinksPage).not.toHaveBeenCalled();
    });
  });
});
