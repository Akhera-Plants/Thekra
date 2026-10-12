import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExplanationKind,
  GradeSource,
  HadithGrade,
  LinkReviewStatus,
  Prisma,
  QuoteOrigin,
  QuoteType,
  TextSource,
} from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import {
  mapQuoteToDto,
  quoteDetailIncludeForDto,
  quoteIncludeForDto,
  sahihaynMatchInclude,
  type QuoteDetailRowForDto,
  type QuoteDto,
  type QuoteRowForDto,
} from '../../common/mappers/quote.mapper.js';
import { findIdsByNormalizedArabic, findIdsByNormalizedArabicOrdered } from '../../common/text/arabic-search.js';
import { parsePrintedReference, utcDayNumber } from '../../common/text/printed-reference.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import type { QuotesQueryDto } from './dto/quotes-query.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { checkQuoteShape } from './dto/valid-quote-shape.decorator.js';

/**
 * Human-readable ordering label echoed in `meta.ordering` for normal (non-shuffle) link pages.
 * Exported so sins/good-deeds services can reuse the same string.
 */
export const LINK_ORDERING_LABEL = 'relevanceScore:desc,grade:asc,createdAt:desc';

/**
 * Reminder feeds and public quote↔intent filters.
 * Suggested links (any other review status) stay hidden until a human accepts them.
 */
export const PUBLISHED_LINK_REVIEW_STATUS = LinkReviewStatus.ACCEPTED;

const LINK_ORDER_BY = [
  { relevanceScore: { sort: 'desc' as const, nulls: 'last' as const } },
  { quote: { grade: 'asc' as const } },
  { quote: { createdAt: 'desc' as const } },
  { id: 'asc' as const },
];

function translationsInclude(
  locale: 'ar' | 'en',
  includeAllTranslations: boolean,
) {
  if (includeAllTranslations) {
    return true as const;
  }
  return locale === 'ar'
    ? ({ take: 0 } as const)
    : ({ where: { languageCode: locale }, take: 1 } as const);
}

/** Link tables that support the variety shuffle query. */
export type ShuffleLinkTable = '"SinQuote"' | '"GoodDeedQuote"' | '"ImanBranchQuote"';
/** Foreign-key column in the link table that references the parent. */
export type ShuffleParentKey = '"sinId"' | '"goodDeedId"' | '"imanBranchId"';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables>,
  ) {}

  /**
   * Locale-filtered include that still projects as `QuoteRowForDto`.
   * The assertion is confined to this builder: call sites stay cast-free.
   */
  buildQuoteInclude(
    locale: 'ar' | 'en',
    options?: { includeAllTranslations?: boolean },
  ): typeof quoteIncludeForDto {
    return {
      source: true,
      translations: translationsInclude(
        locale,
        options?.includeAllTranslations === true,
      ),
      // P3-2: stable tag ordering by slug so responses are deterministic.
      tags: { include: { tag: true }, orderBy: { tag: { slug: 'asc' } } },
      matches: sahihaynMatchInclude,
    } as typeof quoteIncludeForDto;
  }

  private buildQuoteDetailInclude(
    locale: 'ar' | 'en',
    includeAllTranslations: boolean,
  ): typeof quoteDetailIncludeForDto {
    return {
      source: true,
      translations: translationsInclude(locale, includeAllTranslations),
      // P3-2: stable tag ordering by slug so responses are deterministic.
      tags: { include: { tag: true }, orderBy: { tag: { slug: 'asc' } } },
      matches: sahihaynMatchInclude,
      sinLinks: {
        where: { reviewStatus: PUBLISHED_LINK_REVIEW_STATUS },
        include: {
          sin: { select: { slug: true, name: true, nameAr: true } },
        },
      },
      goodDeedLinks: {
        where: { reviewStatus: PUBLISHED_LINK_REVIEW_STATUS },
        include: {
          goodDeed: {
            select: { slug: true, name: true, nameAr: true },
          },
        },
      },
    } as typeof quoteDetailIncludeForDto;
  }

  toQuoteDto(row: QuoteRowForDto, locale: 'ar' | 'en'): QuoteDto {
    return mapQuoteToDto(row, locale);
  }

  /** The same published sahih or hasan text for every reader on one UTC day. */
  async reminderOfTheDay(locale: 'ar' | 'en', now = new Date()) {
    const where: Prisma.QuoteWhereInput = {
      AND: [
        { grade: { in: [HadithGrade.SAHIH, HadithGrade.HASAN] } },
        GradePolicy.readerClause(),
      ],
    };
    const total = await this.prisma.quote.count({ where });
    if (total === 0) return { data: null };
    const row = await this.prisma.quote.findFirst({
      where,
      orderBy: { id: 'asc' },
      skip: utcDayNumber(now) % total,
      include: this.buildQuoteInclude(locale),
    });
    return { data: row ? this.toQuoteDto(row, locale) : null };
  }

  linkOrderBy() {
    return LINK_ORDER_BY;
  }

  /**
   * P2-1: Build the Prisma `quote` sub-filter (type + grade policy) and resolve
   * the allowed grade list from a query that carries `grades`, `includeWeak`,
   * and optionally `type`.  Both sins and good-deeds link pages use the same
   * filter logic — this centralises it so there is one place to change.
   *
   * @returns `{ quoteFilter, allowedGrades }` — splice `quoteFilter` straight
   *   into the link-table `where.quote` and use `allowedGrades` for the shuffle
   *   call and `meta.appliedGrades`.
   */
  buildLinkQuoteFilter(query: {
    type?: QuoteType[];
    grades?: HadithGrade[];
    includeWeak?: boolean;
  }): {
    quoteFilter: Prisma.QuoteWhereInput;
    allowedGrades: HadithGrade[];
  } {
    const allowedGrades = GradePolicy.resolveAllowedGrades({
      grades: query.grades,
      includeWeak: query.includeWeak,
    });
    const quoteFilter: Prisma.QuoteWhereInput = {
      AND: [
        ...(query.type?.length ? [{ type: { in: query.type } }] : []),
        GradePolicy.whereClause(allowedGrades),
        GradePolicy.readerClause(),
      ],
    };
    return { quoteFilter, allowedGrades };
  }

  /**
   * P2-1: Fold a Prisma `groupBy` result into the canonical `countsByType` map
   * (`{ QURAN_VERSE, HADITH, SCHOLAR_QUOTE, BOOK_EXCERPT }`).  Both sins and
   * good-deeds pages compute this after the same `quote.groupBy` sub-query.
   */
  countsByTypeFromGroups(
    groups: Array<{ type: string; _count: { _all: number } }>,
  ): Record<string, number> {
    const result: Record<string, number> = {
      QURAN_VERSE: 0,
      HADITH: 0,
      SCHOLAR_QUOTE: 0,
      BOOK_EXCERPT: 0,
    };
    for (const g of groups) {
      result[g.type] = g._count._all;
    }
    return result;
  }

  /**
   * Returns the configured minimum relevanceScore for the variety shuffle band.
   * Reads `VARIETY_SCORE_FLOOR` from validated env (default 70). See §4.2.
   */
  getVarietyScoreFloor(): number {
    return this.config.get('VARIETY_SCORE_FLOOR') ?? 70;
  }

  /**
   * Variety-mode shuffle (§4.2): returns the IDs of link rows for the requested
   * page, ordered so that:
   *   • Links with `relevanceScore >= floor` come first, sorted by
   *     `md5(link.id || seed)` — deterministic pseudo-random per seed.
   *   • Remaining links follow in normal LINK_ORDER (score DESC, grade ASC,
   *     createdAt DESC, id ASC).
   *
   * The caller must pass pre-validated, closed-union values for `table` and
   * `parentKey` (never raw user input) — they are embedded with Prisma.raw.
   *
   * After calling this, fetch the rows with
   *   `sinQuote.findMany({ where: { id: { in: ids } } })` and re-sort in memory
   * using the returned order so the Prisma include stays type-safe.
   */
  async shuffleLinksPage(opts: {
    table: ShuffleLinkTable;
    parentKey: ShuffleParentKey;
    parentId: string;
    minScore?: number;
    types?: QuoteType[];
    allowedGrades: HadithGrade[];
    seed: string;
    floor: number;
    page: number;
    limit: number;
  }): Promise<string[]> {
    const { table, parentKey, parentId, minScore, types, allowedGrades, seed, floor, page, limit } = opts;
    const offset = (page - 1) * limit;
    const includeUngraded = allowedGrades.includes(HadithGrade.UNGRADED);

    // Conditional WHERE fragments — values are parameterised, table/column via closed-union Prisma.raw
    const minScoreFilter =
      minScore !== undefined
        ? Prisma.sql`AND sq."relevanceScore" >= ${minScore}`
        : Prisma.sql``;

    const typeFilter =
      types && types.length > 0
        ? Prisma.sql`AND q.type::text IN (${Prisma.join(types)})`
        : Prisma.sql``;

    // Grade clause mirrors GradePolicy.whereClause:
    //   non-HADITH rows always pass; HADITH must be in allowedGrades;
    //   if UNGRADED is allowed, also include HADITH rows with null grade.
    const nullGradeClause = includeUngraded ? Prisma.sql`OR q.grade IS NULL` : Prisma.sql``;
    const gradeFilter = Prisma.sql`AND (
      q.type::text != 'HADITH'
      OR q.grade::text IN (${Prisma.join(allowedGrades)})
      ${nullGradeClause}
    )`;
    const textFilter = Prisma.sql`AND (q."textSource"::text <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
      AND (
        q.type::text <> 'HADITH'
        OR q."gradeSource"::text IN ('AUTO_SAHIHAYN', 'MANUAL')
      )
      AND NOT EXISTS (
        SELECT 1 FROM "QuoteFlag" f
        WHERE f."quoteId" = q.id
          AND f.status = 'OPEN'::"FlagStatus"
          AND f.severity = 'HIGH'::"FlagSeverity"
      )`;

    // ORDER BY strategy (see §4.2):
    //   Column 1 — band: high-band (score >= floor) = 0, low-band = 1.
    //   Column 2 — shuffle within high-band via md5(id || seed); NULLs last
    //              (low-band rows have NULL here, but band column already separates them).
    //   Columns 3-5 — normal LINK_ORDER within low-band (NULL in high-band rows
    //              is irrelevant because band column puts them first).
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT   sq.id
      FROM     ${Prisma.raw(table)} sq
      JOIN     "Quote" q ON sq."quoteId" = q.id
      WHERE    sq.${Prisma.raw(parentKey)} = ${parentId}
        AND    sq."reviewStatus" = 'ACCEPTED'::"LinkReviewStatus"
      ${minScoreFilter}
      ${typeFilter}
      ${gradeFilter}
      ${textFilter}
      ORDER BY
        CASE WHEN COALESCE(sq."relevanceScore", -1) >= ${floor} THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(sq."relevanceScore", -1) >= ${floor}
             THEN md5(CAST(sq.id AS text) || CAST(${seed} AS text))
             ELSE NULL END ASC NULLS LAST,
        CASE WHEN COALESCE(sq."relevanceScore", -1) <  ${floor}
             THEN sq."relevanceScore" ELSE NULL END DESC NULLS LAST,
        CASE WHEN COALESCE(sq."relevanceScore", -1) <  ${floor}
             THEN (CASE q.grade::text
                   WHEN 'SAHIH'    THEN 1 WHEN 'HASAN'    THEN 2
                   WHEN 'DAIF'     THEN 3 WHEN 'UNGRADED' THEN 4
                   WHEN 'MAWDU'    THEN 5 ELSE                 6 END)
             ELSE NULL END ASC NULLS LAST,
        CASE WHEN COALESCE(sq."relevanceScore", -1) <  ${floor}
             THEN q."createdAt" ELSE NULL END DESC NULLS LAST,
        sq.id ASC
      LIMIT    ${limit} OFFSET ${offset}
    `);

    return rows.map((r) => r.id);
  }

  async search(query: QuotesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';
    const sort =
      query.sort ?? (query.q ? 'relevance' : 'newest');

    // GradePolicy always gates the public route — MAWDU is never served,
    // DAIF/UNGRADED require explicit opt-in via includeWeak or grades param.
    const allowedGrades = GradePolicy.resolveAllowedGrades({
      grades: query.grades,
      includeWeak: query.includeWeak,
    });

    // P2-10: for sort=relevance with a text query, pre-fetch ordered Arabic IDs
    // (exact-normalised matches ranked 0, partial matches ranked 1) so we can
    // re-use them in buildSearchWhere (avoids a second SQL scan) and sort the
    // final result set with exact matches first.  Phase 5 replaces this with a
    // GIN trigram similarity score; for now we fetch all matching rows and apply
    // pagination in memory — acceptable for Phase 4 dataset sizes.
    let orderedArabicIds: string[] | undefined;
    if (sort === 'relevance' && query.q) {
      orderedArabicIds = await findIdsByNormalizedArabicOrdered(
        this.prisma,
        '"Quote"',
        '"textAr"',
        query.q,
      );
    }

    const where = await this.buildSearchWhere(query, {
      allowedGrades,
      precomputedArabicIds: orderedArabicIds,
      publicText: true,
    });

    if (sort === 'relevance' && orderedArabicIds !== undefined) {
      // Fetch all matching rows without DB-level pagination; sort in memory so
      // exact Arabic matches surface before partial matches, then newest.
      const allRows = await this.prisma.quote.findMany({
        where,
        include: this.buildQuoteInclude(locale),
        orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
      });

      if (orderedArabicIds.length > 0) {
        const idRank = new Map(orderedArabicIds.map((id, i) => [id, i]));
        allRows.sort((a, b) => {
          const ra = idRank.get(a.id) ?? orderedArabicIds!.length;
          const rb = idRank.get(b.id) ?? orderedArabicIds!.length;
          if (ra !== rb) return ra - rb;
          // Same rank: preserve createdAt desc (DB already ordered this way)
          return 0;
        });
      }

      const total = allRows.length;
      const pageRows = allRows.slice((page - 1) * limit, page * limit);

      return paginated(
        pageRows.map((row) => this.toQuoteDto(row, locale)),
        page,
        limit,
        total,
        {
          locale,
          appliedGrades: allowedGrades,
          // P3-1: echo all non-undefined query filters (not just 5).
          appliedFilters: {
            q: query.q ?? null,
            type: query.type ?? null,
            origin: query.origin ?? null,
            grades: query.grades ?? null,
            includeWeak: query.includeWeak ?? null,
            sourceId: query.sourceId ?? null,
            surahNumber: query.surahNumber ?? null,
            ayahNumber: query.ayahNumber ?? null,
            hasTranslation: query.hasTranslation ?? null,
            sinSlug: query.sinSlug ?? null,
            goodDeedSlug: query.goodDeedSlug ?? null,
            tag: query.tag ?? null,
          },
        },
      );
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: this.buildQuoteInclude(locale),
        orderBy:
          sort === 'oldest'
            ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
            : [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toQuoteDto(row, locale)),
      page,
      limit,
      total,
      {
        locale,
        appliedGrades: allowedGrades,
        // P3-1: echo all non-undefined query filters (not just 5).
        appliedFilters: {
          q: query.q ?? null,
          type: query.type ?? null,
          origin: query.origin ?? null,
          grades: query.grades ?? null,
          includeWeak: query.includeWeak ?? null,
          sourceId: query.sourceId ?? null,
          surahNumber: query.surahNumber ?? null,
          ayahNumber: query.ayahNumber ?? null,
          hasTranslation: query.hasTranslation ?? null,
          sinSlug: query.sinSlug ?? null,
          goodDeedSlug: query.goodDeedSlug ?? null,
          tag: query.tag ?? null,
        },
      },
    );
  }

  async findById(id: string, query: QuoteDetailQueryDto) {
    const locale = query.lang ?? 'ar';
    const includeLinks = query.includeLinks !== false;
    const includeAllTranslations = query.includeAllTranslations === true;

    if (includeLinks) {
      const row = await this.prisma.quote.findUnique({
        where: { id },
        include: this.buildQuoteDetailInclude(locale, includeAllTranslations),
      });
      if (!row) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Quote not found',
        });
      }
      // MAWDU (fabricated) hadiths are never served publicly — 404 so the client
      // cannot even confirm the record exists. DAIF and UNGRADED stay reachable
      // because they are valid hadiths that carry an explicit grade badge in the UI.
      await this.assertPublicQuote(row);
      return this.toQuoteDetailResult(row, locale, includeAllTranslations);
    }

    const row = await this.prisma.quote.findUnique({
      where: { id },
      include: this.buildQuoteInclude(locale, { includeAllTranslations }),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Quote not found',
      });
    }
    await this.assertPublicQuote(row);
    return this.toQuoteDetailResult(row, locale, includeAllTranslations);
  }

  /**
   * A missing quote, a fabricated hadith, unverified OCR, a legacy grade,
   * and an open high-severity flag all look the same from the public API.
   */
  private async assertPublicQuote(row: {
    id: string;
    type: QuoteType;
    grade: HadithGrade | null;
    gradeSource: GradeSource;
    textSource: TextSource;
    textVerifiedAt: Date | null;
  }): Promise<void> {
    const hidden = await this.prisma.quoteFlag.count({
      where: { quoteId: row.id, status: 'OPEN', severity: 'HIGH' },
    });
    if (
      (row.type === QuoteType.HADITH && row.grade === HadithGrade.MAWDU)
      || !GradePolicy.isPublicText(row)
      || !GradePolicy.isPublishable(row)
      || hidden > 0
    ) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Quote not found',
      });
    }
  }

  private toQuoteDetailResult(
    row: QuoteRowForDto | QuoteDetailRowForDto,
    locale: 'ar' | 'en',
    includeAllTranslations: boolean,
  ) {
    const dto = this.toQuoteDto(row, locale);
    const result: QuoteDto & {
      translations?: Array<{ id: string; languageCode: string; text: string }>;
      relatedSins?: Array<{
        slug: string;
        name: string;
        nameAr: string;
        relevanceScore: number | null;
      }>;
      relatedGoodDeeds?: Array<{
        slug: string;
        name: string;
        nameAr: string;
        relevanceScore: number | null;
      }>;
    } = { ...dto };

    if (includeAllTranslations) {
      result.translations = row.translations.map((t) => ({
        id: t.id,
        languageCode: t.languageCode,
        text: t.text,
      }));
    }

    if ('sinLinks' in row && 'goodDeedLinks' in row) {
      result.relatedSins = row.sinLinks.map((link) => ({
        slug: link.sin.slug,
        name: link.sin.name,
        nameAr: link.sin.nameAr,
        relevanceScore: link.relevanceScore,
      }));
      result.relatedGoodDeeds = row.goodDeedLinks.map((link) => ({
        slug: link.goodDeed.slug,
        name: link.goodDeed.name,
        nameAr: link.goodDeed.nameAr,
        relevanceScore: link.relevanceScore,
      }));
    }

    return result;
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async adminSearch(query: AdminQuotesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const locale = query.lang ?? 'ar';

    const where = await this.buildAdminSearchWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: this.buildQuoteInclude(locale),
        orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toQuoteDto(row , locale)),
      page,
      limit,
      total,
      { locale },
    );
  }

  /** Proofread mark: the reviewer compared textAr with the PDF page. */
  async markTextVerified(id: string): Promise<QuoteDto> {
    const existing = await this.prisma.quote.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    const row = await this.prisma.quote.update({
      where: { id },
      data: { textVerifiedAt: new Date() },
      include: this.buildQuoteInclude('ar'),
    });
    return this.toQuoteDto(row, 'ar');
  }

  private printedReference(dto: {
    hadithReference?: string;
    referenceNumber?: number;
    referenceLabel?: string;
  }): { referenceNumber?: number | null; referenceLabel?: string | null } {
    if (
      dto.hadithReference === undefined &&
      dto.referenceNumber === undefined &&
      dto.referenceLabel === undefined
    ) {
      return {};
    }
    const parsed = parsePrintedReference(dto.hadithReference);
    return {
      referenceNumber: dto.referenceNumber ?? parsed.referenceNumber,
      referenceLabel: dto.referenceLabel ?? parsed.referenceLabel,
    };
  }

  async adminCreate(dto: CreateQuoteDto): Promise<QuoteDto> {
    if (dto.origin === QuoteOrigin.API_CACHED) {
      throw new UnprocessableEntityException({
        code: 'ORIGIN_RESERVED_FOR_SYNC',
        message: 'origin=API_CACHED is reserved for the content-sync pipeline',
      });
    }

    // Cross-field shape rules (HADITH→grade, QURAN_VERSE→surahNumber) are now
    // enforced by @ValidQuoteShape() on CreateQuoteDto (→ 400 VALIDATION_FAILED).
    // No duplicate checks here.

    // Verify sourceId exists
    const source = await this.prisma.source.findUnique({ where: { id: dto.sourceId } });
    if (!source) {
      throw new UnprocessableEntityException({
        code: 'RELATED_RESOURCE_INVALID',
        message: 'Source not found',
      });
    }

    const row = await this.prisma.quote.create({
      data: {
        type: dto.type,
        origin: dto.origin ?? QuoteOrigin.LOCAL,
        textAr: dto.textAr,
        sourceId: dto.sourceId,
        surahNumber: dto.surahNumber,
        surahName: dto.surahName,
        surahNameAr: dto.surahNameAr,
        ayahNumber: dto.ayahNumber,
        narrator: dto.narrator,
        narratorAr: dto.narratorAr,
        grade: dto.grade,
        hadithReference: dto.hadithReference,
        ...this.printedReference(dto),
        bookTitle: dto.bookTitle,
        author: dto.author,
        pageOrChapter: dto.pageOrChapter,
        volume: dto.volume,
        page: dto.page,
        gradeAuthority: dto.gradeAuthority,
        gradeReference: dto.gradeReference,
        gradeSource: dto.type === QuoteType.HADITH ? GradeSource.MANUAL : undefined,
        translations: dto.translations?.length
          ? { create: dto.translations }
          : undefined,
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: this.buildQuoteInclude('ar'),
    });

    return this.toQuoteDto(row , 'ar');
  }

  async adminUpdate(id: string, dto: UpdateQuoteDto): Promise<QuoteDto> {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }

    // Phase 5: For API_CACHED rows, the provider is the authority on certain fields.
    // Reject curator edits to those fields — the curator must fork the quote instead.
    // See content-pipeline-plan §2 ("Provider text is read-only for curators").
    if (existing.origin === QuoteOrigin.API_CACHED) {
      const PROVIDER_OWNED_FIELDS: (keyof UpdateQuoteDto)[] = [
        'textAr',
        'narrator',
        'narratorAr',
        'grade',
        'hadithReference',
        'referenceNumber',
        'referenceLabel',
        'surahNumber',
        'surahName',
        'surahNameAr',
        'ayahNumber',
        'sourceId',
      ];

      const attempted = PROVIDER_OWNED_FIELDS.filter(
        (field) => dto[field] !== undefined,
      );

      if (attempted.length > 0) {
        throw new UnprocessableEntityException({
          code: 'FIELD_OWNED_BY_PROVIDER',
          message:
            `Cannot edit provider-owned fields on an API_CACHED quote: ${attempted.join(', ')}. ` +
            'Create a new LOCAL quote instead.',
        });
      }
    }

    // After merging the partial update onto the existing record, enforce the same
    // shape rules as @ValidQuoteShape() on CreateQuoteDto.  `type` is immutable
    // so we use the existing row's value; `grade` and `surahNumber` come from
    // the PATCH body (if provided) or fall back to the existing values.
    // P2-4: reuse the pure checkQuoteShape() function → 400 VALIDATION_FAILED.
    const mergedGrade = dto.grade !== undefined ? dto.grade : existing.grade;
    const mergedSurahNumber = dto.surahNumber !== undefined ? dto.surahNumber : existing.surahNumber;

    const shapeError = checkQuoteShape({
      type: existing.type,
      grade: mergedGrade,
      surahNumber: mergedSurahNumber,
    });
    if (shapeError) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: shapeError,
      });
    }

    const row = await this.prisma.quote.update({
      where: { id },
      data: {
        textAr: dto.textAr,
        sourceId: dto.sourceId,
        surahNumber: dto.surahNumber,
        surahName: dto.surahName,
        surahNameAr: dto.surahNameAr,
        ayahNumber: dto.ayahNumber,
        narrator: dto.narrator,
        narratorAr: dto.narratorAr,
        grade: dto.grade,
        hadithReference: dto.hadithReference,
        ...this.printedReference(dto),
        bookTitle: dto.bookTitle,
        author: dto.author,
        pageOrChapter: dto.pageOrChapter,
        volume: dto.volume,
        page: dto.page,
        gradeAuthority: dto.gradeAuthority,
        gradeReference: dto.gradeReference,
        ...(dto.grade !== undefined && existing.type === QuoteType.HADITH
          ? { gradeSource: GradeSource.MANUAL }
          : {}),
      },
      include: this.buildQuoteInclude('ar'),
    });

    return this.toQuoteDto(row , 'ar');
  }

  async adminDelete(id: string): Promise<void> {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    await this.prisma.quote.delete({ where: { id } });
  }

  async upsertTranslation(quoteId: string, languageCode: string, text: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    return this.prisma.translation.upsert({
      where: { quoteId_languageCode: { quoteId, languageCode } },
      create: { quoteId, languageCode, text },
      update: { text },
    });
  }

  async createTranslation(quoteId: string, languageCode: string, text: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    // Will throw P2002 (handled by AllExceptionsFilter → 409) if already exists
    return this.prisma.translation.create({ data: { quoteId, languageCode, text } });
  }

  async deleteTranslation(quoteId: string, languageCode: string): Promise<void> {
    const existing = await this.prisma.translation.findUnique({
      where: { quoteId_languageCode: { quoteId, languageCode } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Translation not found' });
    }
    await this.prisma.translation.delete({
      where: { quoteId_languageCode: { quoteId, languageCode } },
    });
  }

  async setQuoteTags(quoteId: string, tagIds: string[]) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }

    if (tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({ where: { id: { in: tagIds } } });
      // tagIds is de-duplicated by @ArrayUnique() on the DTO; a count mismatch
      // here genuinely means one or more IDs do not exist in the database.
      if (tags.length !== tagIds.length) {
        throw new UnprocessableEntityException({
          code: 'RELATED_RESOURCE_INVALID',
          message: 'One or more tag IDs not found',
        });
      }
    }

    // P2-5: delete + createMany + final read in ONE interactive $transaction so
    // the follow-up read is consistent with the write, and no partial state leaks
    // out if the batch fails mid-way.
    return this.prisma.$transaction(async (tx) => {
      await tx.quoteTag.deleteMany({ where: { quoteId } });
      if (tagIds.length > 0) {
        await tx.quoteTag.createMany({ data: tagIds.map((tagId) => ({ quoteId, tagId })) });
      }
      const updatedTags = await tx.tag.findMany({
        where: { id: { in: tagIds } },
        orderBy: { slug: 'asc' as const },
      });
      return updatedTags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
        nameAr: tag.nameAr,
        category: tag.category,
      }));
    });
  }

  private async buildAdminSearchWhere(query: AdminQuotesQueryDto): Promise<Prisma.QuoteWhereInput> {
    const and: Prisma.QuoteWhereInput[] = [];

    // Admin routes must NOT apply the public grade policy — curators need to see
    // every grade including MAWDU so they can review and correct data.
    const baseWhere = await this.buildSearchWhere(query, { allowedGrades: undefined });
    if (Object.keys(baseWhere).length > 0) {
      and.push(baseWhere);
    }

    if (query.unlinkedOnly) {
      and.push({
        sinLinks: { none: {} },
        goodDeedLinks: { none: {} },
      });
    }

    if (query.missingTranslation) {
      and.push({
        translations: { none: { languageCode: query.missingTranslation } },
      });
    }

    if (query.textSource) {
      and.push({ textSource: query.textSource });
    }
    if (query.unverifiedOnly) {
      and.push({ textSource: TextSource.OCR, textVerifiedAt: null });
    }

    return and.length ? { AND: and } : {};
  }

  /**
   * Build a Prisma where-input from common search query params.
   *
   * @param allowedGrades  When provided (public routes), always restricts HADITH
   *   rows to this list — the grade policy is enforced unconditionally.
   *   Pass `undefined` for admin routes so curators can see every grade (incl. MAWDU).
   * @param precomputedArabicIds  If the caller already fetched Arabic-search IDs
   *   (e.g. with `findIdsByNormalizedArabicOrdered` for relevance sorting), pass
   *   them here to avoid a second DB round-trip. Omit to let this method fetch them.
   */
  private async buildSearchWhere(
    query: QuotesQueryDto,
    options: { allowedGrades?: HadithGrade[]; precomputedArabicIds?: string[]; publicText?: boolean } = {},
  ): Promise<Prisma.QuoteWhereInput> {
    const and: Prisma.QuoteWhereInput[] = [];

    if (query.type?.length) {
      and.push({ type: { in: query.type } });
    }
    if (query.origin) {
      and.push({ origin: query.origin });
    }

    if (options.allowedGrades) {
      and.push(GradePolicy.whereClause(options.allowedGrades));
    } else if (query.grades?.length) {
      and.push(GradePolicy.whereClause(query.grades));
    }
    if (options.publicText) {
      and.push(GradePolicy.readerClause());
    }
    if (query.sourceId) {
      and.push({ sourceId: query.sourceId });
    }
    if (query.surahNumber !== undefined) {
      and.push({ surahNumber: query.surahNumber });
    }
    if (query.ayahNumber !== undefined) {
      and.push({ ayahNumber: query.ayahNumber });
    }
    if (query.hasTranslation) {
      and.push({
        translations: { some: { languageCode: query.hasTranslation } },
      });
    }
    if (query.sinSlug) {
      and.push({
        sinLinks: {
          some: {
            reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
            sin: { slug: query.sinSlug },
          },
        },
      });
    }
    if (query.goodDeedSlug) {
      and.push({
        goodDeedLinks: {
          some: {
            reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
            goodDeed: { slug: query.goodDeedSlug },
          },
        },
      });
    }
    if (query.tag?.length) {
      for (const slug of query.tag) {
        and.push({ tags: { some: { tag: { slug } } } });
      }
    }
    if (query.q) {
      // Arabic field: match via DB-side normalisation (strips tashkeel, folds alef/ya/ta-marbuta)
      // Translation/Latin fields: standard Prisma ILIKE
      const arabicIds =
        options.precomputedArabicIds ??
        (await findIdsByNormalizedArabic(
          this.prisma,
          '"Quote"',
          '"textAr"',
          query.q,
        ));
      const textFilter: Prisma.QuoteWhereInput[] =
        arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : [];
      if ((query.lang ?? 'ar') !== 'ar') {
        textFilter.push({
          translations: {
            some: {
              languageCode: query.lang,
              text: { contains: query.q, mode: 'insensitive' },
            },
          },
        });
      }
      if (textFilter.length > 0) {
        and.push({ OR: textFilter });
      }
    }

    return and.length ? { AND: and } : {};
  }

  /** Public explanations. A fabricated hadith stays 404, same as quote detail. */
  async listPublicExplanations(quoteId: string, lang: 'ar' | 'en' = 'ar') {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        type: true,
        grade: true,
        surahNumber: true,
        ayahNumber: true,
        gradeSource: true,
        textSource: true,
        textVerifiedAt: true,
      },
    });
    if (!quote) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    await this.assertPublicQuote(quote);

    const or: Prisma.ExplanationWhereInput[] = [
      { kind: ExplanationKind.SHARH, quoteId: quote.id },
    ];
    if (quote.type === QuoteType.QURAN_VERSE && quote.surahNumber && quote.ayahNumber) {
      or.push({
        kind: ExplanationKind.TAFSIR,
        ayahKey: `${quote.surahNumber}:${quote.ayahNumber}`,
      });
    }

    const rows = await this.prisma.explanation.findMany({
      where: {
        OR: or,
        languageCode: { in: lang === 'ar' ? ['ar'] : ['ar', lang] },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        source: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            type: true,
            author: true,
            authorAr: true,
          },
        },
      },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        languageCode: row.languageCode,
        text: row.text,
        reference: row.reference,
        origin: row.origin,
        source: row.source,
      })),
    };
  }

  /** Public mistake report. No account and no personal data are stored. */
  async report(quoteId: string, reason: string, note?: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, type: true },
    });
    if (!quote || quote.type !== QuoteType.HADITH) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
    }
    const entry = { reason, note: note?.trim() || null };
    const open = await this.prisma.quoteFlag.findFirst({
      where: { quoteId, type: 'USER_REPORT', source: 'USER', status: 'OPEN' },
    });
    if (!open) {
      await this.prisma.quoteFlag.create({
        data: {
          quoteId,
          type: 'USER_REPORT',
          severity: 'MEDIUM',
          source: 'USER',
          details: { reports: [entry] },
        },
      });
      return { data: { accepted: true } };
    }
    const details = open.details;
    const previous = details && typeof details === 'object' && !Array.isArray(details)
      && Array.isArray((details as { reports?: unknown }).reports)
      ? (details as { reports: unknown[] }).reports
      : [];
    const reports = [...previous, entry];
    await this.prisma.quoteFlag.update({
      where: { id: open.id },
      data: {
        details: { reports } as Prisma.InputJsonValue,
        severity: reports.length >= 3 ? 'HIGH' : 'MEDIUM',
      },
    });
    return { data: { accepted: true } };
  }
}
