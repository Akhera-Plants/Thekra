import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import {
  dedupeReading,
  deedHasPublicText,
  pageReadingIds,
  READING_ORDER,
  READING_SELECT,
  visibleOrigins,
  readingTier,
  type ReadingRow,
} from '../classification/reading.js';
import {
  autoLinkExclusion,
  isPublicTopic,
  publicAcceptedLinkWhere,
  readerLinkNote,
} from '../classification/public-taxonomy.js';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  PUBLISHED_LINK_REVIEW_STATUS,
  QuotesService,
} from '../quotes/quotes.service.js';
import type { GoodDeedQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { pairForSlug } from '../taxonomy/topic-pairs.js';
import type { CreateGoodDeedDto } from './dto/create-good-deed.dto.js';
import type { GoodDeedsQueryDto } from './dto/good-deeds-query.dto.js';
import type { UpdateGoodDeedDto } from './dto/update-good-deed.dto.js';
import type {
  GoodDeedDto,
  GoodDeedSummary,
} from './entities/good-deed.entity.js';

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
    domainKey: string | null;
    taxonomyOrder: number | null;
    isContemporary: boolean;
    _count: { quotes: number };
  }): GoodDeedDto {
    const pair = pairForSlug(row.slug);
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
      domainKey: row.domainKey,
      taxonomyOrder: row.taxonomyOrder,
      isContemporary: row.isContemporary,
      pair: pair
        ? { avoid: pair.avoid, do: pair.do, titleAr: pair.titleAr, titleEn: pair.titleEn }
        : null,
      quoteCount: row._count.quotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(query: GoodDeedsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where: Prisma.GoodDeedWhereInput = {
      origin: visibleOrigins(),
      isHidden: false,
      isListed: true,
    };
    const linkWhere = publicAcceptedLinkWhere();
    const and: Prisma.GoodDeedWhereInput[] = [];

    if (query.category) where.category = query.category;
    if (query.includeEmpty !== 'true') and.push(deedHasPublicText());
    if (query.oppositeSinSlug) {
      where.oppositeSin = { slug: query.oppositeSinSlug, isHidden: false };
    }
    if (query.q) {
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"GoodDeed"',
        '"nameAr"',
        query.q,
      );
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          ...(arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : []),
        ],
      });
    }
    if (and.length > 0) where.AND = and;

    const orderBy: Prisma.GoodDeedOrderByWithRelationInput[] = [{ name: 'asc' }, { id: 'asc' }];
    const include = {
      oppositeSin: {
        select: { id: true, slug: true, name: true, nameAr: true },
      },
      _count: {
        select: {
          quotes: { where: linkWhere },
        },
      },
    };

    if (query.sort === 'quoteCount') {
      const ranked = await this.prisma.goodDeed.findMany({
        where,
        select: { id: true, _count: { select: { quotes: { where: linkWhere } } } },
      });
      ranked.sort((a, b) => b._count.quotes - a._count.quotes || a.id.localeCompare(b.id));
      const pageIds = ranked.slice((page - 1) * limit, page * limit).map((row) => row.id);
      const rows = pageIds.length === 0
        ? []
        : await this.prisma.goodDeed.findMany({ where: { id: { in: pageIds } }, include });
      const order = new Map(pageIds.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return paginated(
        rows.map((row) => this.toDto(row)),
        page,
        limit,
        ranked.length,
        { locale },
      );
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodDeed.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      this.prisma.goodDeed.count({ where }),
    ]);

    // List quoteCount is the topic's own public texts only (no TopicDerivation inflation).
    return paginated(
      rows.map((row) => this.toDto(row)),
      page,
      limit,
      total,
      { locale },
    );
  }

  private async derivedDeedCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const linkWhere = publicAcceptedLinkWhere();
    const rows = await this.prisma.topicDerivation.findMany({
      where: { fromGoodDeedId: { in: ids } },
      select: {
        fromGoodDeedId: true,
        toSin: { select: { isHidden: true, _count: { select: { quotes: { where: linkWhere } } } } },
        toGoodDeed: { select: { _count: { select: { quotes: { where: linkWhere } } } } },
      },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.fromGoodDeedId || row.toSin?.isHidden) continue;
      const count = (row.toSin?._count.quotes ?? 0) + (row.toGoodDeed?._count.quotes ?? 0);
      counts.set(row.fromGoodDeedId, (counts.get(row.fromGoodDeedId) ?? 0) + count);
    }
    return counts;
  }

  async findBySlug(slug: string, lang: string = 'ar') {
    const row = await this.prisma.goodDeed.findUnique({
      where: { slug },
      include: {
        oppositeSin: {
          select: { id: true, slug: true, name: true, nameAr: true },
        },
        imanBranches: {
          orderBy: { sortOrder: 'asc' },
          include: { imanBranch: { select: { number: true, titleAr: true, title: true } } },
        },
        _count: {
            select: {
              quotes: { where: publicAcceptedLinkWhere() },
            },
          },
      },
    });
    if (!isPublicTopic(row)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Good deed not found',
      });
    }
    return {
      ...this.toDto(row),
      locale: lang,
      isContemporary: row.isContemporary,
      branches: row.imanBranches.map((link) => ({
        number: link.imanBranch.number,
        titleAr: link.imanBranch.titleAr,
        title: link.imanBranch.title,
      })),
    };
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
        _count: {
            select: {
              quotes: { where: { reviewStatus: PUBLISHED_LINK_REVIEW_STATUS, quote: GradePolicy.readerClause() } },
            },
          },
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
        _count: {
            select: {
              quotes: { where: { reviewStatus: PUBLISHED_LINK_REVIEW_STATUS, quote: GradePolicy.readerClause() } },
            },
          },
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
      where: { oppositeSinId: sinId, origin: visibleOrigins(), isHidden: false, isListed: true },
      ...(take !== undefined ? { take } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
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
    if (!isPublicTopic(deed)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Good deed not found',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const locale = query.lang ?? 'ar';

    // P2-1: shared filter builder — resolves grade policy + quote type filter.
    const { quoteFilter, allowedGrades } = this.quotes.buildLinkQuoteFilter(query);

    const where: Prisma.GoodDeedQuoteWhereInput = {
      goodDeedId: deed.id,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      ...(query.minScore !== undefined && {
        relevanceScore: { gte: query.minScore },
      }),
      quote: quoteFilter,
    };

    // countsByKind: computed over the whole topic with the *base* filter (no kind restriction).
    const baseWhere: Prisma.GoodDeedQuoteWhereInput = {
      goodDeedId: deed.id,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      ...(query.minScore !== undefined && {
        relevanceScore: { gte: query.minScore },
      }),
      quote: this.quotes.buildLinkQuoteFilter({
        type: query.type,
        grades: query.grades,
        includeWeak: query.includeWeak,
      }).quoteFilter,
    };
    const countsByKindQ = this.quotes.countsByKind({
      linkTable: 'goodDeedLinks',
      linkWhere: baseWhere,
    });

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

      const [[rows, total, typeGroups], countsByKind] = await Promise.all([
        this.prisma.$transaction([
          this.prisma.goodDeedQuote.findMany({
            where: { id: { in: ids } },
            include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
          }),
          countQ,
          typeGroupsQ,
        ]),
        countsByKindQ,
      ]);

      // Re-order to match the shuffle ordering from the raw query
      if (ids.length > 1) {
        const order = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      }

      // P2-1: shared helper folds the groupBy result into { QURAN_VERSE, HADITH, ... }.
      const countsByType = this.quotes.countsByTypeFromGroups(typeGroups);

      return {
        data: {
          goodDeed: goodDeedPayload,
          items: rows.map((row) => ({
            link: { id: row.id, relevanceScore: row.relevanceScore, note: readerLinkNote(row.note) },
            quote: this.quotes.toQuoteDto(row.quote, locale),
          })),
        },
        meta: buildPageMeta(page, limit, total, {
          locale,
          ordering: `variety:md5(seed),floor=${floor}`,
          seed,
          countsByType,
          countsByKind,
          appliedGrades: allowedGrades,
        }),
      };
    }

    const ranked = await this.prisma.goodDeedQuote.findMany({ where, select: READING_SELECT });
    const ids = pageReadingIds(ranked as ReadingRow[], page, limit);
    const [[rows, total, typeGroups], countsByKind] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.goodDeedQuote.findMany({
          where: { id: { in: ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'] } },
          include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
        }),
        countQ,
        typeGroupsQ,
      ]),
      countsByKindQ,
    ]);
    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const countsByType = this.quotes.countsByTypeFromGroups(typeGroups);
    const primaryItems = ids.length === 0 ? [] : rows.map((row) => this.presentDeedItem(row, locale));
    const companion = await this.warningForDeed(
      deed.oppositeSin?.id ?? null,
      where.quote,
      page,
      limit,
      locale,
      new Set(primaryItems.map((item) => item.quote.id)),
    );
    const derived = deed.isContemporary
      ? await this.derivedDeedTexts(deed.id, where.quote, page, limit, locale)
      : [];

    return {
      data: {
        goodDeed: { ...goodDeedPayload, isContemporary: deed.isContemporary },
        items: primaryItems,
        companion,
        derived,
      },
      meta: buildPageMeta(page, limit, total, {
        locale,
        ordering: READING_ORDER,
        countsByType,
        countsByKind,
        appliedGrades: allowedGrades,
      }),
    };
  }

  private presentDeedItem(
    row: {
      id: string;
      relevanceScore: number | null;
      note: string | null;
      classifiedBy?: string;
      basis?: string;
      quote: Parameters<QuotesService['toQuoteDto']>[0] & { type: string; sourceId?: string | null };
    },
    locale: 'ar' | 'en',
  ) {
    const classifiedBy = row.classifiedBy ?? 'BOOK';
    const band = row.basis
      ? readingTier({ basis: row.basis, quote: { type: row.quote.type, sourceId: row.quote.sourceId ?? null } })
      : null;
    return {
      link: {
        id: row.id,
        relevanceScore: row.relevanceScore,
        note: readerLinkNote(row.note),
        classifiedBy,
        ...(band == null ? {} : { band: band === 0 ? 'ayah' : band === 1 ? 'sahihayn' : 'other' }),
      },
      quote: this.quotes.toQuoteDto(row.quote, locale),
    };
  }

  private async warningForDeed(
    oppositeSinId: string | null,
    quote: Prisma.GoodDeedQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
    excludeQuoteIds: ReadonlySet<string> = new Set(),
  ) {
    if (!oppositeSinId) return { items: [] as ReturnType<GoodDeedsService['presentDeedItem']>[] };
    const ranked = await this.prisma.sinQuote.findMany({
      where: {
        sinId: oppositeSinId,
        reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
        ...autoLinkExclusion(),
        quote,
        ...(excludeQuoteIds.size > 0 ? { quoteId: { notIn: [...excludeQuoteIds] } } : {}),
      },
      select: READING_SELECT,
    });
    const pageRows = dedupeReading(ranked as ReadingRow[]).slice((page - 1) * limit, page * limit);
    if (pageRows.length === 0) return { items: [] as ReturnType<GoodDeedsService['presentDeedItem']>[] };
    const full = await this.prisma.sinQuote.findMany({
      where: { id: { in: pageRows.map((row) => row.id) } },
      include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
    });
    const order = new Map(pageRows.map((row, index) => [row.id, index]));
    full.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { items: full.map((row) => this.presentDeedItem(row, locale)) };
  }

  private async derivedDeedTexts(
    deedId: string,
    quote: Prisma.GoodDeedQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
  ) {
    const links = await this.prisma.topicDerivation.findMany({
      where: { fromGoodDeedId: deedId },
      select: {
        toSin: { select: { id: true, slug: true, name: true, nameAr: true, isHidden: true } },
        toGoodDeed: { select: { id: true, slug: true, name: true, nameAr: true } },
      },
    });
    const groups = [];
    for (const link of links) {
      if (link.toSin && !link.toSin.isHidden) {
        groups.push({
          slug: link.toSin.slug,
          name: link.toSin.name,
          nameAr: link.toSin.nameAr,
          side: 'AVOID' as const,
          items: await this.pageDeedSource('sin', link.toSin.id, quote, page, limit, locale),
        });
      }
      if (link.toGoodDeed) {
        groups.push({
          slug: link.toGoodDeed.slug,
          name: link.toGoodDeed.name,
          nameAr: link.toGoodDeed.nameAr,
          side: 'DO' as const,
          items: await this.pageDeedSource('deed', link.toGoodDeed.id, quote, page, limit, locale),
        });
      }
    }
    return groups;
  }

  private async pageDeedSource(
    side: 'sin' | 'deed',
    id: string,
    quote: Prisma.GoodDeedQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
  ) {
    const where = {
      ...(side === 'sin' ? { sinId: id } : { goodDeedId: id }),
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      quote,
    };
    const ranked = side === 'sin'
      ? await this.prisma.sinQuote.findMany({ where, select: READING_SELECT })
      : await this.prisma.goodDeedQuote.findMany({ where, select: READING_SELECT });
    const ids = pageReadingIds(ranked as ReadingRow[], page, limit);
    if (ids.length === 0) return [];
    const rows = side === 'sin'
      ? await this.prisma.sinQuote.findMany({
        where: { id: { in: ids } },
        include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
      })
      : await this.prisma.goodDeedQuote.findMany({
        where: { id: { in: ids } },
        include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
      });
    const order = new Map(ids.map((linkId, index) => [linkId, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return rows.map((row) => this.presentDeedItem(row, locale));
  }
}
