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
  SinRank,
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
  details?: ApiValidationDetail[] | Record<string, unknown> | null;
  path?: string;
  method?: string;
  requestId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiValidationDetail[] | null;
  /** `error.details` exactly as the API sent it (e.g. the current store on a 409 PRACTICE_VERSION_CONFLICT). */
  readonly rawDetails: unknown;
  readonly requestId?: string;

  constructor(args: {
    code: string;
    message: string;
    status: number;
    details?: ApiValidationDetail[] | null;
    rawDetails?: unknown;
    requestId?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details ?? null;
    this.rawDetails = args.rawDetails ?? null;
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
    /** Graded by a tahqiq edition (not al-Bukhari or Muslim): the site's «ليس من الصحيحين» line. */
    outsideSahihayn?: boolean;
  } | null;
  book: {
    bookTitle: string | null;
    author: string | null;
    pageOrChapter: string | null;
  } | null;
  citation: {
    volume: string | null;
    page: string | null;
    gradeAuthority: string | null;
    gradeReference: string | null;
  };
  source: QuoteSourceDto;
  tags: QuoteTagDto[];
  /** A saying of a Companion/Successor: always labelled «أثر، وليس حديثًا», never shown as hadith. */
  isAthar?: boolean;
  atharSpeakerAr?: string | null;
  /** SAID → «— speaker». NARRATED → «رواه speaker». */
  atharAttributionKind?: 'SAID' | 'NARRATED' | null;
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
  rank: SinRank | null;
  rankReference: string | null;
  rankSource: { id: string; name: string; nameAr: string | null } | null;
  domainKey?: string | null;
  isContemporary?: boolean;
  pair?: TopicPairDto | null;
  quoteCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A paired sin/deed is one page (PROJECT_GUIDE §3.10): the two slugs and the page's shared title. */
export interface TopicPairDto {
  avoid: string;
  do: string;
  titleAr: string;
  titleEn: string;
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
  domainKey?: string | null;
  isContemporary?: boolean;
  pair?: TopicPairDto | null;
  quoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLinkDto {
  id: string;
  relevanceScore: number | null;
  note: string | null;
}

export interface TopicText {
  link: QuoteLinkDto;
  quote: QuoteDto;
}

/** A contemporary topic's texts drawn from another sin (AVOID) or good deed (DO), page by page like `items`. */
export interface TopicGroup {
  slug: string;
  name?: string | null;
  nameAr: string;
  side: 'AVOID' | 'DO';
  items: TopicText[];
}

export interface SinQuotesResponse {
  sin: Pick<SinDto, 'id' | 'slug' | 'name' | 'nameAr' | 'rank' | 'description' | 'descriptionAr' | 'isContemporary'>;
  items: TopicText[];
  /** The paired deed's texts (or «الترك لله» for an unpaired sin). Absent in a theme or shuffle response. */
  companion?: { items: TopicText[] };
  derived?: TopicGroup[];
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
    'id' | 'slug' | 'name' | 'nameAr' | 'reward' | 'rewardAr' | 'description' | 'descriptionAr' | 'isContemporary'
  >;
  items: TopicText[];
  /** The opposite sin's warning texts. Absent in a theme or shuffle response. */
  companion?: { items: TopicText[] };
  derived?: TopicGroup[];
}

export interface GoodDeedQuotesMeta extends PageMeta {
  ordering?: string;
  countsByType?: Partial<Record<QuoteType, number>>;
  appliedGrades?: HadithGrade[];
}

/** One of the 77 شعب الإيمان (`GET /v1/branches`). English title and summary are often missing (no machine translation). */
export interface ImanBranchDto {
  id: string;
  number: number;
  titleAr: string;
  title: string | null;
  summaryAr: string | null;
  summary: string | null;
  quoteCount: number;
  source: { id: string; name: string; nameAr: string | null } | null;
  sourceReference: string | null;
}

export type ImanBranchNeighbourDto = Pick<ImanBranchDto, 'number' | 'titleAr' | 'title'>;

/** `GET /v1/branches/:number`: the branch with the book's own words on it (BRANCH_SHARH) and its neighbours. */
export interface ImanBranchDetailDto extends ImanBranchDto {
  explanations: Array<{
    id: string;
    kind: string;
    languageCode: string;
    text: string;
    reference: string | null;
  }>;
  goodDeeds: Array<{ slug: string; name: string; nameAr: string }>;
  sins: Array<{ slug: string; name: string; nameAr: string; rank: SinRank | null }>;
  prev: ImanBranchNeighbourDto | null;
  next: ImanBranchNeighbourDto | null;
}

export interface BranchQuotesResponse {
  branch: Pick<ImanBranchDto, 'number' | 'titleAr' | 'title' | 'summaryAr'>;
  items: TopicText[];
}

export interface BranchQuotesMeta extends PageMeta {
  ordering?: string;
  countsByType?: Partial<Record<QuoteType, number>>;
  appliedGrades?: HadithGrade[];
}

/** A row of `GET /v1/sources`: the home «تذكير تعرف مصدره» strip reads the names and the published count. */
export interface SourceListDto extends QuoteSourceDto {
  publishedQuoteCount: number;
}

// ── Query parameter types ─────────────────────────────────────────────────────

export interface SinsQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  category?: string;
  rank?: SinRank;
  q?: string;
  sort?: 'name' | 'quoteCount';
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

export interface BranchesQuery {
  page?: number;
  limit?: number;
  lang?: LocaleCode;
  q?: string;
  sort?: 'number' | 'quoteCount';
}

/** The branch quotes endpoint reads the sin quotes query (backend `SinQuotesQueryDto`). */
export type BranchQuotesQuery = SinQuotesQuery;

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
