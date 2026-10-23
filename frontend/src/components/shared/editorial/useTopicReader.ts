'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ReaderItem, ReaderSection, TypeFilter } from '@/components/shared/editorial/ReminderReader';
import type { ThemeChip } from '@/components/shared/editorial/ThemeChips';
import { parseThemeParam } from '@/lib/search/topic-themes';
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
  /** `signal` aborts the request when a newer chip/tab click supersedes it. */
  fetchPage: (
    query: { page: number; limit: number; lang: 'ar' | 'en'; kind?: QuoteKind; theme?: string },
    signal?: AbortSignal,
  ) => Promise<TopicPage>;
  initialItems: ReaderItem[];
  initialSections?: ReaderSection[];
  initialCountsByKind?: CountsByKind;
  /** meta.themes of the server render (whole page, independent of the filter). */
  themes?: TopicThemeCount[];
  /**
   * meta.theme of the server render. Public topic pages are cached and shared, so they
   * render without a theme (null) and the `?theme=` of the URL is applied here, on the client.
   */
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

const subscribeToNothing = () => () => {};
const readThemeFromUrl = () => parseThemeParam(new URLSearchParams(window.location.search).get('theme'));

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
  // `?theme=` of the address bar, read after hydration (null on the server: same HTML for everyone).
  const urlTheme = useSyncExternalStore(subscribeToNothing, readThemeFromUrl, () => null);
  const urlThemeKnown = urlTheme && (themes ?? []).some((theme) => theme.key === urlTheme) ? urlTheme : null;
  // `undefined` = the visitor has not picked a chip yet, so the URL (or the server render) decides.
  const [pickedTheme, setPickedTheme] = useState<string | null | undefined>(undefined);
  const activeTheme = pickedTheme !== undefined ? pickedTheme : (urlThemeKnown ?? initialTheme);
  const serverView = activeKind === 'all' && activeTheme === initialTheme;

  const query = useInfiniteQuery({
    queryKey: [queryRoot, slug, 'quotes', { lang, kind: activeKind, theme: activeTheme }] as const,
    // Reading `signal` makes TanStack cancel this request when the key changes (latest click wins).
    queryFn: ({ pageParam, signal }) =>
      fetchPage(
        {
          page: pageParam,
          limit: 50,
          lang: lang === 'en' ? 'en' : 'ar',
          kind: activeKind === 'all' ? undefined : activeKind,
          theme: activeTheme ?? undefined,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: !serverView,
    // Keep the current list on screen (dimmed, aria-busy) while the next chip loads.
    placeholderData: keepPreviousData,
  });

  const pages = serverView ? undefined : query.data?.pages;
  // A failed first page has no data, and must read as an error, never as "still loading".
  const failed = !serverView && query.isError && !pages;
  const pending = !serverView && !pages && !failed;

  const { items, sections } = useMemo(() => {
    // First load after the server view: the server list stays on screen, dimmed, until the answer lands.
    if (serverView || (!pages && !failed)) return { items: initialItems, sections: initialSections };
    // Failed: an empty list plus an error with retry, never another filter's list under this chip.
    if (!pages) return { items: [] as ReaderItem[], sections: undefined };
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
  }, [serverView, failed, pages, initialItems, initialSections, activeKind, activeTheme]);

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
    /** True while a new filter loads (first answer or placeholder swap): dim the list, keep controls live. */
    busy: pending || (query.isFetching && !query.isFetchingNextPage && !serverView),
    /** The first page of this filter failed; `error` is for `QueryErrorState`, `retry` re-runs it. */
    failed,
    error: query.error,
    /** «Show more» failed: the list on screen is still valid. */
    nextPageFailed: !serverView && query.isFetchNextPageError,
    retry: () => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch()),
    hasNextPage: serverView ? false : Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    setKind: setActiveKind,
    setTheme: (key: string | null) => {
      setPickedTheme(key);
      writeThemeParam(key);
    },
  };
}
