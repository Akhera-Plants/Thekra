import type {
  GoodDeedQuotesQuery,
  GoodDeedsQuery,
  QuotesQuery,
  SinQuotesQuery,
  SinsQuery,
  SourcesQuery,
  SurahAyahsQuery,
  TagsQuery,
} from '@/lib/types/api';
import type {
  AdminQuotesQuery,
  SinQuotesAdminQuery,
  GoodDeedQuotesAdminQuery,
  SyncLogsQuery,
} from '@/lib/types/admin';

export const queryKeys = {
  sins: {
    all: ['sins'] as const,
    list: (p: SinsQuery) => ['sins', 'list', p] as const,
    detail: (slug: string) => ['sins', 'detail', slug] as const,
    quotes: (slug: string, p: SinQuotesQuery) =>
      ['sins', slug, 'quotes', p] as const,
  },
  goodDeeds: {
    all: ['good-deeds'] as const,
    list: (p: GoodDeedsQuery) => ['good-deeds', 'list', p] as const,
    detail: (slug: string) => ['good-deeds', 'detail', slug] as const,
    quotes: (slug: string, p: GoodDeedQuotesQuery) =>
      ['good-deeds', slug, 'quotes', p] as const,
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
    ayahs: (number: number, p?: SurahAyahsQuery) =>
      ['surahs', number, 'ayahs', p] as const,
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
    list: (p: SourcesQuery) => ['sources', 'list', p] as const,
  },
  session: ['session'] as const,
  // ── Admin (Phase 6) ───────────────────────────────────────────────────────
  adminQuotes: {
    all: ['admin', 'quotes'] as const,
    list: (p: AdminQuotesQuery) => ['admin', 'quotes', 'list', p] as const,
    detail: (id: string) => ['admin', 'quotes', id] as const,
  },
  adminSins: {
    all: ['admin', 'sins'] as const,
  },
  adminGoodDeeds: {
    all: ['admin', 'good-deeds'] as const,
  },
  adminSources: {
    all: ['admin', 'sources'] as const,
  },
  adminTags: {
    all: ['admin', 'tags'] as const,
  },
  adminSinQuotes: {
    all: ['admin', 'sin-quotes'] as const,
    list: (p: SinQuotesAdminQuery) => ['admin', 'sin-quotes', 'list', p] as const,
  },
  adminGoodDeedQuotes: {
    all: ['admin', 'good-deed-quotes'] as const,
    list: (p: GoodDeedQuotesAdminQuery) => ['admin', 'good-deed-quotes', 'list', p] as const,
  },
  adminSyncLogs: {
    all: ['admin', 'sync-logs'] as const,
    list: (p: SyncLogsQuery) => ['admin', 'sync-logs', 'list', p] as const,
    detail: (id: string) => ['admin', 'sync-logs', id] as const,
  },
  adminStats: ['admin', 'stats'] as const,
  // Review desk (flags, counts, proposals, publish probe)
  adminReview: {
    all: ['admin', 'review'] as const,
    flags: (p: object) => ['admin', 'review', 'flags', p] as const,
    flag: (id: string) => ['admin', 'review', 'flag', id] as const,
    count: (scope: string, p: object) => ['admin', 'review', 'count', scope, p] as const,
    proposals: (kind: string, p: object) => ['admin', 'review', 'proposals', kind, p] as const,
    publicState: (quoteId: string) => ['admin', 'review', 'public-state', quoteId] as const,
  },
} as const;
