import type { QuoteType } from '@prisma/client';

export interface GoodDeedLinkDto {
  id: string;
  goodDeedId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
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
