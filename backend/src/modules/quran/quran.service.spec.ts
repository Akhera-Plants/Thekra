import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { QuranService } from './quran.service.js';

describe('QuranService', () => {
  const prisma = {
    quote: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const quotes = {
    buildQuoteInclude: vi.fn().mockReturnValue({ source: true }),
    toQuoteDto: vi.fn().mockImplementation((row) => ({
      id: row.id,
      ayahNumber: row.ayahNumber,
    })),
  };

  let service: QuranService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        QuranService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotesService, useValue: quotes },
      ],
    }).compile();
    service = module.get(QuranService);
  });

  describe('listSurahs', () => {
    it('returns cached surahs without calling groupBy again within TTL', async () => {
      prisma.quote.groupBy.mockResolvedValue([
        {
          surahNumber: 1,
          surahName: 'Al-Fatihah',
          surahNameAr: 'الفاتحة',
          _count: { _all: 7 },
        },
      ]);

      const first = await service.listSurahs({});
      const second = await service.listSurahs({});

      expect(first.data).toEqual([
        {
          surahNumber: 1,
          surahName: 'Al-Fatihah',
          surahNameAr: 'الفاتحة',
          ayahCount: 7,
        },
      ]);
      expect(second).toEqual(first);
      expect(prisma.quote.groupBy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAyahsBySurah', () => {
    it('orders ayahs by ayahNumber ascending', async () => {
      prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );
      prisma.quote.findMany.mockResolvedValue([
        { id: 'a', ayahNumber: 1, type: QuoteType.QURAN_VERSE },
        { id: 'b', ayahNumber: 2, type: QuoteType.QURAN_VERSE },
      ]);
      prisma.quote.count.mockResolvedValue(2);

      const result = await service.findAyahsBySurah(2, {
        page: 1,
        limit: 20,
        lang: 'ar',
      });

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { ayahNumber: 'asc' },
          where: expect.objectContaining({ surahNumber: 2 }),
        }),
      );
      expect(result.data.map((d) => d.ayahNumber)).toEqual([1, 2]);
    });

    it('throws when no verses exist for the surah', async () => {
      prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.quote.count.mockResolvedValue(0);

      await expect(
        service.findAyahsBySurah(99, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
