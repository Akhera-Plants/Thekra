import { LinkReviewStatus } from '@prisma/client';
export declare class LinkGoodDeedQuoteDto {
    goodDeedId: string;
    quoteId: string;
    relevanceScore?: number;
    note?: string;
    reviewStatus?: LinkReviewStatus;
}
