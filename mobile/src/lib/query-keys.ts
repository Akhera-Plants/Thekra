/**
 * TanStack Query key factory.
 * Same key shape as frontend/src/lib/query-keys.ts — one mental model across clients.
 */

import type {
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
] as const;
