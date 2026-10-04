import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
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

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const where = await this.buildSearchWhere(query, { allowedGrades });

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: this.buildQuoteInclude(locale),
        orderBy:
          sort === 'oldest'
            ? { createdAt: 'asc' }
            : { createdAt: 'desc' },
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
        orderBy: { createdAt: 'desc' },
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
      if (tags.length !== tagIds.length) {
        throw new UnprocessableEntityException({
          code: 'RELATED_RESOURCE_INVALID',
          message: 'One or more tag IDs not found',
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.quoteTag.deleteMany({ where: { quoteId } }),
      ...tagIds.map((tagId) => this.prisma.quoteTag.create({ data: { quoteId, tagId } })),
    ]);

    const updatedTags = await this.prisma.tag.findMany({ where: { id: { in: tagIds } } });
    return updatedTags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      nameAr: tag.nameAr,
      category: tag.category,
    }));
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
   */
  private async buildSearchWhere(
    query: QuotesQueryDto,
    options: { allowedGrades?: HadithGrade[] } = {},
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
      const arabicIds = await findIdsByNormalizedArabic(
        this.prisma,
        '"Quote"',
        '"textAr"',
        query.q,
      );
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
