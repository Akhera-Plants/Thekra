import type { LinkConcern, LinkReviewStatus, QuoteType } from '@prisma/client';

export interface GoodDeedLinkDto {
  id: string;
  goodDeedId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
  reviewStatus: LinkReviewStatus;
  /** «وجه التذكير» (round 6), null until written by hand. */
  reminderAngle?: string | null;
  reminderAngleEn?: string | null;
  /** Owner-review flag raised while linking (round 6, C-01n). */
  concern?: LinkConcern | null;
  concernNote?: string | null;
  concernAt?: Date | null;
  goodDeed: {
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
