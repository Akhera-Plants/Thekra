import type { LinkConcern, LinkReviewStatus, QuoteType } from '@prisma/client';
export interface SinLinkDto {
    id: string;
    sinId: string;
    quoteId: string;
    relevanceScore: number | null;
    note: string | null;
    reviewStatus: LinkReviewStatus;
    reminderAngle?: string | null;
    reminderAngleEn?: string | null;
    concern?: LinkConcern | null;
    concernNote?: string | null;
    concernAt?: Date | null;
    sin: {
        slug: string;
        name: string;
        nameAr: string;
    };
    quote: {
        id: string;
        type: QuoteType;
        textAr: string;
    };
}
