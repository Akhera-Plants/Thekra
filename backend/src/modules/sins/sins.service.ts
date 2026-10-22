import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type SinRank } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import {
  dedupeReading,
  pageReadingIds,
  READING_ORDER,
  READING_SELECT,
  sinHasPublicText,
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
import { GoodDeedsService } from '../good-deeds/good-deeds.service.js';
import {
  PUBLISHED_LINK_REVIEW_STATUS,
  QuotesService,
} from '../quotes/quotes.service.js';
import type { CreateSinDto } from './dto/create-sin.dto.js';
import type { SinQuotesQueryDto } from './dto/sin-quotes-query.dto.js';
import type { SinsQueryDto } from './dto/sins-query.dto.js';
import type { UpdateSinDto } from './dto/update-sin.dto.js';
import { isPairedSlug, pairForSlug } from '../taxonomy/topic-pairs.js';
import { readThemedPage, summariseThemes } from '../taxonomy/theme-reading.js';
import { themesForTopics } from '../taxonomy/topic-themes.js';
import type { SinDetailDto, SinDto } from './entities/sin.entity.js';

const SIN_READ_INCLUDE = {
  rankSource: { select: { id: true, name: true, nameAr: true } },
  _count: {
    select: { quotes: { where: publicAcceptedLinkWhere() } },
  },
} satisfies Prisma.SinInclude;

@Injectable()
export class SinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly goodDeeds: GoodDeedsService,
  ) {}

  toDto(
    row: {
      id: string;
      name: string;
      nameAr: string;
      slug: string;
      category: string | null;
      description: string | null;
      descriptionAr: string | null;
      severity: number | null;
      rank: SinRank | null;
      rankReference: string | null;
      rankSource: { id: string; name: string; nameAr: string | null } | null;
      domainKey: string | null;
      taxonomyOrder: number | null;
      isContemporary: boolean;
      createdAt: Date;
      updatedAt: Date;
      _count: { quotes: number };
    },
    options?: { includeSeverity?: boolean },
  ): SinDto {
    const pair = pairForSlug(row.slug);
    return {
      id: row.id,
      name: row.name,
      nameAr: row.nameAr,
      slug: row.slug,
      category: row.category,
      description: row.description,
      descriptionAr: row.descriptionAr,
      ...(options?.includeSeverity ? { severity: row.severity } : {}),
      rank: row.rank,
      rankReference: row.rankReference,
      rankSource: row.rankSource,
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

  async findAll(query: SinsQueryDto, scope: 'public' | 'admin' = 'public') {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const where: Prisma.SinWhereInput = {};
    const linkWhere = scope === 'public'
      ? publicAcceptedLinkWhere()
      : { reviewStatus: PUBLISHED_LINK_REVIEW_STATUS, quote: GradePolicy.readerClause() };
    const and: Prisma.SinWhereInput[] = [];

    if (scope === 'public') {
      where.origin = visibleOrigins();
      where.isHidden = false;
      where.isListed = true;
      if (query.includeEmpty !== 'true') and.push(sinHasPublicText());
    } else if (query.includeEmpty !== 'true') {
      where.quotes = { some: linkWhere };
    }
    if (query.category) where.category = query.category;
    if (query.rank) where.rank = query.rank;
    if (query.q) {
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Sin"',
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

    const orderBy: Prisma.SinOrderByWithRelationInput[] =
      query.sort === 'quoteCount' && scope === 'admin'
        ? [{ quotes: { _count: 'desc' } }, { id: 'asc' }]
        : [{ name: 'asc' }, { id: 'asc' }];
    const include = {
      ...SIN_READ_INCLUDE,
      _count: { select: { quotes: { where: linkWhere } } },
    };

    if (query.sort === 'quoteCount' && scope === 'public') {
      // Rank by each topic's own public texts — not texts inherited via TopicDerivation.
      const ranked = await this.prisma.sin.findMany({
        where,
        select: { id: true, _count: { select: { quotes: { where: linkWhere } } } },
      });
      ranked.sort((a, b) => b._count.quotes - a._count.quotes || a.id.localeCompare(b.id));
      const pageIds = ranked.slice((page - 1) * limit, page * limit).map((row) => row.id);
      const counts = new Map(ranked.map((row) => [row.id, row._count.quotes]));
      const rows = pageIds.length === 0
        ? []
        : await this.prisma.sin.findMany({ where: { id: { in: pageIds } }, include });
      const order = new Map(pageIds.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return paginated(
        rows.map((row) => this.toDto({ ...row, _count: { quotes: counts.get(row.id) ?? row._count.quotes } })),
        page,
        limit,
        ranked.length,
        { locale },
      );
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sin.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include,
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

  private async derivedSinCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const linkWhere = publicAcceptedLinkWhere();
    const rows = await this.prisma.topicDerivation.findMany({
      where: { fromSinId: { in: ids } },
      select: {
        fromSinId: true,
        toSin: { select: { isHidden: true, _count: { select: { quotes: { where: linkWhere } } } } },
        toGoodDeed: { select: { _count: { select: { quotes: { where: linkWhere } } } } },
      },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.fromSinId || row.toSin?.isHidden) continue;
      const count = (row.toSin?._count.quotes ?? 0) + (row.toGoodDeed?._count.quotes ?? 0);
      counts.set(row.fromSinId, (counts.get(row.fromSinId) ?? 0) + count);
    }
    return counts;
  }

  async findBySlug(slug: string, lang: string = 'ar'): Promise<SinDetailDto & { locale: string }> {
    const row = await this.prisma.sin.findUnique({
      where: { slug },
      include: {
        ...SIN_READ_INCLUDE,
        imanBranches: {
          orderBy: { sortOrder: 'asc' },
          include: { imanBranch: { select: { number: true, titleAr: true, title: true } } },
        },
      },
    });
    if (!isPublicTopic(row)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }
    const relatedGoodDeeds = await this.goodDeeds.findByOppositeSinId(row.id);
    return {
      ...this.toDto(row),
      relatedGoodDeeds,
      locale: lang,
      isContemporary: row.isContemporary,
      branches: row.imanBranches.map((link) => ({
        number: link.imanBranch.number,
        titleAr: link.imanBranch.titleAr,
        title: link.imanBranch.title,
      })),
    };
  }

  async findAlternatives(sinId: string) {
    return this.goodDeeds.findByOppositeSinId(sinId, 3);
  }

  async findQuotesForSin(slug: string, query: SinQuotesQueryDto) {
    const sin = await this.prisma.sin.findUnique({ where: { slug } });
    if (!isPublicTopic(sin)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const locale = query.lang ?? 'ar';

    // P2-1: shared filter builder — resolves grade policy + quote type filter.
    const { quoteFilter, allowedGrades } = this.quotes.buildLinkQuoteFilter(query);

    const where: Prisma.SinQuoteWhereInput = {
      sinId: sin.id,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      ...(query.minScore !== undefined && {
        relevanceScore: { gte: query.minScore },
      }),
      quote: quoteFilter,
    };

    // countsByKind: computed over the whole topic with the *base* filter (no kind restriction).
    // This gives stable tab counts regardless of which kind the caller is currently viewing.
    const baseWhere: Prisma.SinQuoteWhereInput = {
      sinId: sin.id,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      ...(query.minScore !== undefined && {
        relevanceScore: { gte: query.minScore },
      }),
      quote: this.quotes.buildLinkQuoteFilter({
        type: query.type,
        grades: query.grades,
        includeWeak: query.includeWeak,
        // no kind here — we want counts for all kinds
      }).quoteFilter,
    };
    // Topic themes: this sin's, then its paired deed's (one page, taxonomy.yaml pairs:).
    const pair = pairForSlug(sin.slug);
    const pairedDeedId = pair ? sin.oppositeGoodDeedId : null;
    const pageThemes = themesForTopics(pair ? [sin.slug, pair.do] : [sin.slug]);
    const activeTheme = pageThemes.find((theme) => theme.key === query.theme)?.key ?? null;
    const deedSide = (quote: Prisma.GoodDeedQuoteWhereInput['quote']): Prisma.GoodDeedQuoteWhereInput => ({
      goodDeedId: pairedDeedId ?? undefined,
      reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
      ...autoLinkExclusion(),
      quote,
    });
    const themeSummaryQ = summariseThemes(
      this.prisma,
      { sin: baseWhere, ...(pairedDeedId ? { deed: deedSide(baseWhere.quote) } : {}) },
      pageThemes,
      activeTheme,
    );

    const countsByKindQ = activeTheme
      ? Promise.resolve(null)
      : this.quotes.countsByKind({
          linkTable: 'sinLinks',
          linkWhere: baseWhere,
        });

    // Shared sub-queries (count, type breakdown, alternatives) — same for both paths
    const countQ = this.prisma.sinQuote.count({ where });
    const typeGroupsQ = this.prisma.quote.groupBy({
      by: ['type'],
      where: { sinLinks: { some: where } },
      _count: { _all: true },
    });
    const alternativesQ = this.prisma.goodDeed.findMany({
      where: { oppositeSinId: sin.id, origin: visibleOrigins(), isHidden: false, isListed: true },
      take: 3,
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

    const sinPayload = {
      id: sin.id,
      slug: sin.slug,
      name: sin.name,
      nameAr: sin.nameAr,
      rank: sin.rank,
      description: sin.description,
      descriptionAr: sin.descriptionAr,
    };

    // ── Theme: one merged, deduped list over the page (sin + paired deed) ─────
    // Kind still applies. Counts follow the theme; meta.themes does not.
    if (activeTheme) {
      const has = { themeKeys: { has: activeTheme } };
      const [themed, summary, alternatives] = await Promise.all([
        readThemedPage(
          this.prisma,
          { sin: { ...where, ...has }, ...(pairedDeedId ? { deed: { ...deedSide(where.quote), ...has } } : {}) },
          {
            page,
            limit,
            include: this.quotes.buildQuoteInclude(locale),
            present: (row) => this.presentSinItem(row as Parameters<SinsService['presentSinItem']>[0], locale),
          },
        ),
        themeSummaryQ,
        alternativesQ,
      ]);
      return {
        data: {
          sin: { ...sinPayload, isContemporary: sin.isContemporary },
          items: themed.items,
          companion: { items: [] },
          derived: [],
          alternatives,
        },
        meta: buildPageMeta(page, limit, themed.total, {
          locale,
          ordering: READING_ORDER,
          countsByType: themed.countsByType,
          countsByKind: summary.countsByKind,
          appliedGrades: allowedGrades,
          themes: summary.themes,
          theme: activeTheme,
        }),
      };
    }

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

      const [[rows, total, typeGroups, alternatives], countsByKind, summary] = await Promise.all([
        this.prisma.$transaction([
          this.prisma.sinQuote.findMany({
            where: { id: { in: ids } },
            include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
          }),
          countQ,
          typeGroupsQ,
          alternativesQ,
        ]),
        countsByKindQ,
        themeSummaryQ,
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
          sin: {
            id: sin.id,
            slug: sin.slug,
            name: sin.name,
            nameAr: sin.nameAr,
            rank: sin.rank,
            description: sin.description,
            descriptionAr: sin.descriptionAr,
          },
          items: rows.map((row) => ({
            link: { id: row.id, relevanceScore: row.relevanceScore, note: readerLinkNote(row.note) },
            quote: this.quotes.toQuoteDto(row.quote, locale),
          })),
          alternatives,
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

    const ranked = await this.prisma.sinQuote.findMany({ where, select: READING_SELECT });
    const ids = pageReadingIds(ranked as ReadingRow[], page, limit);
    const [[rows, total, typeGroups, alternatives], countsByKind, summary] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.sinQuote.findMany({
          where: { id: { in: ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'] } },
          include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
        }),
        countQ,
        typeGroupsQ,
        alternativesQ,
      ]),
      countsByKindQ,
      themeSummaryQ,
    ]);
    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const countsByType = this.quotes.countsByTypeFromGroups(typeGroups);
    const primaryItems = ids.length === 0 ? [] : rows.map((row) => this.presentSinItem(row, locale));
    const companion = await this.rewardForSin(
      sin,
      where.quote,
      page,
      limit,
      locale,
      new Set(primaryItems.map((item) => item.quote.id)),
    );
    const derived = sin.isContemporary
      ? await this.derivedSinTexts(sin.id, where.quote, page, limit, locale)
      : [];

    return {
      data: {
        sin: {
          id: sin.id,
          slug: sin.slug,
          name: sin.name,
          nameAr: sin.nameAr,
          rank: sin.rank,
          description: sin.description,
          descriptionAr: sin.descriptionAr,
          isContemporary: sin.isContemporary,
        },
        items: primaryItems,
        companion,
        derived,
        alternatives,
      },
      meta: buildPageMeta(page, limit, total, {
        locale,
        ordering: READING_ORDER,
        countsByType,
        countsByKind,
        appliedGrades: allowedGrades,
        themes: summary.themes,
        theme: null,
      }),
    };
  }

  private presentSinItem(
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

  private async rewardForSin(
    sin: { slug: string; oppositeGoodDeedId: string | null },
    quote: Prisma.SinQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
    excludeQuoteIds: ReadonlySet<string> = new Set(),
  ) {
    const paired = isPairedSlug(sin.slug);
    const deeds = await this.prisma.goodDeed.findMany({
      where: {
        origin: visibleOrigins(),
        isHidden: false,
        OR: paired
          ? (sin.oppositeGoodDeedId ? [{ id: sin.oppositeGoodDeedId }] : [])
          : [
              ...(sin.oppositeGoodDeedId ? [{ id: sin.oppositeGoodDeedId }] : []),
              { slug: 'tark-lillah' },
            ],
      },
      select: { id: true },
    });
    if (deeds.length === 0) return { items: [] as ReturnType<SinsService['presentSinItem']>[] };
    const ranked = await this.prisma.goodDeedQuote.findMany({
      where: {
        goodDeedId: { in: deeds.map((deed) => deed.id) },
        reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
        ...autoLinkExclusion(),
        quote,
        ...(excludeQuoteIds.size > 0 ? { quoteId: { notIn: [...excludeQuoteIds] } } : {}),
      },
      select: READING_SELECT,
    });
    const pageRows = dedupeReading(ranked as ReadingRow[]).slice((page - 1) * limit, page * limit);
    if (pageRows.length === 0) return { items: [] as ReturnType<SinsService['presentSinItem']>[] };
    const full = await this.prisma.goodDeedQuote.findMany({
      where: { id: { in: pageRows.map((row) => row.id) } },
      include: { quote: { include: this.quotes.buildQuoteInclude(locale) } },
    });
    const order = new Map(pageRows.map((row, index) => [row.id, index]));
    full.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { items: full.map((row) => this.presentSinItem(row, locale)) };
  }

  private async derivedSinTexts(
    sinId: string,
    quote: Prisma.SinQuoteWhereInput['quote'],
    page: number,
    limit: number,
    locale: 'ar' | 'en',
  ) {
    const links = await this.prisma.topicDerivation.findMany({
      where: { fromSinId: sinId },
      select: {
        toSin: { select: { id: true, slug: true, name: true, nameAr: true, isHidden: true } },
        toGoodDeed: { select: { id: true, slug: true, name: true, nameAr: true } },
      },
    });
    const groups = [];
    for (const link of links) {
      if (link.toSin && !link.toSin.isHidden) {
        const items = await this.pageTopicQuotes('sin', link.toSin.id, quote, page, limit, locale);
        groups.push({ slug: link.toSin.slug, name: link.toSin.name, nameAr: link.toSin.nameAr, side: 'AVOID' as const, items });
      }
      if (link.toGoodDeed) {
        const items = await this.pageTopicQuotes('deed', link.toGoodDeed.id, quote, page, limit, locale);
        groups.push({ slug: link.toGoodDeed.slug, name: link.toGoodDeed.name, nameAr: link.toGoodDeed.nameAr, side: 'DO' as const, items });
      }
    }
    return groups;
  }

  private async pageTopicQuotes(
    side: 'sin' | 'deed',
    id: string,
    quote: Prisma.SinQuoteWhereInput['quote'],
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
    return rows.map((row) => this.presentSinItem(row, locale));
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminCreate(dto: CreateSinDto): Promise<SinDto> {
    await this.assertRankCitation(dto.rank ?? null, dto.rankSourceId ?? null);
    // Will throw P2002 → 409 if slug is duplicate (handled by AllExceptionsFilter)
    const row = await this.prisma.sin.create({
      data: dto,
      include: SIN_READ_INCLUDE,
    });
    return this.toDto(row, { includeSeverity: true });
  }

  async adminList(query: SinsQueryDto) {
    const result = await this.findAll(query, 'admin');
    const rows = await this.prisma.sin.findMany({
      where: { id: { in: result.data.map((sin) => sin.id) } },
      select: { id: true, severity: true },
    });
    const severityById = new Map(rows.map((row) => [row.id, row.severity]));
    return {
      ...result,
      data: result.data.map((sin) => ({
        ...sin,
        severity: severityById.get(sin.id) ?? null,
      })),
    };
  }

  async adminUpdate(id: string, dto: UpdateSinDto): Promise<SinDto> {
    const existing = await this.prisma.sin.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Sin not found' });
    }
    // Clearing the rank clears its citation so the CHECK stays satisfied.
    const rankSourceId =
      dto.rank === null && dto.rankSourceId === undefined ? null : dto.rankSourceId;
    const rankReference =
      dto.rank === null && dto.rankReference === undefined ? null : dto.rankReference;
    const nextRank = dto.rank !== undefined ? dto.rank : existing.rank;
    const nextSourceId = rankSourceId !== undefined ? rankSourceId : existing.rankSourceId;
    await this.assertRankCitation(nextRank, nextSourceId);
    const row = await this.prisma.sin.update({
      where: { id },
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        slug: dto.slug,
        category: dto.category,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        severity: dto.severity,
        rank: dto.rank,
        rankSourceId,
        rankReference,
      },
      include: SIN_READ_INCLUDE,
    });
    return this.toDto(row, { includeSeverity: true });
  }

  /**
   * A rank citation requires a rank. An unknown source is 422.
   * Clearing rank while a source remains violates Sin_rank_source_needs_rank.
   */
  private async assertRankCitation(
    rank: SinRank | null,
    rankSourceId: string | null,
  ): Promise<void> {
    if (rankSourceId && !rank) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'rankSourceId requires rank',
      });
    }
    if (!rankSourceId) return;
    const source = await this.prisma.source.findUnique({ where: { id: rankSourceId } });
    if (!source) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: 'Rank source not found',
      });
    }
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
    if (!isPublicTopic(sin)) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sin not found',
      });
    }
    const where = { oppositeSinId: sin.id, origin: visibleOrigins(), isHidden: false, isListed: true };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodDeed.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: {
          oppositeSin: {
            select: { id: true, slug: true, name: true, nameAr: true },
          },
          _count: {
            select: {
              quotes: { where: publicAcceptedLinkWhere() },
            },
          },
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
