import { LinkConcern, LinkReviewStatus, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { BulkLinkGoodDeedQuotesDto } from './dto/bulk-link-good-deed-quotes.dto.js';
import type { BulkLinkSinQuotesDto } from './dto/bulk-link-sin-quotes.dto.js';
import type { GoodDeedQuotesAdminQueryDto } from './dto/good-deed-quotes-admin-query.dto.js';
import type { LinkConcernsQueryDto, LinkKind } from './dto/link-concerns-query.dto.js';
import type { LinkGoodDeedQuoteDto } from './dto/link-good-deed-quote.dto.js';
import type { LinkSinQuoteDto } from './dto/link-sin-quote.dto.js';
import type { SinQuotesAdminQueryDto } from './dto/sin-quotes-admin-query.dto.js';
import type { UpdateGoodDeedLinkDto } from './dto/update-good-deed-link.dto.js';
import type { UpdateSinLinkDto } from './dto/update-sin-link.dto.js';
import type { GoodDeedLinkDto } from './entities/good-deed-link.entity.js';
import type { SinLinkDto } from './entities/sin-link.entity.js';
type LinkUpdate = {
    relevanceScore?: number;
    note?: string | null;
    reviewStatus?: LinkReviewStatus;
    reminderAngle?: string | null;
    reminderAngleEn?: string | null;
    concern?: LinkConcern | null;
    concernNote?: string | null;
};
export interface LinkConcernDto {
    kind: LinkKind;
    linkId: string;
    concern: LinkConcern;
    concernNote: string | null;
    concernAt: string | null;
    reviewStatus: LinkReviewStatus;
    topic: {
        slug: string;
        nameAr: string;
    };
    quote: {
        id: string;
        type: QuoteType;
        excerpt: string;
    };
}
export interface BulkResult {
    data: {
        created: number;
        updated: number;
        skipped: number;
        failed: Array<{
            quoteId: string;
            reason: string;
        }>;
    };
}
export declare class ClassificationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    linkSinQuote(dto: LinkSinQuoteDto): Promise<{
        created: boolean;
        link: SinLinkDto;
    }>;
    listSinQuotes(query: SinQuotesAdminQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<SinLinkDto>>;
    updateSinLink(id: string, dto: UpdateSinLinkDto): Promise<SinLinkDto>;
    unlinkSinQuote(id: string): Promise<void>;
    bulkLinkSinQuotes(dto: BulkLinkSinQuotesDto): Promise<BulkResult>;
    linkGoodDeedQuote(dto: LinkGoodDeedQuoteDto): Promise<{
        created: boolean;
        link: GoodDeedLinkDto;
    }>;
    listGoodDeedQuotes(query: GoodDeedQuotesAdminQueryDto): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<GoodDeedLinkDto>>;
    updateGoodDeedLink(id: string, dto: UpdateGoodDeedLinkDto): Promise<GoodDeedLinkDto>;
    unlinkGoodDeedQuote(id: string): Promise<void>;
    bulkLinkGoodDeedQuotes(dto: BulkLinkGoodDeedQuotesDto): Promise<BulkResult>;
    private doLink;
    private doList;
    private doUpdate;
    private doUnlink;
    listLinkConcerns(query: LinkConcernsQueryDto): Promise<{
        data: LinkConcernDto[];
        meta: {
            counts: Record<LinkKind, number>;
            limitPerKind: number;
        };
    }>;
    private get sinBinding();
    linkBranchQuote(dto: {
        imanBranchId: string;
        quoteId: string;
        relevanceScore?: number;
        note?: string | null;
        reviewStatus?: LinkReviewStatus;
    }): Promise<{
        created: boolean;
        link: unknown;
    }>;
    listBranchQuotes(query: {
        page?: number;
        limit?: number;
        sort?: 'score' | 'newest';
        imanBranchId?: string;
        quoteId?: string;
        reviewStatus?: LinkReviewStatus;
    }): Promise<import("../../common/dto/paginated-result.js").PaginatedResult<unknown>>;
    updateBranchLink(id: string, dto: LinkUpdate): Promise<unknown>;
    unlinkBranchQuote(id: string): Promise<void>;
    private get goodDeedBinding();
    private get branchBinding();
    private bulkLink;
    private assertSinExists;
    private assertBranchExists;
    private assertGoodDeedExists;
    private assertQuoteExistsAndGradeAllowed;
    private buildSinQuoteWhere;
    private buildGoodDeedQuoteWhere;
    revokeSinGroup(sinId: string, classifiedBy: 'REVIEWER' | 'AI'): Promise<{
        revoked: number;
    }>;
    revokeGoodDeedGroup(goodDeedId: string, classifiedBy: 'REVIEWER' | 'AI'): Promise<{
        revoked: number;
    }>;
}
export {};
