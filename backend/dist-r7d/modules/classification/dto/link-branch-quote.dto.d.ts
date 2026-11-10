import { LinkReviewStatus } from '@prisma/client';
export declare class LinkBranchQuoteDto {
    imanBranchId: string;
    quoteId: string;
    relevanceScore?: number;
    note?: string;
    reviewStatus?: LinkReviewStatus;
}
