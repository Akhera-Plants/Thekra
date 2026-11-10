import { LinkReviewStatus } from '@prisma/client';
export declare class LinkSinQuoteDto {
    sinId: string;
    quoteId: string;
    relevanceScore?: number;
    note?: string;
    reviewStatus?: LinkReviewStatus;
}
