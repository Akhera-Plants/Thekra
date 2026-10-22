import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HadithGrade, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { GradePolicy } from './grade-policy.js';
import { HadithService } from './hadith.service.js';

describe('HadithService', () => {
  const prisma = {
    quote: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    source: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const quotes = {
    buildQuoteInclude: vi.fn().mockReturnValue({ source: true }),
    toQuoteDto: vi.fn().mockImplementation((row) => row),
  };

  let service: HadithService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        HadithService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotesService, useValue: quotes },
      ],
    }).compile();
    service = module.get(HadithService);
  });

  describe('findAll', () => {
    it('rejects MAWDU in grades query', async () => {
      await expect(
        service.findAll({ grades: [HadithGrade.MAWDU] }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('applies default SAHIH and HASAN grades in meta', async () => {
      prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.quote.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.appliedGrades).toEqual([
        HadithGrade.SAHIH,
        HadithGrade.HASAN,
      ]);
      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { type: QuoteType.HADITH },
              {
                OR: [
                  { type: { not: QuoteType.HADITH } },
                  {
                    grade: {
                      in: [HadithGrade.SAHIH, HadithGrade.HASAN],
                    },
                  },
                ],
              },
              GradePolicy.readerClause(),
            ],
          },
        }),
      );
    });
  });

  describe('listCollections', () => {
    it('maps hadith collection sources with quote counts', async () => {
      const synced = new Date('2025-06-01T00:00:00.000Z');
      prisma.source.findMany.mockResolvedValue([
        {
          id: 'src-1',
          name: 'Bukhari',
          nameAr: 'البخاري',
          author: 'Imam Bukhari',
          authorAr: null,
          isExternalApi: true,
          apiProvider: 'sunnah.com',
          lastSyncedAt: synced,
          _count: { quotes: 42 },
        },
      ]);

      const result = await service.listCollections({});

      expect(result.data).toEqual([
        {
          id: 'src-1',
          name: 'Bukhari',
          nameAr: 'البخاري',
          author: 'Imam Bukhari',
          authorAr: null,
          isExternalApi: true,
          apiProvider: 'sunnah.com',
          quoteCount: 42,
          lastSyncedAt: synced,
        },
      ]);
    });
  });
});
