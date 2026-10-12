import type { SourceType } from '@prisma/client';

export interface SourceDto {
  id: string;
  name: string;
  nameAr: string | null;
  type: SourceType;
  author: string | null;
  authorAr: string | null;
  language: string;
  isExternalApi: boolean;
  apiProvider: string | null;
  apiBaseUrl: string | null;
  lastSyncedAt: Date | null;
  quoteCount: number;
  /** Texts a public reader can open: default grades, and no unverified OCR. */
  publishedQuoteCount: number;
}
