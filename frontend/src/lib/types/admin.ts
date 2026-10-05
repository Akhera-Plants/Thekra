/**
 * Admin-specific DTO types mirroring backend admin endpoints.
 * Contract: docs/plan/backend-plan.md §3 admin endpoints (#28–#60).
 */

import type { HadithGrade, QuoteOrigin, QuoteType, SourceType, SyncStatus, TagCategory } from './enums';

// ── Query params ──────────────────────────────────────────────────────────────

export interface AdminQuotesQuery {
  page?: number;
  limit?: number;
  q?: string;
  type?: QuoteType[];
  origin?: QuoteOrigin;
  grades?: HadithGrade[];
  sourceId?: string;
  tag?: string[];
  sinSlug?: string;
  goodDeedSlug?: string;
  unlinkedOnly?: boolean;
  missingTranslation?: string;
  sort?: 'relevance' | 'newest' | 'oldest';
}

export interface SinQuotesAdminQuery {
  sinId?: string;
  quoteId?: string;
  page?: number;
  limit?: number;
}

export interface GoodDeedQuotesAdminQuery {
  goodDeedId?: string;
  quoteId?: string;
  page?: number;
  limit?: number;
}

export interface SyncLogsQuery {
  sourceId?: string;
  status?: SyncStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface TranslationInputBody {
  languageCode: string;
  text: string;
}

export interface CreateQuoteBody {
  type: QuoteType;
  origin?: QuoteOrigin;
  textAr: string;
  sourceId: string;
  surahNumber?: number;
  surahName?: string;
  surahNameAr?: string;
  ayahNumber?: number;
  narrator?: string;
  narratorAr?: string;
  grade?: HadithGrade;
  hadithReference?: string;
  bookTitle?: string;
  author?: string;
  pageOrChapter?: string;
  translations?: TranslationInputBody[];
  tagIds?: string[];
}

export type UpdateQuoteBody = Partial<Omit<CreateQuoteBody, 'type' | 'origin'>>;

export interface CreateSinBody {
  name: string;
  nameAr: string;
  slug: string;
  category?: string;
  description?: string;
  descriptionAr?: string;
  severity?: number;
}

export type UpdateSinBody = Partial<CreateSinBody>;

export interface CreateGoodDeedBody {
  name: string;
  nameAr: string;
  slug: string;
  category?: string;
  description?: string;
  descriptionAr?: string;
  reward?: string;
  rewardAr?: string;
  oppositeSinId?: string;
}

export type UpdateGoodDeedBody = Partial<CreateGoodDeedBody>;

export interface CreateSourceBody {
  name: string;
  nameAr?: string;
  type: SourceType;
  author?: string;
  authorAr?: string;
  language?: string;
  isExternalApi?: boolean;
  apiProvider?: string;
  apiBaseUrl?: string;
}

export type UpdateSourceBody = Partial<CreateSourceBody>;

export interface CreateTagBody {
  name: string;
  nameAr?: string;
  slug: string;
  category: TagCategory;
}

export type UpdateTagBody = Partial<CreateTagBody>;

export interface BulkLinkItem {
  quoteId: string;
  relevanceScore?: number;
  note?: string;
}

export interface BulkLinkSinQuotesBody {
  sinId: string;
  links: BulkLinkItem[];
}

export interface BulkLinkGoodDeedQuotesBody {
  goodDeedId: string;
  links: BulkLinkItem[];
}

export interface TriggerSyncBody {
  sourceId: string;
  scope?: {
    surahFrom?: number;
    surahTo?: number;
    collection?: string;
    bookFrom?: number;
    bookTo?: number;
  };
  dryRun?: boolean;
  force?: boolean;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface AdminTranslationDto {
  id: string;
  languageCode: string;
  text: string;
}

export interface SinQuoteLinkDto {
  id: string;
  sinId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodDeedQuoteLinkDto {
  id: string;
  goodDeedId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkLinkResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface SyncLogDto {
  id: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  recordsImported: number;
  errorMessage: string | null;
  source: {
    id: string;
    name: string;
    apiProvider: string | null;
  };
}
