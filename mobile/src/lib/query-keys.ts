/**
 * TanStack Query key factory.
 * Same key shape as frontend/src/lib/query-keys.ts — one mental model across clients.
 */

import type {
  BranchQuotesQuery,
  BranchesQuery,
  GoodDeedQuotesQuery,
  GoodDeedsQuery,
  QuotesQuery,
  SinQuotesQuery,
  SinsQuery,
  TagsQuery,
} from './types/api';

export const queryKeys = {
  sins: {
    all: ['sins'] as const,
    list: (p: SinsQuery) => ['sins', 'list', p] as const,
    detail: (slug: string) => ['sins', 'detail', slug] as const,
    quotes: (slug: string, p: SinQuotesQuery) => ['sins', slug, 'quotes', p] as const,
  },
  goodDeeds: {
    all: ['good-deeds'] as const,
    list: (p: GoodDeedsQuery) => ['good-deeds', 'list', p] as const,
    detail: (slug: string) => ['good-deeds', 'detail', slug] as const,
    quotes: (slug: string, p: GoodDeedQuotesQuery) => ['good-deeds', slug, 'quotes', p] as const,
  },
  quotes: {
    detail: (id: string) => ['quotes', id] as const,
    list: (p: QuotesQuery) => ['quotes', 'list', p] as const,
    /** Under the quote's detail key, as on the site: `[...detail(id), 'explanations', lang]`. */
    explanations: (id: string, lang: string) => ['quotes', id, 'explanations', lang] as const,
    /** The site's «تذكرة مختارة» (`GET /v1/quotes/today`): one text per UTC day, so the day is in the key. */
    today: (lang: string, utcDay: number) => ['quotes', 'today', lang, utcDay] as const,
  },
  /** شعب الإيمان: `number` is the branch number (1–77), the site's route key. */
  branches: {
    all: ['branches'] as const,
    list: (p: BranchesQuery, lang: string) => ['branches', 'list', p, lang] as const,
    detail: (number: number, lang: string) => ['branches', 'detail', number, lang] as const,
    quotes: (number: number, p: BranchQuotesQuery, lang: string) => ['branches', number, 'quotes', p, lang] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    quoteIds: ['favorites', 'quote-ids'] as const,
  },
  surahs: {
    all: ['surahs'] as const,
  },
  hadithCollections: {
    all: ['hadith-collections'] as const,
  },
  tags: {
    all: ['tags'] as const,
    list: (p: TagsQuery) => ['tags', 'list', p] as const,
    detail: (slug: string) => ['tags', 'detail', slug] as const,
  },
  sources: {
    all: ['sources'] as const,
    /** One page of the source list (names in both languages, so the language is not in the key). */
    list: (page: number, limit: number) => ['sources', 'list', page, limit] as const,
  },
  practice: {
    catalog: (lang: string) => ['practice', 'catalog', lang] as const,
    /** Every evidence list (retry from an evidence error). */
    evidenceAll: ['practice', 'evidence'] as const,
    /** `ids` is the sorted, comma-joined id list, so one list is one cache entry. */
    evidence: (ids: string, lang: string) => ['practice', 'evidence', ids, lang] as const,
  },
  calendar: {
    occasions: (from: string, to: string, hijriOffset: number, lang: string) =>
      ['calendar', 'occasions', from, to, hijriOffset, lang] as const,
  },
  /**
   * رفقة: private, never persisted (not in PERSISTED_QUERY_KEYS). Keyed by the signed-in user, so another account on
   * the same device never sees the previous one's circles from the cache.
   */
  circles: {
    all: ['circles'] as const,
    list: (userId: string) => ['circles', userId, 'list'] as const,
    detail: (userId: string, id: string) => ['circles', userId, 'detail', id] as const,
  },
  session: ['session'] as const,
} as const;

/**
 * Keys that are persisted to AsyncStorage for offline access.
 * Checked in the shouldDehydrateQuery allow-list in query-client.ts.
 */
export const PERSISTED_QUERY_KEYS = [
  'sins',
  'good-deeds',
  'favorites',
  'quotes',
  'branches',
  // Public catalog + evidence texts: needed offline for reminder titles and the habit screens.
  // Nothing user-specific lives under this key.
  'practice',
] as const;
