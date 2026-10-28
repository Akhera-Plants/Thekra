import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import {
  dedupeReading,
  deedHasPublicText,
  pageReadingIds,
  compareReading,
  countsByTypeFromRanked,
  READING_ORDER,
  READING_SELECT,
  visibleOrigins,
  readingHasNext,
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
import { scheduleForDeed } from '../practice/practice-catalog.js';
import { pairForSlug } from '../taxonomy/topic-pairs.js';
import { findActiveTheme, mergePageThemes, readThemedPage, summariseThemes } from '../taxonomy/theme-reading.js';
import { themesForTopics } from '../taxonomy/topic-themes.js';
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

    const [rows, total] = await Promise.all([
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
      // Reminder habits and sunnah occasions that lead to this deed (deed-schedules.yaml).
      schedule: scheduleForDeed(row.slug),
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
    // Topic themes: this deed's, then its paired sin's (one page, taxonomy.yaml pairs:).
    const pair = pairForSlug(deed.slug);
    const pairedSinId = pair ? (deed.oppositeSin?.id ?? null) : null;
    const pageThemes = mergePageThemes(themesForTopics(pair ? [deed.slug, pair.avoid] : [deed.slug]), pair?.avoid ?? null);
    const activeTheme = findActiveTheme(pageThemes, query.theme);
    const sinSide = (quote: Prisma.SinQuoteWhereInput['quote']): Prisma.SinQuoteWhereInput => ({
      sinId: pairedSinId ?? undefined,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      quote,
    });
    const themeSummaryQ = summariseThemes(
      this.prisma,
      { deed: baseWhere, ...(pairedSinId ? { sin: sinSide(baseWhere.quote) } : {}) },
      pageThemes,
      activeTheme,
    );

    const countsByKindQ = activeTheme
      ? Promise.resolve(null)
      : this.quotes.countsByKind({
          linkTable: 'goodDeedLinks',
          linkWhere: baseWhere,
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

    // ── Theme: one merged, deduped list over the page (deed + paired sin) ─────
    // Kind still applies. Counts follow the theme; meta.themes does not.
    if (activeTheme) {
      const has = { themeKeys: { hasSome: activeTheme.keys } };
      const [themed, summary] = await Promise.all([
        readThemedPage(
          this.prisma,
          { deed: { ...where, ...has }, ...(pairedSinId ? { sin: { ...sinSide(where.quote), ...has } } : {}) },
          {
            page,
            limit,
            hydrate: (rows) => this.quotes.hydrateLinks(rows, locale),
            present: (row) => this.presentDeedItem(row as Parameters<GoodDeedsService['presentDeedItem']>[0], locale),
          },
        ),
        themeSummaryQ,
      ]);
      return {
        data: {
          goodDeed: { ...goodDeedPayload, isContemporary: deed.isContemporary },
          items: themed.items,
          companion: { items: [] },
          derived: [],
        },
        meta: buildPageMeta(page, limit, themed.total, {
          locale,
          ordering: READING_ORDER,
          countsByType: themed.countsByType,
          countsByKind: summary.countsByKind,
          appliedGrades: allowedGrades,
          themes: summary.themes,
          theme: activeTheme.key,
        }),
      };
    }

    // ── Shuffle variety mode (§4.2) ────────────────────────────────────────────
    // One shared implementation with SinsService.findQuotesForSin — both call
    // QuotesService.shuffleLinksPage with the appropriate table / parentKey.
    if (query.shuffle) {
      const seed = query.seed ?? new Date().toISOString().slice(0, 10);
      const floor = this.quotes.getVarietyScoreFloor();

      const countQ = this.prisma.goodDeedQuote.count({ where });
      const typeGroupsQ = this.prisma.quote.groupBy({
        by: ['type'],
        where: { goodDeedLinks: { some: where } },
        _count: { _all: true },
      });
      const [[ids, total, typeGroups], countsByKind, summary] = await Promise.all([
        Promise.all([
          this.quotes.shuffleLinksPage({
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
          }),
          countQ,
          typeGroupsQ,
        ]),
        countsByKindQ,
        themeSummaryQ,
      ]);
      const links = ids.length === 0 ? [] : await this.prisma.goodDeedQuote.findMany({ where: { id: { in: ids } } });
      const rows = await this.quotes.hydrateLinks(links, locale);

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
          themes: summary.themes,
          theme: null,
        }),
      };
    }

    // Wave 1: every query that needs only the deed, in parallel. The ranked rows also give
    // the link total and the per-type breakdown, so no count/groupBy round trips.
    const [ranked, countsByKind, summary, warningRanked, derivedLinks] = await Promise.all([
      this.prisma.goodDeedQuote.findMany({ where, select: READING_SELECT }),
      countsByKindQ,
      themeSummaryQ,
      this.warningRanked(deed.oppositeSin?.id ?? null, where.quote),
      deed.isContemporary ? this.derivedLinks(deed.id) : Promise.resolve([]),
    ]);
    const ids = pageReadingIds(ranked as ReadingRow[], page, limit);
    const total = ranked.length;
    const countsByType = countsByTypeFromRanked(ranked);
    const pageQuoteIds = new Set(
      ids.map((id) => ranked.find((row) => row.id === id)?.quoteId).filter((id): id is string => id != null),
    );

    // Wave 2: the page rows, the warning page and the derived groups, in parallel.
    const rankedById = new Map((ranked as ReadingRow[]).map((row) => [row.id, row]));
    const [rows, companion, derived] = await Promise.all([
      this.quotes.hydrateLinks(ids.flatMap((id) => rankedById.get(id) ?? []), locale),
      this.warningPage(warningRanked, pageQuoteIds, page, limit, locale),
      this.derivedDeedTexts(derivedLinks, where.quote, page, limit, locale),
    ]);
    const primaryItems = rows.map((row) => this.presentDeedItem(row, locale));

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
        themes: summary.themes,
        theme: null,
        hasNext: readingHasNext(
          page,
          limit,
          [total, dedupeReading(warningRanked as ReadingRow[]).length],
          derived.map((group) => group.items.length),
        ),
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

  /** Ranked reading rows of the paired sin that sit beside a deed page. */
  private async warningRanked(
    oppositeSinId: string | null,
    quote: Prisma.GoodDeedQuoteWhereInput['quote'],
  ): Promise<ReadingRow[]> {
    if (!oppositeSinId) return [];
    const ranked = await this.prisma.sinQuote.findMany({
      where: {
        sinId: oppositeSinId,
        reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
        ...autoLinkExclusion(),
        quote,
      },
      select: READING_SELECT,
    });
    return ranked as ReadingRow[];
  }

  /** The warning page: texts already on the main page are left out before the reading-order dedupe. */
  private async warningPage(
    ranked: ReadingRow[],
    excludeQuoteIds: ReadonlySet<string>,
    page: number,
    limit: number,
    locale: 'ar' | 'en',
  ) {
    const pageRows = dedupeReading(ranked.filter((row) => !excludeQuoteIds.has(row.quoteId)))
      .slice((page - 1) * limit, page * limit);
    if (pageRows.length === 0) return { items: [] as ReturnType<GoodDeedsService['presentDeedItem']>[] };
    const full = await this.quotes.hydrateLinks(pageRows, locale);
    return { items: full.map((row) => this.presentDeedItem(row, locale)) };
  }

  private derivedLinks(deedId: string) {
    return this.prisma.topicDerivation.findMany({
      where: { fromGoodDeedId: deedId },
      select: {
        toSin: { select: { id: true, slug: true, name: true, nameAr: true, isHidden: true } },
        toGoodDeed: { select: { id: true, slug: true, name: true, nameAr: true } },
      },
    });
  }

  /** Derived groups in link order (sin side first), each read in parallel with the others. */
  private async derivedDeedTexts(
    links: Awaited<ReturnType<GoodDeedsService['derivedLinks']>>,
    quote: Prisma.GoodDeedQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
  ) {
    const jobs: Array<Promise<{ slug: string; name: string; nameAr: string; side: 'AVOID' | 'DO'; items: Awaited<ReturnType<GoodDeedsService['pageDeedSource']>> }>> = [];
    for (const link of links) {
      const toSin = link.toSin;
      if (toSin && !toSin.isHidden) {
        jobs.push(this.pageDeedSource('sin', toSin.id, quote, page, limit, locale).then((items) => (
          { slug: toSin.slug, name: toSin.name, nameAr: toSin.nameAr, side: 'AVOID' as const, items }
        )));
      }
      const toDeed = link.toGoodDeed;
      if (toDeed) {
        jobs.push(this.pageDeedSource('deed', toDeed.id, quote, page, limit, locale).then((items) => (
          { slug: toDeed.slug, name: toDeed.name, nameAr: toDeed.nameAr, side: 'DO' as const, items }
        )));
      }
    }
    return Promise.all(jobs);
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
    const pageRows = [...(ranked as ReadingRow[])].sort(compareReading).slice((page - 1) * limit, page * limit);
    const rows = await this.quotes.hydrateLinks(pageRows, locale);
    return rows.map((row) => this.presentDeedItem(row, locale));
  }
}
