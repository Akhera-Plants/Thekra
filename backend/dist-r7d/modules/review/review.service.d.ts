import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ReviewFlagsQueryDto } from './dto/review-flags-query.dto.js';
export declare class ReviewService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listFlags(query: ReviewFlagsQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<{
        quote: {
            id: string;
            textAr: string;
            grade: import("@prisma/client").$Enums.HadithGrade | null;
            gradeAuthority: string | null;
            gradeReference: string | null;
            gradeSource: import("@prisma/client").$Enums.GradeSource;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            };
        };
    } & {
        id: string;
        updatedAt: Date;
        createdAt: Date;
        quoteId: string;
        note: string | null;
        type: import("@prisma/client").$Enums.FlagType;
        source: import("@prisma/client").$Enums.FlagOrigin;
        details: Prisma.JsonValue | null;
        severity: import("@prisma/client").$Enums.FlagSeverity;
        status: import("@prisma/client").$Enums.FlagStatus;
        resolvedBy: string | null;
        resolvedAt: Date | null;
    }>>;
    getFlag(id: string): Promise<{
        data: {
            quote: {
                id: string;
                textAr: string;
                grade: import("@prisma/client").$Enums.HadithGrade | null;
                gradeAuthority: string | null;
                gradeReference: string | null;
                gradeSource: import("@prisma/client").$Enums.GradeSource;
                legacyGrade: import("@prisma/client").$Enums.HadithGrade | null;
                legacyGradeAuthority: string | null;
                legacyGradeReference: string | null;
                source: {
                    id: string;
                    name: string;
                    nameAr: string | null;
                };
                matches: ({
                    referenceHadith: {
                        number: number;
                        id: string;
                        book: import("@prisma/client").$Enums.ReferenceBook;
                        kitab: string | null;
                        bab: string | null;
                        isnadText: string;
                        matnText: string;
                    };
                } & {
                    id: string;
                    updatedAt: Date;
                    createdAt: Date;
                    quoteId: string;
                    method: string;
                    decision: import("@prisma/client").$Enums.MatchDecision;
                    score: number;
                    referenceHadithId: string;
                })[];
            };
        } & {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            quoteId: string;
            note: string | null;
            type: import("@prisma/client").$Enums.FlagType;
            source: import("@prisma/client").$Enums.FlagOrigin;
            details: Prisma.JsonValue | null;
            severity: import("@prisma/client").$Enums.FlagSeverity;
            status: import("@prisma/client").$Enums.FlagStatus;
            resolvedBy: string | null;
            resolvedAt: Date | null;
        };
    }>;
    confirmMatch(matchId: string, userId: string, note?: string): Promise<{
        data: {
            matchId: string;
            decision: string;
        };
    }>;
    rejectMatch(matchId: string, userId: string, note?: string): Promise<{
        data: {
            matchId: string;
            decision: string;
        };
    }>;
    closeFlag(id: string, userId: string, status: 'RESOLVED' | 'DISMISSED', note?: string): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            quoteId: string;
            note: string | null;
            type: import("@prisma/client").$Enums.FlagType;
            source: import("@prisma/client").$Enums.FlagOrigin;
            details: Prisma.JsonValue | null;
            severity: import("@prisma/client").$Enums.FlagSeverity;
            status: import("@prisma/client").$Enums.FlagStatus;
            resolvedBy: string | null;
            resolvedAt: Date | null;
        };
    }>;
}
