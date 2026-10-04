import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import type { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import type { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import type { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
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
      // Arabic field: match via DB-side normalisation (strips tashkeel, folds alef/ya/ta-marbuta)
      // Latin field: standard Prisma ILIKE (no normalisation needed)
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"GoodDeed"',
        '"nameAr"',
        query.q,
      );
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        ...(arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : []),
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

  async findBySlug(slug: string, lang: string = 'ar'): Promise<GoodDeedDto & { locale: string }> {
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
    return { ...this.toDto(row), locale: lang };
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminCreate(dto: CreateGoodDeedDto): Promise<GoodDeedDto> {
    if (dto.oppositeSinId) {
      const sin = await this.prisma.sin.findUnique({ where: { id: dto.oppositeSinId } });
      if (!sin) {
        throw new UnprocessableEntityException({
          code: 'RELATED_RESOURCE_INVALID',
          message: 'oppositeSinId does not exist',
        });
      }
    }
    // Will throw P2002 → 409 if slug is duplicate
    const row = await this.prisma.goodDeed.create({
      data: dto,
      include: {
        oppositeSin: { select: { id: true, slug: true, name: true, nameAr: true } },
        _count: { select: { quotes: true } },
      },
    });
    return this.toDto(row);
  }

  async adminUpdate(id: string, dto: UpdateGoodDeedDto): Promise<GoodDeedDto> {
    const existing = await this.prisma.goodDeed.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Good deed not found' });
    }
    if (dto.oppositeSinId !== undefined && dto.oppositeSinId !== null) {
      const sin = await this.prisma.sin.findUnique({ where: { id: dto.oppositeSinId } });
      if (!sin) {
        throw new UnprocessableEntityException({
          code: 'RELATED_RESOURCE_INVALID',
          message: 'oppositeSinId does not exist',
        });
      }
    }
    const row = await this.prisma.goodDeed.update({
      where: { id },
      data: dto,
      include: {
        oppositeSin: { select: { id: true, slug: true, name: true, nameAr: true } },
        _count: { select: { quotes: true } },
      },
    });
    return this.toDto(row);
  }

  async adminDelete(id: string): Promise<void> {
    const existing = await this.prisma.goodDeed.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Good deed not found' });
    }
    await this.prisma.goodDeed.delete({ where: { id } });
  }

  async findByOppositeSinId(sinId: string, take?: number): Promise<GoodDeedSummary[]> {
    const rows = await this.prisma.goodDeed.findMany({
      where: { oppositeSinId: sinId },
      ...(take !== undefined ? { take } : {}),
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
        ...GradePolicy.whereClause(allowedGrades),
      },
    };

    // Shared sub-queries (count, type breakdown) — same for both paths
    const countQ = this.prisma.goodDeedQuote.count({ where });
    const typeGroupsQ = this.prisma.quote.groupBy({
      by: ['type'],
      where: { goodDeedLinks: { some: where } },
      _count: { _all: true },
    });

    // Good-deed payload (reused in both response shapes)
    const goodDeedPayload = {
      id: deed.id,
      slug: deed.slug,
      name: deed.name,
      nameAr: deed.nameAr,
      reward: deed.reward,
      rewardAr: deed.rewardAr,
      description: deed.description,
      descriptionAr: deed.descriptionAr,
      oppositeSin: deed.oppositeSin,
    };

    // ── Shuffle variety mode (§4.2) ────────────────────────────────────────────
    // One shared implementation with SinsService.findQuotesForSin — both call
    // QuotesService.shuffleLinksPage with the appropriate table / parentKey.
    if (query.shuffle) {
      const seed = query.seed ?? new Date().toISOString().slice(0, 10);
      const floor = this.quotes.getVarietyScoreFloor();

      const ids = await this.quotes.shuffleLinksPage({
        table: '"GoodDeedQuote"',
        parentKey: '"goodDeedId"',
        parentId: deed.id,
        minScore: query.minScore,
        types: query.type,
        allowedGrades,
        seed,
        floor,
        page,
        limit,
      });

      const [rows, total, typeGroups] = await this.prisma.$transaction([
        this.prisma.goodDeedQuote.findMany({
          where: { id: { in: ids } },
          include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
        }),
        countQ,
        typeGroupsQ,
      ]);

      // Re-order to match the shuffle ordering from the raw query
      if (ids.length > 1) {
        const order = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      }

      const countsByType: Record<string, number> = {
        QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0,
      };
      for (const g of typeGroups) countsByType[g.type] = g._count._all;

      return {
        data: {
          goodDeed: goodDeedPayload,
          items: rows.map((row) => ({
            link: { id: row.id, relevanceScore: row.relevanceScore, note: row.note },
            quote: this.quotes.toQuoteDto(row.quote, locale),
          })),
        },
        meta: buildPageMeta(page, limit, total, {
          locale,
          ordering: `variety:md5(seed),floor=${floor}`,
          seed,
          countsByType,
          appliedGrades: allowedGrades,
        }),
      };
    }

    // ── Normal ordering path ───────────────────────────────────────────────────
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
      countQ,
      typeGroupsQ,
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
        goodDeed: goodDeedPayload,
        items: rows.map((row) => ({
          link: {
            id: row.id,
            relevanceScore: row.relevanceScore,
            note: row.note,
          },
          quote: this.quotes.toQuoteDto(row.quote, locale),
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
