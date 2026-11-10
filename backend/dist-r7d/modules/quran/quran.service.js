var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Injectable, NotFoundException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuoteType } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
const SURAHS_CACHE_TTL_MS = 60_000;
let QuranService = class QuranService {
    prisma;
    quotes;
    config;
    surahsCache = null;
    constructor(prisma, quotes, config) {
        this.prisma = prisma;
        this.quotes = quotes;
        this.config = config;
    }
    assertSurahNumber(surahNumber) {
        if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
            throw new BadRequestException({
                code: 'INVALID_SURAH_NUMBER',
                message: 'Surah number must be between 1 and 114',
            });
        }
    }
    async listSurahs(_query) {
        const now = Date.now();
        if (this.surahsCache && this.surahsCache.expiresAt > now) {
            return { data: this.surahsCache.data };
        }
        const groups = await this.prisma.quote.groupBy({
            by: ['surahNumber'],
            where: {
                AND: [
                    { type: QuoteType.QURAN_VERSE, surahNumber: { not: null } },
                    GradePolicy.readerClause(),
                ],
            },
            _count: { _all: true },
            orderBy: { surahNumber: 'asc' },
        });
        if (groups.length === 0) {
            this.surahsCache = { expiresAt: now + SURAHS_CACHE_TTL_MS, data: [] };
            return { data: [] };
        }
        const preferredProvider = this.config.get('QURAN_PREFERRED_PROVIDER');
        const nameMap = new Map();
        if (preferredProvider) {
            const preferredRows = await this.prisma.quote.findMany({
                where: {
                    AND: [
                        {
                            type: QuoteType.QURAN_VERSE,
                            surahNumber: { not: null },
                            apiProvider: preferredProvider,
                        },
                        GradePolicy.readerClause(),
                    ],
                },
                select: { surahNumber: true, surahName: true, surahNameAr: true },
                distinct: ['surahNumber'],
                orderBy: { surahNumber: 'asc' },
            });
            for (const row of preferredRows) {
                if (row.surahNumber !== null) {
                    nameMap.set(row.surahNumber, { surahName: row.surahName, surahNameAr: row.surahNameAr });
                }
            }
        }
        const uncovered = groups
            .map((g) => g.surahNumber)
            .filter((n) => !nameMap.has(n));
        if (uncovered.length > 0) {
            const fallbackRows = await this.prisma.quote.findMany({
                where: {
                    AND: [
                        { type: QuoteType.QURAN_VERSE, surahNumber: { in: uncovered } },
                        GradePolicy.readerClause(),
                    ],
                },
                select: { surahNumber: true, surahName: true, surahNameAr: true },
                distinct: ['surahNumber'],
                orderBy: { surahNumber: 'asc' },
            });
            for (const row of fallbackRows) {
                if (row.surahNumber !== null) {
                    nameMap.set(row.surahNumber, { surahName: row.surahName, surahNameAr: row.surahNameAr });
                }
            }
        }
        const data = groups.map((group) => {
            const sn = group.surahNumber;
            const names = nameMap.get(sn);
            return {
                surahNumber: sn,
                surahName: names?.surahName ?? null,
                surahNameAr: names?.surahNameAr ?? null,
                ayahCount: group._count._all,
            };
        });
        this.surahsCache = {
            expiresAt: now + SURAHS_CACHE_TTL_MS,
            data,
        };
        return { data };
    }
    async findAyahsBySurah(surahNumber, query) {
        this.assertSurahNumber(surahNumber);
        if (query.fromAyah !== undefined &&
            query.toAyah !== undefined &&
            query.fromAyah > query.toAyah) {
            throw new BadRequestException({
                code: 'VALIDATION_FAILED',
                message: 'fromAyah must not be greater than toAyah',
            });
        }
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const locale = query.lang ?? 'ar';
        const where = {
            AND: [
                {
                    type: QuoteType.QURAN_VERSE,
                    surahNumber,
                    ...(query.fromAyah !== undefined || query.toAyah !== undefined
                        ? {
                            ayahNumber: {
                                ...(query.fromAyah !== undefined && { gte: query.fromAyah }),
                                ...(query.toAyah !== undefined && { lte: query.toAyah }),
                            },
                        }
                        : {}),
                },
                GradePolicy.readerClause(),
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.quote.findMany({
                where,
                include: this.quotes.buildQuoteInclude(locale),
                orderBy: [{ ayahNumber: 'asc' }, { id: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.quote.count({ where }),
        ]);
        if (total === 0) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'No verses ingested for this surah',
            });
        }
        return paginated(rows.map((row) => this.quotes.toQuoteDto(row, locale)), page, limit, total, { locale, surahNumber });
    }
    async findAyah(surahNumber, ayahNumber, query) {
        this.assertSurahNumber(surahNumber);
        if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
            throw new BadRequestException({
                code: 'INVALID_AYAH_NUMBER',
                message: 'Ayah number must be a positive integer',
            });
        }
        const locale = query.lang ?? 'ar';
        const includeAllTranslations = query.includeAllTranslations === true;
        const preferredProvider = this.config.get('QURAN_PREFERRED_PROVIDER');
        const where = {
            AND: [
                { type: QuoteType.QURAN_VERSE, surahNumber, ayahNumber },
                GradePolicy.readerClause(),
            ],
        };
        const rows = await this.prisma.quote.findMany({
            where,
            include: this.quotes.buildQuoteInclude(locale, {
                includeAllTranslations,
            }),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (rows.length === 0) {
            throw new NotFoundException({
                code: 'RESOURCE_NOT_FOUND',
                message: 'Ayah not found',
            });
        }
        const sorted = preferredProvider
            ? [...rows].sort((a, b) => {
                const aPref = a.apiProvider === preferredProvider ? 0 : 1;
                const bPref = b.apiProvider === preferredProvider ? 0 : 1;
                return aPref - bPref;
            })
            : rows;
        const row = sorted[0];
        const dto = this.quotes.toQuoteDto(row, locale);
        const result = { ...dto };
        if (includeAllTranslations) {
            result.translations = row.translations.map((t) => ({
                id: t.id,
                languageCode: t.languageCode,
                text: t.text,
            }));
        }
        const response = { data: result };
        if (rows.length > 1) {
            response.meta = { duplicateCount: rows.length };
        }
        return response;
    }
};
QuranService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        QuotesService,
        ConfigService])
], QuranService);
export { QuranService };
//# sourceMappingURL=quran.service.js.map