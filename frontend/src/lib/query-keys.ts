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
} as const;
