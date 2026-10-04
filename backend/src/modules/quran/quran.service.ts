import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuoteType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import type {
  QuoteDto,
} from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { AyahDetailQueryDto } from './dto/ayah-detail-query.dto.js';
import type { SurahAyahsQueryDto } from './dto/surah-ayahs-query.dto.js';
import type { SurahsQueryDto } from './dto/surahs-query.dto.js';
import type { SurahSummaryDto } from './entities/surah-summary.entity.js';

const SURAHS_CACHE_TTL_MS = 60_000;

@Injectable()
export class QuranService {
  private surahsCache: {
    expiresAt: number;
    data: SurahSummaryDto[];
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  assertSurahNumber(surahNumber: number): void {
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      throw new BadRequestException({
        code: 'INVALID_SURAH_NUMBER',
        message: 'Surah number must be between 1 and 114',
      });
    }
  }

  async listSurahs(_query: SurahsQueryDto) {
    const now = Date.now();
    if (this.surahsCache && this.surahsCache.expiresAt > now) {
      return { data: this.surahsCache.data };
    }

    const groups = await this.prisma.quote.groupBy({
      by: ['surahNumber', 'surahName', 'surahNameAr'],
      where: {
        type: QuoteType.QURAN_VERSE,
        surahNumber: { not: null },
      },
      _count: { _all: true },
      orderBy: { surahNumber: 'asc' },
    });

    const data: SurahSummaryDto[] = groups.map((group) => ({
      surahNumber: group.surahNumber as number,
      surahName: group.surahName,
      surahNameAr: group.surahNameAr,
      ayahCount: group._count._all,
    }));

    this.surahsCache = {
      expiresAt: now + SURAHS_CACHE_TTL_MS,
      data,
    };

    return { data };
  }

  async findAyahsBySurah(surahNumber: number, query: SurahAyahsQueryDto) {
    this.assertSurahNumber(surahNumber);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';

    const where: Prisma.QuoteWhereInput = {
      type: QuoteType.QURAN_VERSE,
      surahNumber,
      ...(query.fromAyah !== undefined || query.toAyah !== undefined
        ? {
            ayahNumber: {
              ...(query.fromAyah !== undefined && { gte: query.fromAyah }),
              ...(query.toAyah !== undefined && { lte: query.toAyah }),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: this.quotes.buildQuoteInclude(locale),
        orderBy: { ayahNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    if (total === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No verses ingested for this surah',
      });
    }

    return paginated(
      rows.map((row) =>
        this.quotes.toQuoteDto(row , locale),
      ),
      page,
      limit,
      total,
      { locale, surahNumber },
    );
  }

  async findAyah(
    surahNumber: number,
    ayahNumber: number,
    query: AyahDetailQueryDto,
  ) {
    this.assertSurahNumber(surahNumber);

    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
      throw new BadRequestException({
        code: 'INVALID_AYAH_NUMBER',
        message: 'Ayah number must be a positive integer',
      });
    }

    const locale = query.lang ?? 'ar';
    const includeAllTranslations = query.includeAllTranslations === true;
    const preferredProvider = process.env.QURAN_PREFERRED_PROVIDER;

    const where: Prisma.QuoteWhereInput = {
      type: QuoteType.QURAN_VERSE,
      surahNumber,
      ayahNumber,
    };

    const rows = await this.prisma.quote.findMany({
      where,
      include: {
        source: true,
        translations: includeAllTranslations
          ? true
          : locale === 'ar'
            ? { take: 0 }
            : { where: { languageCode: locale }, take: 1 },
        tags: { include: { tag: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Ayah not found',
      });
    }

    const sorted = preferredProvider
      ? [...rows].sort((a, b) => {
          const aPref = a.apiProvider === preferredProvider ? 0 : 1;
          const bPref = b.apiProvider === preferredProvider ? 0 : 1;
          return aPref - bPref;
        })
      : rows;

    const row = sorted[0];
    const dto = this.quotes.toQuoteDto(row , locale);
    const result: QuoteDto & {
      translations?: Array<{ id: string; languageCode: string; text: string }>;
    } = { ...dto };

    if (includeAllTranslations) {
      result.translations = row.translations.map((t) => ({
        id: (t as { id: string }).id,
        languageCode: t.languageCode,
        text: t.text,
      }));
    }

    const response: {
      data: typeof result;
      meta?: { duplicateCount: number };
    } = { data: result };

    if (rows.length > 1) {
      response.meta = { duplicateCount: rows.length };
    }

    return response;
  }
}
