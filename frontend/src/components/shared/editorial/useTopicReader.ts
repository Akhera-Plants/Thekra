'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ReaderItem, ReaderSection, TypeFilter } from '@/components/shared/editorial/ReminderReader';
import type { ThemeChip } from '@/components/shared/editorial/ThemeChips';
import type { CountsByKind, PageMeta, QuoteKind, TopicText, TopicThemeCount } from '@/lib/types/api';

interface TopicPage {
  data: { items: TopicText[]; companion?: { items: TopicText[] } };
  meta?: PageMeta;
}

interface TopicPageMeta extends PageMeta {
  countsByKind?: CountsByKind;
  themes?: TopicThemeCount[];
}

interface UseTopicReaderOptions {
  queryRoot: 'sins' | 'good-deeds';
  slug: string;
  lang: string;
  fetchPage: (query: { page: number; limit: number; lang: 'ar' | 'en'; kind?: QuoteKind; theme?: string }) => Promise<TopicPage>;
  initialItems: ReaderItem[];
  initialSections?: ReaderSection[];
  initialCountsByKind?: CountsByKind;
  /** meta.themes of the server render (whole page, independent of the filter). */
  themes?: TopicThemeCount[];
  /** meta.theme of the server render (?theme= in the URL, when it is a theme of this page). */
  initialTheme: string | null;
}

const toReader = (item: TopicText): ReaderItem => ({ id: item.quote.id, quote: item.quote, note: item.link.note });

/** Mirror the chip in ?theme= without a navigation (the list is fetched on the client). */
function writeThemeParam(key: string | null) {
  const url = new URL(window.location.href);
  if (key) url.searchParams.set('theme', key);
  else url.searchParams.delete('theme');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Kind tabs + theme chips for a topic reader. The server render is shown as
 * long as the reader is on «الكل» and the theme it was rendered with; any
 * other combination is fetched (`kind=` and/or `theme=`) page by page.
 */
export function useTopicReader({
  queryRoot,
  slug,
  lang,
  fetchPage,
  initialItems,
  initialSections,
  initialCountsByKind,
  themes,
  initialTheme,
}: UseTopicReaderOptions) {
  const [activeKind, setActiveKind] = useState<TypeFilter>('all');
  const [activeTheme, setActiveTheme] = useState<string | null>(initialTheme);
  const serverView = activeKind === 'all' && activeTheme === initialTheme;

  const query = useInfiniteQuery({
    queryKey: [queryRoot, slug, 'quotes', { lang, kind: activeKind, theme: activeTheme }] as const,
    queryFn: ({ pageParam }) =>
      fetchPage({
        page: pageParam,
        limit: 50,
        lang: lang === 'en' ? 'en' : 'ar',
        kind: activeKind === 'all' ? undefined : activeKind,
        theme: activeTheme ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: !serverView,
    // Keep the current list on screen while the next chip loads.
    placeholderData: keepPreviousData,
  });

  const pages = serverView ? undefined : query.data?.pages;
  const pending = !serverView && !pages;

  const { items, sections } = useMemo(() => {
    if (serverView || !pages) return { items: initialItems, sections: initialSections };
    const seen = new Set<string>();
    const flat: ReaderItem[] = [];
    for (const page of pages) {
      // Unfiltered pages carry the paired texts in `companion`; filtered ones are one list.
      const rows = activeKind === 'all' && !activeTheme
        ? [...page.data.items, ...(page.data.companion?.items ?? [])]
        : page.data.items;
      for (const row of rows) {
        if (seen.has(row.quote.id)) continue;
        seen.add(row.quote.id);
        flat.push(toReader(row));
      }
    }
    return { items: flat, sections: undefined };
  }, [serverView, pages, initialItems, initialSections, activeKind, activeTheme]);

  const firstMeta = pages?.[0]?.meta as TopicPageMeta | undefined;
  const countsByKind = serverView ? initialCountsByKind : (firstMeta?.countsByKind ?? initialCountsByKind);

  const chips = useMemo<ThemeChip[]>(
    () => (themes ?? []).map((theme) => ({ key: theme.key, label: lang === 'en' ? theme.en : theme.ar, count: theme.count })),
    [themes, lang],
  );

  return {
    items,
    sections,
    countsByKind,
    chips,
    activeTheme,
    busy: pending || (query.isFetching && !query.isFetchingNextPage && !serverView),
    hasNextPage: serverView ? false : Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    setKind: setActiveKind,
    setTheme: (key: string | null) => {
      setActiveTheme(key);
      writeThemeParam(key);
    },
  };
}
