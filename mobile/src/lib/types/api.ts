/**
 * Hand-written mirrors of the backend DTOs.
 * Contract: docs/plan/backend-plan.md §3.1 (shared response shapes).
 * Format-identical to frontend/src/lib/types/api.ts for convention parity.
 */

import type {
  HadithGrade,
  LocaleCode,
  QuoteOrigin,
  QuoteType,
  SourceType,
  TagCategory,
} from './enums';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  locale?: LocaleCode | string;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PageMeta;
}

export interface ApiValidationDetail {
  field: string;
  constraint: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: ApiValidationDetail[] | null;
  path?: string;
  method?: string;
  requestId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiValidationDetail[] | null;
  readonly requestId?: string;

  constructor(args: {
    code: string;
    message: string;
    status: number;
    details?: ApiValidationDetail[] | null;
    requestId?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details ?? null;
    this.requestId = args.requestId;
  }
}

export interface QuoteSourceDto {
  id: string;
  name: string;
  nameAr: string | null;
  type: SourceType;
  author: string | null;
  authorAr: string | null;
  isExternalApi: boolean;
  apiProvider: string | null;
}

export interface QuoteTagDto {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  category: TagCategory;
}

export interface QuoteDto {
  id: string;
  type: QuoteType;
  origin: QuoteOrigin;
  textAr: string;
  translation: { languageCode: string; text: string } | null;
  quran: {
    surahNumber: number | null;
    surahName: string | null;
    surahNameAr: string | null;
    ayahNumber: number | null;
  } | null;
  hadith: {
    narrator: string | null;
    narratorAr: string | null;
    grade: HadithGrade | null;
    reference: string | null;
  } | null;
  book: {
    bookTitle: string | null;
    author: string | null;
    pageOrChapter: string | null;
  } | null;
  source: QuoteSourceDto;
  tags: QuoteTagDto[];
  external: { apiProvider: string | null; externalId: string | null } | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDetailDto extends QuoteDto {
  relatedSins: Array<Pick<SinDto, 'id' | 'slug' | 'name' | 'nameAr'>>;
  relatedGoodDeeds: Array<Pick<GoodDeedDto, 'id' | 'slug' | 'name' | 'nameAr'>>;
  allTranslations?: Array<{ languageCode: string; text: string }>;
}

export interface SinDto {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  severity: number | null;
  quoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoodDeedSummaryDto {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  reward: string | null;
  rewardAr: string | null;
}

export interface GoodDeedDto {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  reward: string | null;
  rewardAr: string | null;
  oppositeSin: {
    id: string;
    slug: string;
    name: string;
    nameAr: string;
  } | null;
  quoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLinkDto {
  id: string;
  relevanceScore: number | null;
  note: string | null;
}

export interface SinQuotesResponse {
  sin: Pick<SinDto, 'id' | 'slug' | 'name' | 'nameAr' | 'severity' | 'description' | 'descriptionAr'>;
  items: Array<{ link: QuoteLinkDto; quote: QuoteDto }>;
  alternatives: GoodDeedSummaryDto[];
}

export interface SinQuotesMeta extends PageMeta {
  ordering?: string;
  countsByType?: Partial<Record<QuoteType, number>>;
  appliedGrades?: HadithGrade[];
}

export interface GoodDeedQuotesResponse {
  goodDeed: Pick<
    GoodDeedDto,
    'id' | 'slug' | 'name' | 'nameAr' | 'reward' | 'rewardAr' | 'description' | 'descriptionAr'
  >;
  items: Array<{ link: QuoteLinkDto; quote: QuoteDto }>;
}

export interface GoodDeedQuotesMeta extends PageMeta {
  ordering?: string;
  countsByType?: Partial<Record<QuoteType, number>>;
  appliedGrades?: HadithGrade[];
}

// ── Query parameter types ─────────────────────────────────────────────────────

export interface SinsQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  category?: string;
  severityMin?: number;
  severityMax?: number;
  q?: string;
  sort?: 'name' | 'severity' | 'quoteCount';
}

export interface SinQuotesQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  type?: QuoteType[];
  grades?: HadithGrade[];
  includeWeak?: boolean;
  minScore?: number;
  shuffle?: boolean;
  seed?: string;
}

export interface GoodDeedsQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  category?: string;
  q?: string;
  oppositeSinSlug?: string;
  sort?: 'name' | 'quoteCount';
}

export interface GoodDeedQuotesQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  type?: QuoteType[];
  grades?: HadithGrade[];
  includeWeak?: boolean;
  minScore?: number;
  shuffle?: boolean;
  seed?: string;
}

export interface QuotesQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  q?: string;
  type?: QuoteType[];
  origin?: QuoteOrigin;
  grades?: HadithGrade[];
  sourceId?: string;
  tag?: string[];
  sinSlug?: string;
  goodDeedSlug?: string;
  surahNumber?: number;
  ayahNumber?: number;
  hasTranslation?: string;
  sort?: 'relevance' | 'newest' | 'oldest';
}

export interface TagsQuery {
  category?: TagCategory;
  page?: number;
  limit?: number;
  q?: string;
}

export interface SurahDto {
  number: number;
  name: string;
  nameAr: string;
  nameTransliteration: string | null;
  ayahCount: number;
}

export interface HadithCollectionDto {
  id: string;
  name: string;
  nameAr: string | null;
  type: SourceType;
}

// ── Auth types ────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
}

/**
 * NOTE (Phase 7 mobile): The backend `/v1/auth/login` currently sets the refresh
 * token only as an httpOnly cookie (designed for the web client). The mobile client
 * needs the refresh token in the response body. An additive backend change is
 * required: also return `refreshToken` in `data` for non-browser clients.
 * Until that lands, the refresh flow below stores whatever token the API returns.
 */
export interface AuthTokensDto {
  accessToken: string;
  /** Returned in response body for mobile clients (requires backend additive change). */
  refreshToken?: string;
  user: UserDto;
}
