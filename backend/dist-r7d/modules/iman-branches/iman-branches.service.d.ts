import { PrismaService } from '../../prisma/prisma.service.js';
import { SinQuotesQueryDto } from '../sins/dto/sin-quotes-query.dto.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { BranchesQueryDto } from './dto/branches-query.dto.js';
import type { CreateImanBranchDto } from './dto/create-iman-branch.dto.js';
import type { ReplaceBranchPracticesDto } from './dto/replace-practices.dto.js';
import type { UpdateImanBranchDto } from './dto/update-iman-branch.dto.js';
export declare class ImanBranchesService {
    private readonly prisma;
    private readonly quotes;
    constructor(prisma: PrismaService, quotes: QuotesService);
    findAll(query: BranchesQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<{
        id: string;
        number: number;
        titleAr: string;
        title: string | null;
        summaryAr: string | null;
        summary: string | null;
        quoteCount: number;
        source: {
            id: string;
            name: string;
            nameAr: string | null;
        } | null;
        sourceReference: string | null;
    }>>;
    findByNumber(number: number, lang?: 'ar' | 'en'): Promise<{
        data: {
            mizan: import("../quotes/quotes.service.js").MizanDto | null;
            explanations: {
                id: string;
                kind: import("@prisma/client").$Enums.ExplanationKind;
                languageCode: string;
                text: string;
                reference: string | null;
                origin: import("@prisma/client").$Enums.QuoteOrigin;
                source: {
                    id: string;
                    name: string;
                    type: import("@prisma/client").$Enums.SourceType;
                    author: string | null;
                    nameAr: string | null;
                    authorAr: string | null;
                };
            }[];
            goodDeeds: {
                name: string;
                slug: string;
                nameAr: string;
            }[];
            sins: {
                name: string;
                slug: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
            }[];
            prev: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            next: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
    findQuotesForBranch(number: number, query: SinQuotesQueryDto): Promise<{
        data: {
            branch: {
                number: number;
                titleAr: string;
                title: string | null;
                summaryAr: string | null;
            };
            items: {
                link: {
                    id: string;
                    relevanceScore: number | null;
                    note: string | null;
                };
                quote: import("../quotes/entities/quote.entity.js").QuoteDto;
            }[];
        };
        meta: import("../../common/dto/paginated-result.js").PageMeta;
    }>;
    adminCreate(dto: CreateImanBranchDto): Promise<{
        id: string;
        number: number;
        titleAr: string;
        title: string | null;
        summaryAr: string | null;
        summary: string | null;
        quoteCount: number;
        source: {
            id: string;
            name: string;
            nameAr: string | null;
        } | null;
        sourceReference: string | null;
    }>;
    adminUpdate(id: string, dto: UpdateImanBranchDto): Promise<{
        id: string;
        number: number;
        titleAr: string;
        title: string | null;
        summaryAr: string | null;
        summary: string | null;
        quoteCount: number;
        source: {
            id: string;
            name: string;
            nameAr: string | null;
        } | null;
        sourceReference: string | null;
    }>;
    adminDelete(id: string): Promise<void>;
    replacePractices(id: string, dto: ReplaceBranchPracticesDto): Promise<{
        data: {
            mizan: import("../quotes/quotes.service.js").MizanDto | null;
            explanations: {
                id: string;
                kind: import("@prisma/client").$Enums.ExplanationKind;
                languageCode: string;
                text: string;
                reference: string | null;
                origin: import("@prisma/client").$Enums.QuoteOrigin;
                source: {
                    id: string;
                    name: string;
                    type: import("@prisma/client").$Enums.SourceType;
                    author: string | null;
                    nameAr: string | null;
                    authorAr: string | null;
                };
            }[];
            goodDeeds: {
                name: string;
                slug: string;
                nameAr: string;
            }[];
            sins: {
                name: string;
                slug: string;
                nameAr: string;
                rank: import("@prisma/client").$Enums.SinRank | null;
            }[];
            prev: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            next: {
                number: number;
                title: string | null;
                titleAr: string;
            } | null;
            id: string;
            number: number;
            titleAr: string;
            title: string | null;
            summaryAr: string | null;
            summary: string | null;
            quoteCount: number;
            source: {
                id: string;
                name: string;
                nameAr: string | null;
            } | null;
            sourceReference: string | null;
        };
    }>;
    private toDto;
    private quotesPage;
    private assertSource;
}
