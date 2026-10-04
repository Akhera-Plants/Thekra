import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, QuoteOrigin, QuoteType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import {
  mapQuoteToDto,
  type QuoteDto,
  type QuoteRowForDto,
} from '../../common/mappers/quote.mapper.js';
import { normalizeArabic } from '../../common/text/arabic-normalizer.js';
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

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  buildQuoteInclude(locale: 'ar' | 'en'): Prisma.QuoteInclude {
    return {
      source: true,
      translations:
        locale === 'ar'
          ? { take: 0 }
          : { where: { languageCode: locale }, take: 1 },
      tags: { include: { tag: true } },
    };
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

    const where = this.buildSearchWhere(query);

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
      rows.map((row) => this.toQuoteDto(row as QuoteRowForDto, locale)),
      page,
      limit,
      total,
      {
        locale,
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

    const row = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        source: true,
        translations: includeAllTranslations
          ? true
          : locale === 'ar'
            ? { take: 0 }
            : { where: { languageCode: locale }, take: 1 },
        tags: { include: { tag: true } },
        ...(includeLinks
          ? {
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
            }
          : {}),
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Quote not found',
      });
    }

    const dto = this.toQuoteDto(row as QuoteRowForDto, locale);
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
        id: (t as { id: string }).id,
        languageCode: t.languageCode,
        text: t.text,
      }));
    }

    if (includeLinks && 'sinLinks' in row) {
      const withLinks = row as typeof row & {
        sinLinks: Array<{
          relevanceScore: number | null;
          sin: { slug: string; name: string; nameAr: string };
        }>;
        goodDeedLinks: Array<{
          relevanceScore: number | null;
          goodDeed: { slug: string; name: string; nameAr: string };
        }>;
      };
      result.relatedSins = withLinks.sinLinks.map((link) => ({
        slug: link.sin.slug,
        name: link.sin.name,
        nameAr: link.sin.nameAr,
        relevanceScore: link.relevanceScore,
      }));
      result.relatedGoodDeeds = withLinks.goodDeedLinks.map((link) => ({
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

    const where = this.buildAdminSearchWhere(query);

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
      rows.map((row) => this.toQuoteDto(row as QuoteRowForDto, locale)),
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

    return this.toQuoteDto(row as QuoteRowForDto, 'ar');
  }

  async adminUpdate(id: string, dto: UpdateQuoteDto): Promise<QuoteDto> {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
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

    return this.toQuoteDto(row as QuoteRowForDto, 'ar');
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

  private buildAdminSearchWhere(query: AdminQuotesQueryDto): Prisma.QuoteWhereInput {
    const and: Prisma.QuoteWhereInput[] = [];

    // Base search filters
    const baseWhere = this.buildSearchWhere(query);
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

  private buildSearchWhere(query: QuotesQueryDto): Prisma.QuoteWhereInput {
    const and: Prisma.QuoteWhereInput[] = [];

    if (query.type?.length) {
      and.push({ type: { in: query.type } });
    }
    if (query.origin) {
      and.push({ origin: query.origin });
    }
    if (query.grades?.length) {
      and.push({
        OR: [
          { type: { not: QuoteType.HADITH } },
          { grade: { in: query.grades } },
        ],
      });
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
      const normalized = normalizeArabic(query.q);
      const textFilter: Prisma.QuoteWhereInput[] = [
        { textAr: { contains: normalized, mode: 'insensitive' } },
      ];
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
      and.push({ OR: textFilter });
    }

    return and.length ? { AND: and } : {};
  }
}
