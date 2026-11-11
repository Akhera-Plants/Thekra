/**
 * Admin-specific DTO types mirroring backend admin endpoints.
 * Contract: docs/plan/backend-plan.md §3 admin endpoints (#28–#60).
 */

import type {
  HadithGrade,
  LinkReviewStatus,
  QuoteOrigin,
  QuoteType,
  SinRank,
  SourceType,
  SyncStatus,
  TagCategory,
} from './enums';
import type { SinDto } from './api';

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
  /** OCR texts whose textVerifiedAt is still null. */
  unverifiedOnly?: boolean;
  sort?: 'relevance' | 'newest' | 'oldest';
}

export interface SinQuotesAdminQuery {
  sinId?: string;
  quoteId?: string;
  page?: number;
  limit?: number;
  classifiedBy?: 'BOOK' | 'REVIEWER' | 'AI';
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
  volume?: string;
  page?: string;
  translations?: TranslationInputBody[];
  tagIds?: string[];
}

export type UpdateQuoteBody = Partial<Omit<CreateQuoteBody, 'type' | 'origin'>>;

/** Admin sin row. Public SinDto omits the editorial severity score. */
export type AdminSinDto = SinDto & { severity: number | null };

export interface CreateSinBody {
  name: string;
  nameAr: string;
  slug: string;
  category?: string;
  description?: string;
  descriptionAr?: string;
  severity?: number;
  rank?: SinRank | null;
  rankSourceId?: string | null;
  rankReference?: string | null;
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
  reviewStatus: LinkReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoodDeedQuoteLinkDto {
  id: string;
  goodDeedId: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
  reviewStatus: LinkReviewStatus;
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

// ── Review desk (QuoteFlag / HadithMatch) — GET/POST /review/* ──────────────────

import type {
  ClassifiedBy,
  FlagSeverity,
  FlagStatus,
  FlagType,
  LinkBasis,
  MatchDecision,
  ReferenceBook,
  TextSource,
} from '@/lib/format/admin-labels';
import type { QuoteDto } from './api';

/** GET /admin/quotes rows also carry the text provenance fields. */
export type AdminQuoteDto = QuoteDto & {
  textSource?: TextSource;
  textVerifiedAt?: string | null;
};

export interface FlagsQuery {
  page?: number;
  limit?: number;
  type?: FlagType;
  severity?: FlagSeverity;
  status?: FlagStatus;
  sourceId?: string;
}

export interface FlagQuoteDto {
  id: string;
  textAr: string;
  grade: HadithGrade | null;
  gradeSource: string | null;
  gradeAuthority: string | null;
  gradeReference: string | null;
  source: { id: string; name: string; nameAr: string | null };
}

export interface FlagDto {
  id: string;
  quoteId: string;
  type: FlagType;
  severity: FlagSeverity;
  source: 'AUTO' | 'USER';
  status: FlagStatus;
  details: unknown;
  note: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  quote: FlagQuoteDto;
}

export interface HadithMatchDto {
  id: string;
  quoteId: string;
  referenceHadithId: string;
  score: number;
  method: string;
  decision: MatchDecision;
  referenceHadith: {
    id: string;
    book: ReferenceBook;
    number: number;
    kitab: string | null;
    bab: string | null;
    matnText: string;
    isnadText: string;
  };
}

export interface FlagDetailDto extends FlagDto {
  quote: FlagQuoteDto & {
    legacyGrade: HadithGrade | null;
    legacyGradeAuthority: string | null;
    legacyGradeReference: string | null;
    matches: HadithMatchDto[];
  };
}

/** GET /admin/sin-quotes and /admin/good-deed-quotes rows (all link columns + topic + quote). */
export interface ProposedLinkDto {
  id: string;
  quoteId: string;
  relevanceScore: number | null;
  note: string | null;
  reviewStatus: LinkReviewStatus;
  basis: LinkBasis;
  classifiedBy: ClassifiedBy;
  createdAt: string;
  sin?: { slug: string; name: string; nameAr: string };
  goodDeed?: { slug: string; name: string; nameAr: string };
  quote: { id: string; type: QuoteType; textAr: string };
}
