var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPageMeta, paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { compareReading, countsByTypeFromRanked, firstReadingQuoteId, READING_ORDER, READING_SELECT, } from '../classification/reading.js';
import { GradePolicy } from '../hadith/grade-policy.js';
import { mizanIdsFor } from '../practice/heart-texts.js';
import { PUBLISHED_LINK_REVIEW_STATUS, QuotesService, } from '../quotes/quotes.service.js';
const PUBLISHED_QUOTE_COUNT = {
    where: {
        reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
        quote: {
            AND: [
                GradePolicy.whereClause(GradePolicy.resolveAllowedGrades({})),
                GradePolicy.readerClause(),
            ],
        },
    },
};
const BRANCH_LIST_INCLUDE = {
    source: { select: { id: true, name: true, nameAr: true } },
    _count: { select: { quotes: PUBLISHED_QUOTE_COUNT } },
};
let ImanBranchesService = class ImanBranchesService {
    prisma;
    quotes;
    constructor(prisma, quotes) {
        this.prisma = prisma;
        this.quotes = quotes;
    }
    async findAll(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const where = {};
        if (query.q) {
            const arabicIds = await findIdsByNormalizedArabic(this.prisma, '"ImanBranch"', '"titleAr"', query.q);
            where.OR = [
                { title: { contains: query.q, mode: 'insensitive' } },
                ...(arabicIds.length > 0 ? [{ id: { in: arabicIds } }] : []),
            ];
        }
        const orderBy = query.sort === 'quoteCount'
            ? [{ quotes: { _count: 'desc' } }, { number: 'asc' }]
            : [{ number: 'asc' }];
        const [rows, total] = await Promise.all([
            this.prisma.imanBranch.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
                include: BRANCH_LIST_INCLUDE,
            }),
            this.prisma.imanBranch.count({ where }),
        ]);
        return paginated(rows.map((row) => this.toDto(row)), page, limit, total, { locale });
    }
    async findByNumber(number, lang = 'ar') {
        const row = await this.prisma.imanBranch.findUnique({
            where: { number },
            include: {
                ...BRANCH_LIST_INCLUDE,
                explanations: {
                    where: { kind: 'BRANCH_SHARH', languageCode: { in: lang === 'ar' ? ['ar'] : ['ar', lang] } },
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
                },
                goodDeeds: {
                    where: { goodDeed: { origin: 'CURATED' } },
                    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                    include: { goodDeed: { select: { slug: true, name: true, nameAr: true } } },
                },
                sins: {
                    where: { sin: { origin: 'CURATED' } },
                    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                    include: { sin: { select: { slug: true, name: true, nameAr: true, rank: true } } },
                },
            },
        });
        if (!row) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Branch not found',
            });
        }
        const [prev, next, mizan] = await Promise.all([
            this.prisma.imanBranch.findFirst({
                where: { number: { lt: number } },
                orderBy: { number: 'desc' },
                select: { number: true, titleAr: true, title: true },
            }),
            this.prisma.imanBranch.findFirst({
                where: { number: { gt: number } },
                orderBy: { number: 'asc' },
                select: { number: true, titleAr: true, title: true },
            }),
            this.quotes.mizan(mizanIdsFor(number), async (quote) => firstReadingQuoteId(await this.prisma.imanBranchQuote.findMany({
                where: { imanBranchId: row.id, reviewStatus: PUBLISHED_LINK_REVIEW_STATUS, quote },
                select: READING_SELECT,
            })), lang === 'en' ? 'en' : 'ar'),
        ]);
        return {
            data: {
                ...this.toDto(row),
                mizan,
                explanations: row.explanations.map((item) => ({
                    id: item.id,
                    kind: item.kind,
                    languageCode: item.languageCode,
                    text: item.text,
                    reference: item.reference,
                    origin: item.origin,
                    source: item.source,
                })),
                goodDeeds: row.goodDeeds.map((item) => item.goodDeed),
                sins: row.sins.map((item) => item.sin),
                prev,
                next,
            },
        };
    }
    async findQuotesForBranch(number, query) {
        const branch = await this.prisma.imanBranch.findUnique({ where: { number } });
        if (!branch) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Branch not found',
            });
        }
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const locale = query.lang ?? 'ar';
        const { quoteFilter, allowedGrades } = this.quotes.buildLinkQuoteFilter(query);
        const where = {
            imanBranchId: branch.id,
            reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
            ...(query.minScore !== undefined && { relevanceScore: { gte: query.minScore } }),
            quote: quoteFilter,
        };
        const baseWhere = {
            imanBranchId: branch.id,
            reviewStatus: PUBLISHED_LINK_REVIEW_STATUS,
            ...(query.minScore !== undefined && { relevanceScore: { gte: query.minScore } }),
            quote: this.quotes.buildLinkQuoteFilter({
                type: query.type,
                grades: query.grades,
                includeWeak: query.includeWeak,
            }).quoteFilter,
        };
        const countsByKindQ = this.quotes.countsByKind({
            linkTable: 'imanBranchLinks',
            linkWhere: baseWhere,
        });
        if (query.shuffle) {
            const seed = query.seed ?? new Date().toISOString().slice(0, 10);
            const floor = this.quotes.getVarietyScoreFloor();
            const ids = await this.quotes.shuffleLinksPage({
                table: '"ImanBranchQuote"',
                parentKey: '"imanBranchId"',
                parentId: branch.id,
                minScore: query.minScore,
                types: query.type,
                allowedGrades,
                seed,
                floor,
                page,
                limit,
            });
            const [[links, total, typeGroups], countsByKind] = await Promise.all([
                Promise.all([
                    ids.length === 0
                        ? Promise.resolve([])
                        : this.prisma.imanBranchQuote.findMany({ where: { id: { in: ids } } }),
                    this.prisma.imanBranchQuote.count({ where }),
                    this.prisma.quote.groupBy({
                        by: ['type'],
                        where: { imanBranchLinks: { some: where } },
                        _count: { _all: true },
                    }),
                ]),
                countsByKindQ,
            ]);
            const rows = await this.quotes.hydrateLinks(links, locale);
            if (ids.length > 1) {
                const order = new Map(ids.map((id, index) => [id, index]));
                rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
            }
            return this.quotesPage(branch, rows, page, limit, total, locale, allowedGrades, {
                ordering: `variety:md5(seed),floor=${floor}`,
                seed,
                countsByType: this.quotes.countsByTypeFromGroups(typeGroups),
                countsByKind,
            });
        }
        const [ranked, countsByKind] = await Promise.all([
            this.prisma.imanBranchQuote.findMany({ where, select: READING_SELECT }),
            countsByKindQ,
        ]);
        const pageRows = [...ranked].sort(compareReading).slice((page - 1) * limit, page * limit);
        const rows = await this.quotes.hydrateLinks(pageRows, locale);
        return this.quotesPage(branch, rows, page, limit, ranked.length, locale, allowedGrades, {
            ordering: READING_ORDER,
            countsByType: countsByTypeFromRanked(ranked),
            countsByKind,
        });
    }
    async adminCreate(dto) {
        if (dto.sourceId)
            await this.assertSource(dto.sourceId);
        try {
            const row = await this.prisma.imanBranch.create({
                data: dto,
                include: BRANCH_LIST_INCLUDE,
            });
            return this.toDto(row);
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({
                    code: 'CONFLICT',
                    message: 'A branch with this number already exists',
                });
            }
            throw error;
        }
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.imanBranch.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Branch not found' });
        }
        if (dto.sourceId)
            await this.assertSource(dto.sourceId);
        try {
            const row = await this.prisma.imanBranch.update({
                where: { id },
                data: dto,
                include: BRANCH_LIST_INCLUDE,
            });
            return this.toDto(row);
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({
                    code: 'CONFLICT',
                    message: 'A branch with this number already exists',
                });
            }
            throw error;
        }
    }
    async adminDelete(id) {
        const existing = await this.prisma.imanBranch.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Branch not found' });
        }
        await this.prisma.imanBranch.delete({ where: { id } });
    }
    async replacePractices(id, dto) {
        const existing = await this.prisma.imanBranch.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Branch not found' });
        }
        const deedIds = dto.goodDeeds.map((item) => item.goodDeedId);
        const sinIds = dto.sins.map((item) => item.sinId);
        const [deeds, sins] = await Promise.all([
            deedIds.length
                ? this.prisma.goodDeed.findMany({ where: { id: { in: deedIds } }, select: { id: true } })
                : [],
            sinIds.length
                ? this.prisma.sin.findMany({ where: { id: { in: sinIds } }, select: { id: true } })
                : [],
        ]);
        if (deeds.length !== new Set(deedIds).size || sins.length !== new Set(sinIds).size) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'One or more practices were not found',
            });
        }
        await this.prisma.$transaction([
            this.prisma.imanBranchGoodDeed.deleteMany({ where: { imanBranchId: id } }),
            this.prisma.imanBranchSin.deleteMany({ where: { imanBranchId: id } }),
            ...(dto.goodDeeds.length
                ? [this.prisma.imanBranchGoodDeed.createMany({
                        data: dto.goodDeeds.map((item) => ({
                            imanBranchId: id,
                            goodDeedId: item.goodDeedId,
                            sortOrder: item.sortOrder ?? 0,
                            note: item.note,
                        })),
                    })]
                : []),
            ...(dto.sins.length
                ? [this.prisma.imanBranchSin.createMany({
                        data: dto.sins.map((item) => ({
                            imanBranchId: id,
                            sinId: item.sinId,
                            sortOrder: item.sortOrder ?? 0,
                            note: item.note,
                        })),
                    })]
                : []),
        ]);
        return this.findByNumber(existing.number);
    }
    toDto(row) {
        return {
            id: row.id,
            number: row.number,
            titleAr: row.titleAr,
            title: row.title,
            summaryAr: row.summaryAr,
            summary: row.summary,
            quoteCount: row._count.quotes,
            source: row.source,
            sourceReference: row.sourceReference,
        };
    }
    quotesPage(branch, rows, page, limit, total, locale, allowedGrades, extra) {
        return {
            data: {
                branch: {
                    number: branch.number,
                    titleAr: branch.titleAr,
                    title: branch.title,
                    summaryAr: branch.summaryAr,
                },
                items: rows.map((row) => ({
                    link: { id: row.id, relevanceScore: row.relevanceScore, note: row.note },
                    quote: this.quotes.toQuoteDto(row.quote, locale),
                })),
            },
            meta: buildPageMeta(page, limit, total, {
                locale,
                ordering: extra.ordering,
                ...(extra.seed ? { seed: extra.seed } : {}),
                countsByType: extra.countsByType,
                countsByKind: extra.countsByKind,
                appliedGrades: allowedGrades,
            }),
        };
    }
    async assertSource(sourceId) {
        const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
        if (!source) {
            throw new UnprocessableEntityException({
                code: 'RELATED_RESOURCE_INVALID',
                message: 'Source not found',
            });
        }
    }
};
ImanBranchesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService])
], ImanBranchesService);
export { ImanBranchesService };
//# sourceMappingURL=iman-branches.service.js.map