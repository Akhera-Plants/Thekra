import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
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
    quote: { groupBy: vi.fn() },
    $transaction: vi.fn(),
  };

  const quotes = {
    buildQuoteInclude: vi.fn().mockReturnValue({ source: true }),
    toQuoteDto: vi.fn().mockImplementation((row) => row),
    linkOrderBy: vi.fn().mockReturnValue([
      { relevanceScore: { sort: 'desc', nulls: 'last' } },
    ]),
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
    expect(prisma.goodDeedQuote.findMany.mock.calls[0][0].where.quote.OR).toEqual([
      { type: { not: QuoteType.HADITH } },
      { grade: { in: ['SAHIH'] } },
    ]);
    expect(quotes.linkOrderBy).toHaveBeenCalled();
  });
});
