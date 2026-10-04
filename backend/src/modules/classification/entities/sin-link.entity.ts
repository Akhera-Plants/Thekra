import type { QuoteType } from '@prisma/client';

export interface SinLinkDto {
  id: string;
  sinId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
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
