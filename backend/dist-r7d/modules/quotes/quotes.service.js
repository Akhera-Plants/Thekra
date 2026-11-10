var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExplanationKind, FlagStatus, GradeSource, HadithGrade, LinkReviewStatus, Prisma, QuoteOrigin, QuoteType, TextSource, } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { mapQuoteToDto, sahihaynMatchInclude, } from '../../common/mappers/quote.mapper.js';
import { findIdsByNormalizedArabic, findIdsByNormalizedArabicOrdered } from '../../common/text/arabic-search.js';
import { parsePrintedReference, utcDayNumber } from '../../common/text/printed-reference.js';
import { unfeaturableTextIds } from './text-review.js';
import { autoLinkExclusion } from '../classification/public-taxonomy.js';
import { ATHAR_PUBLIC_ENABLED, GradePolicy, PUBLISHABLE_GRADE_SOURCES } from '../hadith/grade-policy.js';
import { hiddenQuoteIds } from '../hadith/hidden-quotes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { checkQuoteShape } from './dto/valid-quote-shape.decorator.js';
export const PUBLISHED_LINK_REVIEW_STATUS = LinkReviewStatus.ACCEPTED;
function translationsInclude(locale, includeAllTranslations) {
    if (includeAllTranslations) {
        return true;
    }
    return locale === 'ar'
        ? { take: 0 }
        : { where: { languageCode: locale }, take: 1 };
}
let QuotesService = class QuotesService {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    buildQuoteInclude(locale, options) {
        return {
            source: true,
            translations: translationsInclude(locale, options?.includeAllTranslations === true),
            tags: { include: { tag: true }, orderBy: { tag: { slug: 'asc' } } },
            matches: sahihaynMatchInclude,
        };
    }
    buildQuoteDetailInclude(locale, includeAllTranslations) {
        return {
            source: true,
            translations: translationsInclude(locale, includeAllTranslations),
            tags: { include: { tag: true }, orderBy: { tag: { slug: 'asc' } } },
            matches: sahihaynMatchInclude,
            sinLinks: {
                where: {
                    reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
                    sin: { origin: 'CURATED' },
                    ...autoLinkExclusion(),
                },
                include: {
                    sin: { select: { slug: true, name: true, nameAr: true } },
                },
            },
            goodDeedLinks: {
                where: {
                    reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
                    goodDeed: { origin: 'CURATED' },
                    ...autoLinkExclusion(),
                },
                include: {
                    goodDeed: {
                        select: { slug: true, name: true, nameAr: true },
                    },
                },
            },
        };
    }
    async hydrateLinks(links, locale) {
        if (links.length === 0)
            return [];
        const ids = [...new Set(links.map((link) => link.quoteId))];
        const [quoteRows, sources, translations, quoteTags, matchRows] = await Promise.all([
            this.prisma.quote.findMany({ where: { id: { in: ids } } }),
            this.prisma.source.findMany({ where: { quotes: { some: { id: { in: ids } } } } }),
            locale === 'ar'
                ? Promise.resolve([])
                : this.prisma.translation.findMany({ where: { quoteId: { in: ids }, languageCode: locale } }),
            this.prisma.quoteTag.findMany({
                where: { quoteId: { in: ids } },
                include: { tag: true },
                orderBy: { tag: { slug: 'asc' } },
            }),
            this.prisma.hadithMatch.findMany({
                where: { quoteId: { in: ids }, ...sahihaynMatchInclude.where },
                orderBy: sahihaynMatchInclude.orderBy,
                include: sahihaynMatchInclude.include,
            }),
        ]);
        const sourceById = new Map(sources.map((source) => [source.id, source]));
        const translationOf = new Map();
        for (const row of translations)
            translationOf.set(row.quoteId, [...(translationOf.get(row.quoteId) ?? []), row]);
        const tagsOf = new Map();
        for (const row of quoteTags)
            tagsOf.set(row.quoteId, [...(tagsOf.get(row.quoteId) ?? []), row]);
        const matchOf = new Map();
        for (const row of matchRows) {
            if (!matchOf.has(row.quoteId))
                matchOf.set(row.quoteId, [row]);
        }
        const quoteById = new Map();
        for (const quote of quoteRows) {
            quoteById.set(quote.id, {
                ...quote,
                source: sourceById.get(quote.sourceId),
                translations: (translationOf.get(quote.id) ?? []),
                tags: (tagsOf.get(quote.id) ?? []),
                matches: (matchOf.get(quote.id) ?? []),
            });
        }
        return links.flatMap((link) => {
            const quote = quoteById.get(link.quoteId);
            if (!quote)
                return [];
            const { quote: _partial, ...rest } = link;
            return [{ ...rest, quote }];
        });
    }
    toQuoteDto(row, locale) {
        return mapQuoteToDto(row, locale);
    }
    async reminderOfTheDay(locale, now = new Date()) {
        const accepted = { some: { reviewStatus: LinkReviewStatus.ACCEPTED } };
        const where = {
            AND: [
                { grade: { in: [HadithGrade.SAHIH, HadithGrade.HASAN] } },
                GradePolicy.readerClause(),
                { OR: [{ sinLinks: accepted }, { goodDeedLinks: accepted }, { imanBranchLinks: accepted }] },
                { flags: { none: { status: FlagStatus.OPEN } } },
                { id: { notIn: [...unfeaturableTextIds()] } },
            ],
        };
        const total = await this.prisma.quote.count({ where });
        if (total === 0)
            return { data: null };
        const row = await this.prisma.quote.findFirst({
            where,
            orderBy: { id: 'asc' },
            skip: utcDayNumber(now) % total,
            include: this.buildQuoteInclude(locale),
        });
        return { data: row ? this.toQuoteDto(row, locale) : null };
    }
    async findPublishedByIds(ids, locale) {
        if (ids.length === 0)
            return [];
        const rows = await this.prisma.quote.findMany({
            where: {
                AND: [
                    { id: { in: [...ids] } },
                    GradePolicy.whereClause(GradePolicy.defaultAllowedGrades()),
                    GradePolicy.readerClause(),
                ],
            },
            include: this.buildQuoteInclude(locale),
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return ids.flatMap((id) => {
            const row = byId.get(id);
            return row ? [this.toQuoteDto(row, locale)] : [];
        });
    }
    async mizan(curatedIds, topQuoteId, locale) {
        if (curatedIds.length > 0) {
            const items = await this.findPublishedByIds(curatedIds, locale);
            if (items.length > 0)
                return { source: 'curated', items };
        }
        const id = await topQuoteId(this.buildLinkQuoteFilter({}).quoteFilter);
        if (!id)
            return null;
        const items = await this.findPublishedByIds([id], locale);
        return items.length > 0 ? { source: 'top', items } : null;
    }
    buildLinkQuoteFilter(query) {
        const allowedGrades = GradePolicy.resolveAllowedGrades({
            grades: query.grades,
            includeWeak: query.includeWeak,
        });
        const quoteFilter = {
            AND: [
                ...(query.type?.length ? [{ type: { in: query.type } }] : []),
                GradePolicy.whereClause(allowedGrades),
                GradePolicy.readerClause(),
                ...(query.kind ? [this.buildKindFilter(query.kind)] : []),
            ],
        };
        return { quoteFilter, allowedGrades };
    }
    buildKindFilter(kind) {
        if (kind === 'verse')
            return { type: QuoteType.QURAN_VERSE };
        if (kind === 'hadith') {
            return { type: QuoteType.HADITH, isAthar: false };
        }
        return {
            type: QuoteType.HADITH,
            isAthar: true,
            atharReviewDecision: 'KEEP',
        };
    }
    async countsByKind(opts) {
        const base = { [opts.linkTable]: { some: opts.linkWhere } };
        const groups = await this.prisma.quote.groupBy({
            by: ['type', 'isAthar', 'atharReviewDecision'],
            where: { ...base, type: { in: [QuoteType.QURAN_VERSE, QuoteType.HADITH] } },
            _count: { _all: true },
        });
        let verseCount = 0;
        let hadithCount = 0;
        let atharCount = 0;
        for (const group of groups) {
            const n = group._count._all;
            if (group.type === QuoteType.QURAN_VERSE)
                verseCount += n;
            else if (!group.isAthar)
                hadithCount += n;
            else if (group.atharReviewDecision === 'KEEP')
                atharCount += n;
        }
        const all = verseCount + hadithCount + atharCount;
        return { all, verse: verseCount, hadith: hadithCount, athar: atharCount };
    }
    countsByTypeFromGroups(groups) {
        const result = {
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
    getVarietyScoreFloor() {
        return this.config.get('VARIETY_SCORE_FLOOR') ?? 70;
    }
    async shuffleLinksPage(opts) {
        const { table, parentKey, parentId, minScore, types, allowedGrades, seed, floor, page, limit } = opts;
        const offset = (page - 1) * limit;
        const includeUngraded = allowedGrades.includes(HadithGrade.UNGRADED);
        const minScoreFilter = minScore !== undefined
            ? Prisma.sql `AND sq."relevanceScore" >= ${minScore}`
            : Prisma.sql ``;
        const typeFilter = types && types.length > 0
            ? Prisma.sql `AND q.type::text IN (${Prisma.join(types)})`
            : Prisma.sql ``;
        const nullGradeClause = includeUngraded ? Prisma.sql `OR q.grade IS NULL` : Prisma.sql ``;
        const gradeFilter = Prisma.sql `AND (
      q.type::text != 'HADITH'
      OR q.grade::text IN (${Prisma.join(allowedGrades)})
      ${nullGradeClause}
    )`;
        const atharClause = ATHAR_PUBLIC_ENABLED
            ? Prisma.sql `OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision"::text = 'KEEP')`
            : Prisma.sql ``;
        const hidden = hiddenQuoteIds();
        const hiddenFilter = hidden.length > 0
            ? Prisma.sql `AND q.id NOT IN (${Prisma.join([...hidden])})`
            : Prisma.sql ``;
        const textFilter = Prisma.sql `AND (q."textSource"::text <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
      AND (
        (NOT q."isAthar" AND (
          q.type::text <> 'HADITH'
          OR q."gradeSource"::text IN (${Prisma.join(PUBLISHABLE_GRADE_SOURCES)})
        ))
        ${atharClause}
      )
      AND NOT EXISTS (
        SELECT 1 FROM "QuoteFlag" f
        WHERE f."quoteId" = q.id
          AND f.status = 'OPEN'::"FlagStatus"
          AND f.severity = 'HIGH'::"FlagSeverity"
      )`;
        const rows = await this.prisma.$queryRaw(Prisma.sql `
      SELECT   sq.id
      FROM     ${Prisma.raw(table)} sq
      JOIN     "Quote" q ON sq."quoteId" = q.id
      WHERE    sq.${Prisma.raw(parentKey)} = ${parentId}
        AND    sq."reviewStatus" = 'ACCEPTED'::"LinkReviewStatus"
        AND    NOT (
          sq.note LIKE 'باب %'
          OR (sq.note LIKE '%تفسير السعدي%' AND COALESCE(sq."relevanceScore", 0) = 0)
        )
      ${minScoreFilter}
      ${typeFilter}
      ${gradeFilter}
      ${textFilter}
      ${hiddenFilter}
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
    async search(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const sort = query.sort ?? (query.q ? 'relevance' : 'newest');
        const allowedGrades = GradePolicy.resolveAllowedGrades({
            grades: query.grades,
            includeWeak: query.includeWeak,
        });
        let orderedArabicIds;
        if (sort === 'relevance' && query.q) {
            orderedArabicIds = await findIdsByNormalizedArabicOrdered(this.prisma, '"Quote"', '"textAr"', query.q);
        }
        const where = await this.buildSearchWhere(query, {
            allowedGrades,
            precomputedArabicIds: orderedArabicIds,
            publicText: true,
        });
        if (sort === 'relevance' && orderedArabicIds !== undefined) {
            const allRows = await this.prisma.quote.findMany({
                where,
                include: this.buildQuoteInclude(locale),
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            });
            if (orderedArabicIds.length > 0) {
                const idRank = new Map(orderedArabicIds.map((id, i) => [id, i]));
                allRows.sort((a, b) => {
                    const ra = idRank.get(a.id) ?? orderedArabicIds.length;
                    const rb = idRank.get(b.id) ?? orderedArabicIds.length;
                    if (ra !== rb)
                        return ra - rb;
                    return 0;
                });
            }
            const total = allRows.length;
            const pageRows = allRows.slice((page - 1) * limit, page * limit);
            return paginated(pageRows.map((row) => this.toQuoteDto(row, locale)), page, limit, total, {
                locale,
                appliedGrades: allowedGrades,
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
            });
        }
        const [rows, total] = await Promise.all([
            this.prisma.quote.findMany({
                where,
                include: this.buildQuoteInclude(locale),
                orderBy: sort === 'oldest'
                    ? [{ createdAt: 'asc' }, { id: 'asc' }]
                    : [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.quote.count({ where }),
        ]);
        return paginated(rows.map((row) => this.toQuoteDto(row, locale)), page, limit, total, {
            locale,
            appliedGrades: allowedGrades,
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
        });
    }
    async findById(id, query) {
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
    async assertPublicQuote(row) {
        const hidden = await this.prisma.quoteFlag.count({
            where: { quoteId: row.id, status: 'OPEN', severity: 'HIGH' },
        });
        this.assertPublicRow(row, hidden);
    }
    assertPublicRow(row, hidden) {
        if ((row.type === QuoteType.HADITH && row.grade === HadithGrade.MAWDU)
            || !GradePolicy.isPublicText(row)
            || !GradePolicy.isPublishable(row)
            || (row.apiProvider === 'book-structure' && row.type === QuoteType.BOOK_EXCERPT)
            || hidden > 0) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Quote not found',
            });
        }
    }
    toQuoteDetailResult(row, locale, includeAllTranslations) {
        const dto = this.toQuoteDto(row, locale);
        const result = { ...dto };
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
    async adminSearch(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const where = await this.buildAdminSearchWhere(query);
        const [rows, total] = await Promise.all([
            this.prisma.quote.findMany({
                where,
                include: this.buildQuoteInclude(locale),
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.quote.count({ where }),
        ]);
        return paginated(rows.map((row) => this.toQuoteDto(row, locale)), page, limit, total, { locale });
    }
    async markTextVerified(id) {
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
    printedReference(dto) {
        if (dto.hadithReference === undefined &&
            dto.referenceNumber === undefined &&
            dto.referenceLabel === undefined) {
            return {};
        }
        const parsed = parsePrintedReference(dto.hadithReference);
        return {
            referenceNumber: dto.referenceNumber ?? parsed.referenceNumber,
            referenceLabel: dto.referenceLabel ?? parsed.referenceLabel,
        };
    }
    async adminCreate(dto) {
        if (dto.origin === QuoteOrigin.API_CACHED) {
            throw new UnprocessableEntityException({
                code: 'ORIGIN_RESERVED_FOR_SYNC',
                message: 'origin=API_CACHED is reserved for the content-sync pipeline',
            });
        }
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
        return this.toQuoteDto(row, 'ar');
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.quote.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
        }
        if (existing.origin === QuoteOrigin.API_CACHED) {
            const PROVIDER_OWNED_FIELDS = [
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
            const attempted = PROVIDER_OWNED_FIELDS.filter((field) => dto[field] !== undefined);
            if (attempted.length > 0) {
                throw new UnprocessableEntityException({
                    code: 'FIELD_OWNED_BY_PROVIDER',
                    message: `Cannot edit provider-owned fields on an API_CACHED quote: ${attempted.join(', ')}. ` +
                        'Create a new LOCAL quote instead.',
                });
            }
        }
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
        return this.toQuoteDto(row, 'ar');
    }
    async adminDelete(id) {
        const existing = await this.prisma.quote.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
        }
        await this.prisma.quote.delete({ where: { id } });
    }
    async upsertTranslation(quoteId, languageCode, text) {
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
    async createTranslation(quoteId, languageCode, text) {
        const quote = await this.prisma.quote.findUnique({ where: { id: quoteId } });
        if (!quote) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
        }
        return this.prisma.translation.create({ data: { quoteId, languageCode, text } });
    }
    async deleteTranslation(quoteId, languageCode) {
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
    async setQuoteTags(quoteId, tagIds) {
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
        return this.prisma.$transaction(async (tx) => {
            await tx.quoteTag.deleteMany({ where: { quoteId } });
            if (tagIds.length > 0) {
                await tx.quoteTag.createMany({ data: tagIds.map((tagId) => ({ quoteId, tagId })) });
            }
            const updatedTags = await tx.tag.findMany({
                where: { id: { in: tagIds } },
                orderBy: { slug: 'asc' },
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
    async buildAdminSearchWhere(query) {
        const and = [];
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
    async buildSearchWhere(query, options = {}) {
        const and = [];
        if (query.type?.length) {
            and.push({ type: { in: query.type } });
        }
        if (query.origin) {
            and.push({ origin: query.origin });
        }
        if (options.allowedGrades) {
            and.push(GradePolicy.whereClause(options.allowedGrades));
        }
        else if (query.grades?.length) {
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
                        sin: { slug: query.sinSlug, origin: 'CURATED' },
                        ...autoLinkExclusion(),
                    },
                },
            });
        }
        if (query.goodDeedSlug) {
            and.push({
                goodDeedLinks: {
                    some: {
                        reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
                        goodDeed: { slug: query.goodDeedSlug, origin: 'CURATED' },
                        ...autoLinkExclusion(),
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
            const arabicIds = options.precomputedArabicIds ??
                (await findIdsByNormalizedArabic(this.prisma, '"Quote"', '"textAr"', query.q));
            const textFilter = arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : [];
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
    async listPublicExplanations(quoteId, lang = 'ar') {
        const { rows } = await this.publicExplanationRows(quoteId, lang);
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
    async publicExplanationRows(quoteId, lang = 'ar') {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                type: true,
                grade: true,
                surahNumber: true,
                ayahNumber: true,
                gradeSource: true,
                isAthar: true,
                atharSpeakerKey: true,
                atharReviewDecision: true,
                textSource: true,
                textVerifiedAt: true,
                apiProvider: true,
            },
        });
        if (!quote) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Quote not found' });
        }
        this.assertPublicRow(quote, 0);
        const or = [
            { kind: ExplanationKind.SHARH, quoteId: quote.id },
            { kind: ExplanationKind.FAWAID, quoteId: quote.id },
            { kind: ExplanationKind.GHARIB, quoteId: quote.id },
            { kind: ExplanationKind.SHARH_LONG, quoteId: quote.id },
        ];
        if (quote.type === QuoteType.QURAN_VERSE && quote.surahNumber && quote.ayahNumber) {
            const key = `${quote.surahNumber}:${quote.ayahNumber}`;
            or.push({ kind: ExplanationKind.TAFSIR, ayahKey: key });
            or.push({
                kind: ExplanationKind.TAFSIR,
                AND: [
                    { ayahKey: { startsWith: `${quote.surahNumber}:` } },
                    { ayahKey: { contains: '-' } },
                ],
            });
        }
        const [hiddenFlags, rows] = await Promise.all([
            this.prisma.quoteFlag.count({ where: { quoteId: quote.id, status: 'OPEN', severity: 'HIGH' } }),
            this.prisma.explanation.findMany({
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
            }),
        ]);
        this.assertPublicRow(quote, hiddenFlags);
        const surah = quote.surahNumber;
        const ayah = quote.ayahNumber;
        const covering = rows.filter((row) => {
            if (row.kind !== ExplanationKind.TAFSIR || !row.ayahKey || surah == null || ayah == null)
                return row.kind !== ExplanationKind.TAFSIR;
            const match = /^(\d+):(\d+)(?:-(\d+))?$/.exec(row.ayahKey);
            if (!match)
                return false;
            const start = Number(match[2]);
            const end = match[3] ? Number(match[3]) : start;
            return Number(match[1]) === surah && ayah >= start && ayah <= end;
        });
        return { quote: { id: quote.id, type: quote.type }, rows: covering };
    }
};
QuotesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        ConfigService])
], QuotesService);
export { QuotesService };
//# sourceMappingURL=quotes.service.js.map