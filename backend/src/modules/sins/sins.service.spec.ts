import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { SinsService } from './sins.service.js';

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
    toQuoteDto: vi.fn().mockImplementation((row) => ({ id: row.id, type: row.type })),
    linkOrderBy: vi.fn().mockReturnValue([
      { relevanceScore: { sort: 'desc', nulls: 'last' } },
    ]),
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

  it('orders by relevanceScore desc with nulls last', async () => {
    prisma.sin.findUnique.mockResolvedValue({
      id: 'sin-1',
      slug: 'ghibah',
      name: 'Backbiting',
      nameAr: 'الغيبة',
      severity: 4,
      description: null,
      descriptionAr: null,
    });
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
    prisma.sin.findUnique.mockResolvedValue({
      id: 'sin-1',
      slug: 'ghibah',
      name: 'Backbiting',
      nameAr: 'الغيبة',
      severity: 4,
      description: null,
      descriptionAr: null,
    });
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
    prisma.sin.findUnique.mockResolvedValue({
      id: 'sin-1',
      slug: 'ghibah',
      name: 'Backbiting',
      nameAr: 'الغيبة',
      severity: 4,
      description: null,
      descriptionAr: null,
    });
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
    prisma.sin.findUnique.mockResolvedValue({
      id: 'sin-1',
      slug: 'ghibah',
      name: 'Backbiting',
      nameAr: 'الغيبة',
      severity: 4,
      description: null,
      descriptionAr: null,
    });
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
});
