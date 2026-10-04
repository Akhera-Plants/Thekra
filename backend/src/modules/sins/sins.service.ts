import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { CreateSinDto } from './dto/create-sin.dto.js';
import type { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import type { SinsQueryDto } from './dto/sins-query.dto.js';
import type { UpdateSinDto } from './dto/update-sin.dto.js';
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
      // Arabic field: match via DB-side normalisation (strips tashkeel, folds alef/ya/ta-marbuta)
      // Latin field: standard Prisma ILIKE (no normalisation needed)
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Sin"',
        '"nameAr"',
        query.q,
      );
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        ...(arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : []),
      ];
    }

    const orderBy: Prisma.SinOrderByWithRelationInput =
      query.sort === 'severity'
        ? { severity: { sort: 'desc', nulls: 'last' } }
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

  async findBySlug(slug: string, lang: string = 'ar'): Promise<SinDetailDto & { locale: string }> {
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
    // No cap: return all related good deeds on the detail page.
    // findAlternatives() uses take:3 separately for the quotes list endpoint.
    const relatedGoodDeeds = await this.goodDeeds.findByOppositeSinId(row.id);
    return { ...this.toDto(row), relatedGoodDeeds, locale: lang };
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
        ...GradePolicy.whereClause(allowedGrades),
      },
    };

    // Shared sub-queries (count, type breakdown, alternatives) — same for both paths
    const countQ = this.prisma.sinQuote.count({ where });
    const typeGroupsQ = this.prisma.quote.groupBy({
      by: ['type'],
      where: { sinLinks: { some: where } },
      _count: { _all: true },
    });
    const alternativesQ = this.prisma.goodDeed.findMany({
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
    });

    // ── Shuffle variety mode (§4.2) ────────────────────────────────────────────
    // When shuffle=true: rows with score >= VARIETY_SCORE_FLOOR are ordered by
    // md5(link.id || seed); remainder follows normal LINK_ORDER. Pagination is
    // deterministic for a given seed. seed defaults to the current day bucket
    // (yyyy-mm-dd) so the order is stable across the day without requiring auth.
    if (query.shuffle) {
      const seed = query.seed ?? new Date().toISOString().slice(0, 10);
      const floor = this.quotes.getVarietyScoreFloor();

      const ids = await this.quotes.shuffleLinksPage({
        table: '"SinQuote"',
        parentKey: '"sinId"',
        parentId: sin.id,
        minScore: query.minScore,
        types: query.type,
        allowedGrades,
        seed,
        floor,
        page,
        limit,
      });

      const [rows, total, typeGroups, alternatives] = await this.prisma.$transaction([
        this.prisma.sinQuote.findMany({
          where: { id: { in: ids } },
          include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
        }),
        countQ,
        typeGroupsQ,
        alternativesQ,
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
            link: { id: row.id, relevanceScore: row.relevanceScore, note: row.note },
            quote: this.quotes.toQuoteDto(row.quote, locale),
          })),
          alternatives,
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
      countQ,
      typeGroupsQ,
      alternativesQ,
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
          quote: this.quotes.toQuoteDto(row.quote, locale),
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

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminCreate(dto: CreateSinDto): Promise<SinDto> {
    // Will throw P2002 → 409 if slug is duplicate (handled by AllExceptionsFilter)
    const row = await this.prisma.sin.create({
      data: dto,
      include: { _count: { select: { quotes: true } } },
    });
    return this.toDto(row);
  }

  async adminUpdate(id: string, dto: UpdateSinDto): Promise<SinDto> {
    const existing = await this.prisma.sin.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin not found' });
    }
    const row = await this.prisma.sin.update({
      where: { id },
      data: dto,
      include: { _count: { select: { quotes: true } } },
    });
    return this.toDto(row);
  }

  async adminDelete(id: string, force = false): Promise<void> {
    const existing = await this.prisma.sin.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin not found' });
    }
    if (!force) {
      const linkCount = await this.prisma.sinQuote.count({ where: { sinId: id } });
      if (linkCount > 0) {
        throw new ConflictException({
          code: 'SIN_HAS_LINKS',
          message: `Sin has ${linkCount} linked quote(s). Pass ?force=true to delete anyway.`,
        });
      }
    }
    await this.prisma.sin.delete({ where: { id } });
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
