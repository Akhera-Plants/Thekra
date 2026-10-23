'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ReaderItem, ReaderSection, TypeFilter } from '@/components/shared/editorial/ReminderReader';
import type { ThemeChip } from '@/components/shared/editorial/ThemeChips';
import { TOPIC_PAGE_SIZE } from '@/lib/reading';
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
  /** meta.hasNext of the server page. «Show more» on the server view fetches page 2 onwards. */
  initialHasNext?: boolean;
}

const toReader = (item: TopicText): ReaderItem => ({ id: item.quote.id, quote: item.quote, note: item.link.note });

/**
 * Mirror the chip in ?theme= without a navigation (the list is fetched on the client). A new history
 * entry per chip, so back and forward return to the previous chip (audit B07).
 */
function writeThemeParam(key: string | null) {
  const url = new URL(window.location.href);
  if (key) url.searchParams.set('theme', key);
  else url.searchParams.delete('theme');
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.pushState(null, '', next);
  }
}

const readThemeFromUrl = () => parseThemeParam(new URLSearchParams(window.location.search).get('theme'));

/**
 * Pages 2… of the server view, added to its sections: the topic's own list under the section
 * whose source is `items`, the paired list under `companion`. Without sections, a flat list.
 */
function continueServerView(
  initialItems: ReaderItem[],
  initialSections: ReaderSection[] | undefined,
  pages: readonly TopicPage[],
): { items: ReaderItem[]; sections: ReaderSection[] | undefined } {
  if (pages.length === 0) return { items: initialItems, sections: initialSections };
  const seen = new Set(initialItems.map((item) => item.id));
  for (const section of initialSections ?? []) for (const item of section.items) seen.add(item.id);
  const fresh = (rows: TopicText[]) =>
    rows.filter((row) => !seen.has(row.quote.id) && seen.add(row.quote.id)).map(toReader);
  const own: ReaderItem[] = [];
  const companion: ReaderItem[] = [];
  for (const page of pages) {
    own.push(...fresh(page.data.items));
    companion.push(...fresh(page.data.companion?.items ?? []));
  }
  const items = [...initialItems, ...own, ...companion];
  if (!initialSections || initialSections.length === 0) return { items, sections: initialSections };
  const sections = initialSections.map((section) => ({
    ...section,
    items:
      section.source === 'items'
        ? [...section.items, ...own]
        : section.source === 'companion'
          ? [...section.items, ...companion]
          : section.items,
  }));
  return { items, sections };
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
  initialHasNext = false,
}: UseTopicReaderOptions) {
  const [activeKind, setActiveKind] = useState<TypeFilter>('all');
  // `undefined` = the visitor has not picked a chip yet, so the URL (or the server render) decides.
  const [pickedTheme, setPickedTheme] = useState<string | null | undefined>(undefined);
  // `?theme=` of the address bar, read after hydration (null on the server: same HTML for everyone).
  // An effect, not a no-op external store: that store kept the server's null after hydration, so a
  // shared ?theme= link opened on «الكل» (audit B07). Back/forward re-read it and drop the picked chip.
  const [urlTheme, setUrlTheme] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      setUrlTheme(readThemeFromUrl());
      setPickedTheme(undefined);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const urlThemeKnown = urlTheme && (themes ?? []).some((theme) => theme.key === urlTheme) ? urlTheme : null;
  const activeTheme = pickedTheme !== undefined ? pickedTheme : (urlThemeKnown ?? initialTheme);
  const serverView = activeKind === 'all' && activeTheme === initialTheme;

  const query = useInfiniteQuery({
    queryKey: [queryRoot, slug, 'quotes', { lang, kind: activeKind, theme: activeTheme }] as const,
    // Reading `signal` makes TanStack cancel this request when the key changes (latest click wins).
    queryFn: ({ pageParam, signal }) =>
      fetchPage(
        {
          page: pageParam,
          limit: TOPIC_PAGE_SIZE,
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

  // The server view is page 1; «show more» there fetches page 2 onwards with the same filter.
  const [continued, setContinued] = useState(false);
  const continuation = useInfiniteQuery({
    queryKey: [queryRoot, slug, 'quotes', { lang, kind: 'all', theme: initialTheme, from: 2 }] as const,
    queryFn: ({ pageParam, signal }) =>
      fetchPage(
        { page: pageParam, limit: TOPIC_PAGE_SIZE, lang: lang === 'en' ? 'en' : 'ar', theme: initialTheme ?? undefined },
        signal,
      ),
    initialPageParam: 2,
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled: serverView && continued && initialHasNext,
  });
  const continuedPages = continuation.data?.pages;

  const pages = serverView ? undefined : query.data?.pages;
  // A failed first page has no data, and must read as an error, never as "still loading".
  const failed = !serverView && query.isError && !pages;
  const pending = !serverView && !pages && !failed;

  const { items, sections } = useMemo(() => {
    if (serverView) return continueServerView(initialItems, initialSections, continuedPages ?? []);
    // First load after the server view: the server list stays on screen, dimmed, until the answer lands.
    if (!pages && !failed) return { items: initialItems, sections: initialSections };
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
  }, [serverView, continuedPages, failed, pages, initialItems, initialSections, activeKind, activeTheme]);

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
    nextPageFailed: serverView ? continuation.isError : query.isFetchNextPageError,
    retry: () => {
      if (serverView) void (continuation.data ? continuation.fetchNextPage() : continuation.refetch());
      else void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch());
    },
    hasNextPage: serverView
      ? (continued ? Boolean(continuation.hasNextPage) : initialHasNext)
      : Boolean(query.hasNextPage),
    isFetchingNextPage: serverView ? continuation.isFetching : query.isFetchingNextPage,
    fetchNextPage: () => {
      if (!serverView) void query.fetchNextPage();
      else if (!continued) setContinued(true);
      else void continuation.fetchNextPage();
    },
    setKind: setActiveKind,
    setTheme: (key: string | null) => {
      setPickedTheme(key);
      writeThemeParam(key);
    },
  };
}
