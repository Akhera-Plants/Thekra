import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuoteType } from '@prisma/client';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import type { SinsQueryDto } from './dto/sins-query.dto.js';
import type { SinDetailDto, SinDto } from './entities/sin.entity.js';

const ORDERING =
  'relevanceScore:desc,grade:asc,createdAt:desc';

@Injectable()
export class SinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly goodDeeds: GoodDeedsService,
  ) {}

  toDto(row: {
    id: string;
    name: string;
    nameAr: string;
    slug: string;
    category: string | null;
    description: string | null;
    descriptionAr: string | null;
    severity: number | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { quotes: number };
  }): SinDto {
    return {
      id: row.id,
      name: row.name,
      nameAr: row.nameAr,
      slug: row.slug,
      category: row.category,
      description: row.description,
      descriptionAr: row.descriptionAr,
      severity: row.severity,
      quoteCount: row._count.quotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(query: SinsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where: Prisma.SinWhereInput = {};

    if (query.category) where.category = query.category;
    if (query.severityMin !== undefined || query.severityMax !== undefined) {
      where.severity = {
        ...(query.severityMin !== undefined && { gte: query.severityMin }),
        ...(query.severityMax !== undefined && { lte: query.severityMax }),
      };
    }
    if (query.q) {
      const q = normalizeArabic(query.q);
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.SinOrderByWithRelationInput =
      query.sort === 'severity'
        ? { severity: 'desc' }
        : query.sort === 'quoteCount'
          ? { quotes: { _count: 'desc' } }
          : { name: 'asc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sin.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { quotes: true } } },
      }),
      this.prisma.sin.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toDto(row)),
      page,
      limit,
      total,
      { locale },
    );
  }

  async findBySlug(slug: string): Promise<SinDetailDto> {
    const row = await this.prisma.sin.findUnique({
      where: { slug },
      include: { _count: { select: { quotes: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }
    const relatedGoodDeeds = await this.goodDeeds.findByOppositeSinId(row.id);
    return { ...this.toDto(row), relatedGoodDeeds };
  }

  async findAlternatives(sinId: string) {
    return this.goodDeeds.findByOppositeSinId(sinId, 3);
  }

  async findQuotesForSin(slug: string, query: SinQuotesQueryDto) {
    const sin = await this.prisma.sin.findUnique({ where: { slug } });
    if (!sin) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const locale = query.lang ?? 'ar';
    const allowedGrades = GradePolicy.resolveAllowedGrades({
      grades: query.grades,
      includeWeak: query.includeWeak,
    });

    const where: Prisma.SinQuoteWhereInput = {
      sinId: sin.id,
      ...(query.minScore !== undefined && {
        relevanceScore: { gte: query.minScore },
      }),
      quote: {
        ...(query.type?.length && { type: { in: query.type } }),
        OR: [
          { type: { not: QuoteType.HADITH } },
          { grade: { in: allowedGrades } },
        ],
      },
    };

    const [rows, total, typeGroups, alternatives] = await this.prisma.$transaction([
      this.prisma.sinQuote.findMany({
        where,
        orderBy: this.quotes.linkOrderBy(),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quote: { include: this.quotes.buildQuoteInclude(locale) },
        },
      }),
      this.prisma.sinQuote.count({ where }),
      this.prisma.quote.groupBy({
        by: ['type'],
        where: { sinLinks: { some: where } },
        _count: { _all: true },
      }),
      this.prisma.goodDeed.findMany({
        where: { oppositeSinId: sin.id },
        take: 3,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          nameAr: true,
          reward: true,
          rewardAr: true,
        },
      }),
    ]);

    const countsByType: Record<string, number> = {
      QURAN_VERSE: 0,
      HADITH: 0,
      SCHOLAR_QUOTE: 0,
      BOOK_EXCERPT: 0,
    };
    for (const group of typeGroups) {
      countsByType[group.type] = group._count._all;
    }

    return {
      data: {
        sin: {
          id: sin.id,
          slug: sin.slug,
          name: sin.name,
          nameAr: sin.nameAr,
          severity: sin.severity,
          description: sin.description,
          descriptionAr: sin.descriptionAr,
        },
        items: rows.map((row) => ({
          link: {
            id: row.id,
            relevanceScore: row.relevanceScore,
            note: row.note,
          },
          quote: this.quotes.toQuoteDto(row.quote as QuoteRowForDto, locale),
        })),
        alternatives,
      },
      meta: buildPageMeta(page, limit, total, {
        locale,
        ordering: ORDERING,
        countsByType,
        appliedGrades: allowedGrades,
      }),
    };
  }

  async findGoodDeedsForSin(slug: string, page = 1, limit = 20, locale = 'ar') {
    const sin = await this.prisma.sin.findUnique({ where: { slug } });
    if (!sin) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }
    const where = { oppositeSinId: sin.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodDeed.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          oppositeSin: {
            select: { id: true, slug: true, name: true, nameAr: true },
          },
          _count: { select: { quotes: true } },
        },
      }),
      this.prisma.goodDeed.count({ where }),
    ]);
    return paginated(
      rows.map((row) => this.goodDeeds.toDto(row)),
      page,
      limit,
      total,
      { locale },
    );
  }
}
