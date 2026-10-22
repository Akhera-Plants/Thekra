import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { QuranService } from './quran.service.js';

const makeConfigMock = (overrides: Record<string, unknown> = {}) => ({
  get: vi.fn((key: string) => overrides[key] ?? undefined),
});

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
      quran: { ayahNumber: row.ayahNumber },
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
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile();
    service = module.get(QuranService);
  });

  // ─── listSurahs (P2-7 / P2-8) ─────────────────────────────────────────────

  describe('listSurahs', () => {
    it('groups by surahNumber only and picks names with a second findMany', async () => {
      // P2-7: groupBy returns only surahNumber + count
      prisma.quote.groupBy.mockResolvedValue([
        { surahNumber: 1, _count: { _all: 7 } },
      ]);
      // Fallback name query (no preferred provider configured)
      prisma.quote.findMany.mockResolvedValueOnce([
        { surahNumber: 1, surahName: 'Al-Fatihah', surahNameAr: 'الفاتحة' },
      ]);

      const result = await service.listSurahs({});

      expect(result.data).toEqual([
        {
          surahNumber: 1,
          surahName: 'Al-Fatihah',
          surahNameAr: 'الفاتحة',
          ayahCount: 7,
        },
      ]);

      // groupBy must NOT include surahName/surahNameAr
      const groupByArgs = prisma.quote.groupBy.mock.calls[0][0];
      expect(groupByArgs.by).toEqual(['surahNumber']);
      expect(groupByArgs.by).not.toContain('surahName');
      expect(groupByArgs.by).not.toContain('surahNameAr');
    });

    it('returns cached surahs without calling groupBy again within TTL', async () => {
      prisma.quote.groupBy.mockResolvedValue([
        { surahNumber: 1, _count: { _all: 7 } },
      ]);
      prisma.quote.findMany.mockResolvedValue([
        { surahNumber: 1, surahName: 'Al-Fatihah', surahNameAr: 'الفاتحة' },
      ]);

      const first = await service.listSurahs({});
      const second = await service.listSurahs({});

      expect(second).toEqual(first);
      expect(prisma.quote.groupBy).toHaveBeenCalledTimes(1);
    });

    it('returns empty list and caches it when no QURAN_VERSE rows exist', async () => {
      prisma.quote.groupBy.mockResolvedValue([]);

      const result = await service.listSurahs({});

      expect(result.data).toEqual([]);
      expect(prisma.quote.findMany).not.toHaveBeenCalled();
    });

    it('P2-8: preferred provider names take precedence over fallback names', async () => {
      // Build a service with QURAN_PREFERRED_PROVIDER configured
      const configWithProvider = makeConfigMock({ QURAN_PREFERRED_PROVIDER: 'quran.com' });
      const mod = await Test.createTestingModule({
        providers: [
          QuranService,
          { provide: PrismaService, useValue: prisma },
          { provide: QuotesService, useValue: quotes },
          { provide: ConfigService, useValue: configWithProvider },
        ],
      }).compile();
      const svcWithProvider = mod.get(QuranService);

      prisma.quote.groupBy.mockResolvedValue([
        { surahNumber: 1, _count: { _all: 7 } },
        { surahNumber: 2, _count: { _all: 286 } },
      ]);
      // Preferred provider covers surah 1 only
      prisma.quote.findMany
        .mockResolvedValueOnce([
          { surahNumber: 1, surahName: 'Al-Fatihah (quran.com)', surahNameAr: 'الفاتحة' },
        ])
        // Fallback covers surah 2
        .mockResolvedValueOnce([
          { surahNumber: 2, surahName: 'Al-Baqarah', surahNameAr: 'البقرة' },
        ]);

      const result = await svcWithProvider.listSurahs({});

      expect(result.data[0].surahName).toBe('Al-Fatihah (quran.com)');
      expect(result.data[1].surahName).toBe('Al-Baqarah');
      // First findMany call must filter by preferred provider
      const firstFindCall = prisma.quote.findMany.mock.calls[0][0];
      expect(firstFindCall.where.AND[0].apiProvider).toBe('quran.com');
    });

    it('P2-8: uses ConfigService (not process.env) to resolve QURAN_PREFERRED_PROVIDER', async () => {
      const configSpy = makeConfigMock({ QURAN_PREFERRED_PROVIDER: undefined });
      const mod = await Test.createTestingModule({
        providers: [
          QuranService,
          { provide: PrismaService, useValue: prisma },
          { provide: QuotesService, useValue: quotes },
          { provide: ConfigService, useValue: configSpy },
        ],
      }).compile();
      const svc = mod.get(QuranService);

      prisma.quote.groupBy.mockResolvedValue([
        { surahNumber: 1, _count: { _all: 7 } },
      ]);
      prisma.quote.findMany.mockResolvedValue([
        { surahNumber: 1, surahName: 'Al-Fatihah', surahNameAr: 'الفاتحة' },
      ]);

      await svc.listSurahs({});

      expect(configSpy.get).toHaveBeenCalledWith('QURAN_PREFERRED_PROVIDER');
    });
  });

  // ─── findAyahsBySurah ──────────────────────────────────────────────────────

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
          orderBy: [{ ayahNumber: 'asc' }, { id: 'asc' }],
          where: expect.objectContaining({
            AND: expect.arrayContaining([expect.objectContaining({ surahNumber: 2 })]),
          }),
        }),
      );
      expect(result.data.map((d) => d.quran?.ayahNumber)).toEqual([1, 2]);
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

    // ─── P2-9: cross-field validation ───────────────────────────────────────

    it('P2-9: throws 400 VALIDATION_FAILED when fromAyah > toAyah', async () => {
      await expect(
        service.findAyahsBySurah(2, { fromAyah: 10, toAyah: 5 }),
      ).rejects.toMatchObject({
        response: { code: 'VALIDATION_FAILED' },
        status: 400,
      });
    });

    it('P2-9: accepts fromAyah === toAyah (single-ayah range)', async () => {
      prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );
      prisma.quote.findMany.mockResolvedValue([
        { id: 'x', ayahNumber: 5, type: QuoteType.QURAN_VERSE },
      ]);
      prisma.quote.count.mockResolvedValue(1);

      await expect(
        service.findAyahsBySurah(2, { fromAyah: 5, toAyah: 5 }),
      ).resolves.toBeDefined();
    });

    it('P2-9: accepts fromAyah < toAyah (normal range)', async () => {
      prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );
      prisma.quote.findMany.mockResolvedValue([
        { id: 'y', ayahNumber: 3, type: QuoteType.QURAN_VERSE },
      ]);
      prisma.quote.count.mockResolvedValue(1);

      await expect(
        service.findAyahsBySurah(2, { fromAyah: 1, toAyah: 5 }),
      ).resolves.toBeDefined();
    });
  });
});
