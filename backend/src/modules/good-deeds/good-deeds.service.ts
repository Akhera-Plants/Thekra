import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuoteType } from '@prisma/client';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import type { QuoteRowForDto } from '../../common/mappers/quote.mapper.js';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import type { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import type {
  GoodDeedDto,
  GoodDeedSummary,
} from './entities/good-deed.entity.js';

const ORDERING =
  'relevanceScore:desc,grade:asc,createdAt:desc';

@Injectable()
export class GoodDeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  toDto(row: {
    id: string;
    name: string;
    nameAr: string;
    slug: string;
    category: string | null;
    description: string | null;
    descriptionAr: string | null;
    reward: string | null;
    rewardAr: string | null;
    createdAt: Date;
    updatedAt: Date;
    oppositeSin: {
      id: string;
      slug: string;
      name: string;
      nameAr: string;
    } | null;
    _count: { quotes: number };
  }): GoodDeedDto {
    return {
      id: row.id,
      name: row.name,
      nameAr: row.nameAr,
      slug: row.slug,
      category: row.category,
      description: row.description,
      descriptionAr: row.descriptionAr,
      reward: row.reward,
      rewardAr: row.rewardAr,
      oppositeSin: row.oppositeSin,
      quoteCount: row._count.quotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(query: GoodDeedsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where: Prisma.GoodDeedWhereInput = {};

    if (query.category) where.category = query.category;
    if (query.oppositeSinSlug) {
      where.oppositeSin = { slug: query.oppositeSinSlug };
    }
    if (query.q) {
      const q = normalizeArabic(query.q);
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.GoodDeedOrderByWithRelationInput =
      query.sort === 'quoteCount'
        ? { quotes: { _count: 'desc' } }
        : { name: 'asc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodDeed.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
      rows.map((row) => this.toDto(row)),
      page,
      limit,
      total,
      { locale },
    );
  }

  async findBySlug(slug: string): Promise<GoodDeedDto> {
    const row = await this.prisma.goodDeed.findUnique({
      where: { slug },
      include: {
        oppositeSin: {
          select: { id: true, slug: true, name: true, nameAr: true },
        },
        _count: { select: { quotes: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Good deed not found',
      });
    }
    return this.toDto(row);
  }

  async findByOppositeSinId(sinId: string, take = 3): Promise<GoodDeedSummary[]> {
    const rows = await this.prisma.goodDeed.findMany({
      where: { oppositeSinId: sinId },
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        nameAr: true,
        reward: true,
        rewardAr: true,
      },
    });
    return rows;
  }

  async findQuotesForGoodDeed(slug: string, query: GoodDeedQuotesQueryDto) {
    const deed = await this.prisma.goodDeed.findUnique({
      where: { slug },
      include: {
        oppositeSin: {
          select: { id: true, slug: true, name: true, nameAr: true },
        },
      },
    });
    if (!deed) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Good deed not found',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const locale = query.lang ?? 'ar';
    const allowedGrades = GradePolicy.resolveAllowedGrades({
      grades: query.grades,
      includeWeak: query.includeWeak,
    });

    const where: Prisma.GoodDeedQuoteWhereInput = {
      goodDeedId: deed.id,
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

    const [rows, total, typeGroups] = await this.prisma.$transaction([
      this.prisma.goodDeedQuote.findMany({
        where,
        orderBy: this.quotes.linkOrderBy(),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          quote: { include: this.quotes.buildQuoteInclude(locale) },
        },
      }),
      this.prisma.goodDeedQuote.count({ where }),
      this.prisma.quote.groupBy({
        by: ['type'],
        where: { goodDeedLinks: { some: where } },
        _count: { _all: true },
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
        goodDeed: {
          id: deed.id,
          slug: deed.slug,
          name: deed.name,
          nameAr: deed.nameAr,
          reward: deed.reward,
          rewardAr: deed.rewardAr,
          description: deed.description,
          descriptionAr: deed.descriptionAr,
          oppositeSin: deed.oppositeSin,
        },
        items: rows.map((row) => ({
          link: {
            id: row.id,
            relevanceScore: row.relevanceScore,
            note: row.note,
          },
          quote: this.quotes.toQuoteDto(row.quote as QuoteRowForDto, locale),
        })),
      },
      meta: buildPageMeta(page, limit, total, {
        locale,
        ordering: ORDERING,
        countsByType,
        appliedGrades: allowedGrades,
      }),
    };
  }
}
