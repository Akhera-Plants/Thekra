var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { QuoteType, SourceType } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { findIdsByNormalizedArabic } from '../../common/text/arabic-search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { GradePolicy } from './grade-policy.js';
let HadithService = class HadithService {
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
        const allowedGrades = GradePolicy.resolveAllowedGrades({
            grades: query.grades,
            includeWeak: query.includeWeak,
        });
        const and = [
            { type: QuoteType.HADITH },
            GradePolicy.whereClause(allowedGrades),
            GradePolicy.readerClause(),
        ];
        if (query.collectionId) {
            and.push({ sourceId: query.collectionId });
        }
        if (query.narrator) {
            const narratorArIds = await findIdsByNormalizedArabic(this.prisma, '"Quote"', '"narratorAr"', query.narrator);
            and.push({
                OR: [
                    { narrator: { contains: query.narrator, mode: 'insensitive' } },
                    ...(narratorArIds.length > 0 ? [{ id: { in: narratorArIds } }] : []),
                ],
            });
        }
        if (query.reference) {
            const asNumber = Number(query.reference);
            and.push({
                OR: [
                    { hadithReference: { contains: query.reference, mode: 'insensitive' } },
                    { referenceLabel: { contains: query.reference, mode: 'insensitive' } },
                    ...(Number.isInteger(asNumber) ? [{ referenceNumber: asNumber }] : []),
                ],
            });
        }
        if (query.q) {
            const textArIds = await findIdsByNormalizedArabic(this.prisma, '"Quote"', '"textAr"', query.q);
            const textFilter = textArIds.length > 0 ? [{ id: { in: textArIds } }] : [];
            if (locale !== 'ar') {
                textFilter.push({
                    translations: {
                        some: {
                            languageCode: locale,
                            text: { contains: query.q, mode: 'insensitive' },
                        },
                    },
                });
            }
            if (textFilter.length > 0) {
                and.push({ OR: textFilter });
            }
        }
        const where = { AND: and };
        const [rows, total] = await Promise.all([
            this.prisma.quote.findMany({
                where,
                include: this.quotes.buildQuoteInclude(locale),
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.quote.count({ where }),
        ]);
        return paginated(rows.map((row) => this.quotes.toQuoteDto(row, locale)), page, limit, total, {
            locale,
            appliedGrades: allowedGrades,
            appliedFilters: {
                collectionId: query.collectionId ?? null,
                narrator: query.narrator ?? null,
                q: query.q ?? null,
                reference: query.reference ?? null,
            },
        });
    }
    async listCollections(_query) {
        const rows = await this.prisma.source.findMany({
            where: { type: SourceType.HADITH_COLLECTION },
            orderBy: { name: 'asc' },
            include: { _count: { select: { quotes: { where: GradePolicy.readerClause() } } } },
        });
        const data = rows.map((row) => ({
            id: row.id,
            name: row.name,
            nameAr: row.nameAr,
            author: row.author,
            authorAr: row.authorAr,
            isExternalApi: row.isExternalApi,
            apiProvider: row.apiProvider,
            quoteCount: row._count.quotes,
            lastSyncedAt: row.lastSyncedAt,
        }));
        return { data };
    }
};
HadithService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService])
], HadithService);
export { HadithService };
//# sourceMappingURL=hadith.service.js.map