import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { ReviewFlagsQueryDto } from './dto/review-flags-query.dto.js';
import { ReviewNoteDto } from './dto/review-note.dto.js';
import { ReviewService } from './review.service.js';
export declare class ReviewController {
    private readonly review;
    constructor(review: ReviewService);
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
        details: import("@prisma/client/runtime/library").JsonValue | null;
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
            details: import("@prisma/client/runtime/library").JsonValue | null;
            severity: import("@prisma/client").$Enums.FlagSeverity;
            status: import("@prisma/client").$Enums.FlagStatus;
            resolvedBy: string | null;
            resolvedAt: Date | null;
        };
    }>;
    confirmMatch(id: string, dto: ReviewNoteDto, user: JwtPayload): Promise<{
        data: {
            matchId: string;
            decision: string;
        };
    }>;
    rejectMatch(id: string, dto: ReviewNoteDto, user: JwtPayload): Promise<{
        data: {
            matchId: string;
            decision: string;
        };
    }>;
    resolve(id: string, dto: ReviewNoteDto, user: JwtPayload): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            quoteId: string;
            note: string | null;
            type: import("@prisma/client").$Enums.FlagType;
            source: import("@prisma/client").$Enums.FlagOrigin;
            details: import("@prisma/client/runtime/library").JsonValue | null;
            severity: import("@prisma/client").$Enums.FlagSeverity;
            status: import("@prisma/client").$Enums.FlagStatus;
            resolvedBy: string | null;
            resolvedAt: Date | null;
        };
    }>;
    dismiss(id: string, dto: ReviewNoteDto, user: JwtPayload): Promise<{
        data: {
            id: string;
            updatedAt: Date;
            createdAt: Date;
            quoteId: string;
            note: string | null;
            type: import("@prisma/client").$Enums.FlagType;
            source: import("@prisma/client").$Enums.FlagOrigin;
            details: import("@prisma/client/runtime/library").JsonValue | null;
            severity: import("@prisma/client").$Enums.FlagSeverity;
            status: import("@prisma/client").$Enums.FlagStatus;
            resolvedBy: string | null;
            resolvedAt: Date | null;
        };
    }>;
}
