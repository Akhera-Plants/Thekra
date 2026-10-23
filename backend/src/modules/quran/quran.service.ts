import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QuoteType } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import { paginated } from '../../common/dto/paginated-result.js';
import type {
  QuoteDto,
} from '../../common/mappers/quote.mapper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
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
    private readonly config: ConfigService<EnvironmentVariables>,
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

    // P2-7: Group by surahNumber only — if two providers spell a surah name
    // differently (Phase 5 content-sync), the same surah must not appear twice.
    const groups = await this.prisma.quote.groupBy({
      by: ['surahNumber'],
      where: {
        AND: [
          { type: QuoteType.QURAN_VERSE, surahNumber: { not: null } },
          GradePolicy.readerClause(),
        ],
      },
      _count: { _all: true },
      orderBy: { surahNumber: 'asc' },
    });

    if (groups.length === 0) {
      this.surahsCache = { expiresAt: now + SURAHS_CACHE_TTL_MS, data: [] };
      return { data: [] };
    }

    // P2-8: read preferred provider from validated config (not process.env).
    const preferredProvider = this.config.get('QURAN_PREFERRED_PROVIDER');

    // P2-7: pick one name row per surah with a second query.
    // Preferred-provider rows win; any provider fills gaps.
    const nameMap = new Map<number, { surahName: string | null; surahNameAr: string | null }>();

    if (preferredProvider) {
      // First pass: preferred provider covers as many surahs as possible
      const preferredRows = await this.prisma.quote.findMany({
        where: {
          AND: [
            {
              type: QuoteType.QURAN_VERSE,
              surahNumber: { not: null },
              apiProvider: preferredProvider,
            },
            GradePolicy.readerClause(),
          ],
        },
        select: { surahNumber: true, surahName: true, surahNameAr: true },
        distinct: ['surahNumber'],
        orderBy: { surahNumber: 'asc' as const },
      });
      for (const row of preferredRows) {
        if (row.surahNumber !== null) {
          nameMap.set(row.surahNumber, { surahName: row.surahName, surahNameAr: row.surahNameAr });
        }
      }
    }

    // Second pass (or sole pass when no preferred provider): fill remaining gaps
    const uncovered = groups
      .map((g) => g.surahNumber as number)
      .filter((n) => !nameMap.has(n));

    if (uncovered.length > 0) {
      const fallbackRows = await this.prisma.quote.findMany({
        where: {
          AND: [
            { type: QuoteType.QURAN_VERSE, surahNumber: { in: uncovered } },
            GradePolicy.readerClause(),
          ],
        },
        select: { surahNumber: true, surahName: true, surahNameAr: true },
        distinct: ['surahNumber'],
        orderBy: { surahNumber: 'asc' as const },
      });
      for (const row of fallbackRows) {
        if (row.surahNumber !== null) {
          nameMap.set(row.surahNumber, { surahName: row.surahName, surahNameAr: row.surahNameAr });
        }
      }
    }

    const data: SurahSummaryDto[] = groups.map((group) => {
      const sn = group.surahNumber as number;
      const names = nameMap.get(sn);
      return {
        surahNumber: sn,
        surahName: names?.surahName ?? null,
        surahNameAr: names?.surahNameAr ?? null,
        ayahCount: group._count._all,
      };
    });

    this.surahsCache = {
      expiresAt: now + SURAHS_CACHE_TTL_MS,
      data,
    };

    return { data };
  }

  async findAyahsBySurah(surahNumber: number, query: SurahAyahsQueryDto) {
    this.assertSurahNumber(surahNumber);

    // P2-9: cross-field validation — fromAyah must not exceed toAyah
    if (
      query.fromAyah !== undefined &&
      query.toAyah !== undefined &&
      query.fromAyah > query.toAyah
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'fromAyah must not be greater than toAyah',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';

    const where: Prisma.QuoteWhereInput = {
      AND: [
        {
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
        },
        GradePolicy.readerClause(),
      ],
    };

    const [rows, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: this.quotes.buildQuoteInclude(locale),
        orderBy: [{ ayahNumber: 'asc' as const }, { id: 'asc' as const }],
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
    // P2-8: use validated ConfigService — never read process.env directly
    const preferredProvider = this.config.get('QURAN_PREFERRED_PROVIDER');

    const where: Prisma.QuoteWhereInput = {
      AND: [
        { type: QuoteType.QURAN_VERSE, surahNumber, ayahNumber },
        GradePolicy.readerClause(),
      ],
    };

    const rows = await this.prisma.quote.findMany({
      where,
      include: this.quotes.buildQuoteInclude(locale, {
        includeAllTranslations,
      }),
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
    const dto = this.quotes.toQuoteDto(row, locale);
    const result: QuoteDto & {
      translations?: Array<{ id: string; languageCode: string; text: string }>;
    } = { ...dto };

    if (includeAllTranslations) {
      result.translations = row.translations.map((t) => ({
        id: t.id,
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
