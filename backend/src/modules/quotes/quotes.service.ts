import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QuoteOrigin, QuoteType, HadithGrade } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import {
  mapQuoteToDto,
  quoteDetailIncludeForDto,
  quoteIncludeForDto,
  type QuoteDetailRowForDto,
  type QuoteDto,
  type QuoteRowForDto,
} from '../../common/mappers/quote.mapper.js';
import { findIdsByNormalizedArabic, findIdsByNormalizedArabicOrdered } from '../../common/text/arabic-search.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { AdminQuotesQueryDto } from './dto/admin-quotes-query.dto.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { QuoteDetailQueryDto } from './dto/quote-detail-query.dto.js';
import type { QuotesQueryDto } from './dto/quotes-query.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';

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
export type ShuffleLinkTable = '"SinQuote"' | '"GoodDeedQuote"';
/** Foreign-key column in the link table that references the parent. */
export type ShuffleParentKey = '"sinId"' | '"goodDeedId"';

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
      tags: { include: { tag: true } },
    } as typeof quoteIncludeForDto;
  }

  private buildQuoteDetailInclude(
    locale: 'ar' | 'en',
    includeAllTranslations: boolean,
  ): typeof quoteDetailIncludeForDto {
    return {
      source: true,
      translations: translationsInclude(locale, includeAllTranslations),
      tags: { include: { tag: true } },
      sinLinks: {
        include: {
          sin: { select: { slug: true, name: true, nameAr: true } },
        },
      },
      goodDeedLinks: {
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

  linkOrderBy() {
    return LINK_ORDER_BY;
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
      ${minScoreFilter}
      ${typeFilter}
      ${gradeFilter}
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
          appliedFilters: {
            type: query.type ?? null,
            origin: query.origin ?? null,
            grades: query.grades ?? null,
            tag: query.tag ?? null,
            q: query.q ?? null,
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
        appliedFilters: {
          type: query.type ?? null,
          origin: query.origin ?? null,
          grades: query.grades ?? null,
          tag: query.tag ?? null,
          q: query.q ?? null,
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
      if (row.type === QuoteType.HADITH && row.grade === HadithGrade.MAWDU) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Quote not found',
        });
      }
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
    // MAWDU hadiths are never served publicly — see comment above.
    if (row.type === QuoteType.HADITH && row.grade === HadithGrade.MAWDU) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Quote not found',
      });
    }
    return this.toQuoteDetailResult(row, locale, includeAllTranslations);
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

  async adminCreate(dto: CreateQuoteDto): Promise<QuoteDto> {
    if (dto.origin === QuoteOrigin.API_CACHED) {
      throw new UnprocessableEntityException({
        code: 'ORIGIN_RESERVED_FOR_SYNC',
        message: 'origin=API_CACHED is reserved for the content-sync pipeline',
      });
    }

    // Cross-field validation
    if (dto.type === QuoteType.QURAN_VERSE && dto.surahNumber == null) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'surahNumber is required when type is QURAN_VERSE',
      });
    }
    if (dto.type === QuoteType.HADITH && dto.grade == null) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'grade is required when type is HADITH (use UNGRADED if unknown)',
      });
    }

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
        bookTitle: dto.bookTitle,
        author: dto.author,
        pageOrChapter: dto.pageOrChapter,
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

    // After merging the partial update onto the existing record, enforce business
    // rules that must hold regardless of which fields are in the PATCH body.
    const mergedGrade = dto.grade !== undefined ? dto.grade : existing.grade;
    const mergedSurahNumber = dto.surahNumber !== undefined ? dto.surahNumber : existing.surahNumber;

    if (existing.type === QuoteType.HADITH && mergedGrade === null) {
      throw new UnprocessableEntityException({
        code: 'HADITH_GRADE_REQUIRED',
        message: 'Hadith quotes must retain a non-null grade; provide a valid HadithGrade value.',
      });
    }
    if (existing.type === QuoteType.QURAN_VERSE && mergedSurahNumber === null) {
      throw new UnprocessableEntityException({
        code: 'QURAN_SURAH_REQUIRED',
        message: 'Quran verse quotes must retain a non-null surahNumber.',
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
        bookTitle: dto.bookTitle,
        author: dto.author,
        pageOrChapter: dto.pageOrChapter,
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
    options: { allowedGrades?: HadithGrade[]; precomputedArabicIds?: string[] } = {},
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
      and.push({ sinLinks: { some: { sin: { slug: query.sinSlug } } } });
    }
    if (query.goodDeedSlug) {
      and.push({
        goodDeedLinks: { some: { goodDeed: { slug: query.goodDeedSlug } } },
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
}
