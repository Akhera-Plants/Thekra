var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, NotFoundException, UnprocessableEntityException, } from '@nestjs/common';
import { FlagStatus, GradeSource, HadithGrade, ReferenceBook, } from '@prisma/client';
import { paginated } from '../../common/dto/paginated-result.js';
import { PrismaService } from '../../prisma/prisma.service.js';
const AUTHORITY = {
    BUKHARI: 'رواه البخاري',
    MUSLIM: 'رواه مسلم',
};
function citation(book, number) {
    return book === ReferenceBook.BUKHARI ? `البخاري ${number}` : `مسلم ${number}`;
}
let ReviewService = class ReviewService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listFlags(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where = {
            ...(query.type ? { type: query.type } : {}),
            ...(query.severity ? { severity: query.severity } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.sourceId ? { quote: { sourceId: query.sourceId } } : {}),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.quoteFlag.findMany({
                where,
                orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    quote: {
                        select: {
                            id: true,
                            textAr: true,
                            grade: true,
                            gradeSource: true,
                            gradeAuthority: true,
                            gradeReference: true,
                            source: { select: { id: true, name: true, nameAr: true } },
                        },
                    },
                },
            }),
            this.prisma.quoteFlag.count({ where }),
        ]);
        return paginated(rows, page, limit, total);
    }
    async getFlag(id) {
        const flag = await this.prisma.quoteFlag.findUnique({
            where: { id },
            include: {
                quote: {
                    select: {
                        id: true,
                        textAr: true,
                        grade: true,
                        gradeSource: true,
                        gradeAuthority: true,
                        gradeReference: true,
                        legacyGrade: true,
                        legacyGradeAuthority: true,
                        legacyGradeReference: true,
                        source: { select: { id: true, name: true, nameAr: true } },
                        matches: {
                            orderBy: { score: 'desc' },
                            take: 8,
                            include: {
                                referenceHadith: {
                                    select: { id: true, book: true, number: true, kitab: true, bab: true, matnText: true, isnadText: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!flag) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Flag not found' });
        }
        return { data: flag };
    }
    async confirmMatch(matchId, userId, note) {
        const match = await this.prisma.hadithMatch.findUnique({
            where: { id: matchId },
            include: { referenceHadith: true, quote: true },
        });
        if (!match) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Match not found' });
        }
        const { book, number } = match.referenceHadith;
        await this.prisma.$transaction([
            this.prisma.hadithMatch.update({
                where: { id: match.id },
                data: { decision: 'CONFIRMED' },
            }),
            this.prisma.quote.update({
                where: { id: match.quoteId },
                data: {
                    grade: HadithGrade.SAHIH,
                    gradeSource: GradeSource.MANUAL,
                    gradeAuthority: AUTHORITY[book],
                    gradeReference: citation(book, number),
                    legacyGrade: match.quote.legacyGrade ?? match.quote.grade,
                    legacyGradeAuthority: match.quote.legacyGradeAuthority ?? match.quote.gradeAuthority,
                    legacyGradeReference: match.quote.legacyGradeReference ?? match.quote.gradeReference,
                },
            }),
            this.prisma.quoteFlag.updateMany({
                where: { quoteId: match.quoteId, type: 'WEAK_MATCH', status: FlagStatus.OPEN },
                data: {
                    status: FlagStatus.RESOLVED,
                    resolvedBy: userId,
                    resolvedAt: new Date(),
                    note: note ?? 'تم تأكيد المطابقة',
                },
            }),
        ]);
        return { data: { matchId, decision: 'CONFIRMED' } };
    }
    async rejectMatch(matchId, userId, note) {
        const match = await this.prisma.hadithMatch.findUnique({
            where: { id: matchId },
            include: { referenceHadith: true, quote: true },
        });
        if (!match) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Match not found' });
        }
        const cited = citation(match.referenceHadith.book, match.referenceHadith.number);
        const revert = match.quote.gradeSource === GradeSource.AUTO_SAHIHAYN
            && (match.quote.gradeReference ?? '').includes(cited);
        await this.prisma.$transaction([
            this.prisma.hadithMatch.update({
                where: { id: match.id },
                data: { decision: 'REJECTED' },
            }),
            ...(revert
                ? [this.prisma.quote.update({
                        where: { id: match.quoteId },
                        data: {
                            grade: match.quote.legacyGrade,
                            gradeAuthority: match.quote.legacyGradeAuthority,
                            gradeReference: match.quote.legacyGradeReference,
                            gradeSource: GradeSource.AUTHORITY_LEGACY,
                        },
                    })]
                : []),
            this.prisma.quoteFlag.updateMany({
                where: { quoteId: match.quoteId, type: 'WEAK_MATCH', status: FlagStatus.OPEN },
                data: {
                    status: FlagStatus.DISMISSED,
                    resolvedBy: userId,
                    resolvedAt: new Date(),
                    note: note ?? 'رُفضت المطابقة',
                },
            }),
        ]);
        return { data: { matchId, decision: 'REJECTED' } };
    }
    async closeFlag(id, userId, status, note) {
        const flag = await this.prisma.quoteFlag.findUnique({ where: { id } });
        if (!flag) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Flag not found' });
        }
        if (flag.status !== FlagStatus.OPEN) {
            throw new UnprocessableEntityException({
                code: 'FLAG_ALREADY_CLOSED',
                message: 'Only an open flag can be resolved or dismissed',
            });
        }
        const row = await this.prisma.quoteFlag.update({
            where: { id },
            data: {
                status,
                note: note ?? null,
                resolvedBy: userId,
                resolvedAt: new Date(),
            },
        });
        return { data: row };
    }
};
ReviewService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ReviewService);
export { ReviewService };
//# sourceMappingURL=review.service.js.map