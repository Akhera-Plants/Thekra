'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ReminderReader, type ReaderItem, type TypeFilter } from '@/components/shared/editorial/ReminderReader';
import { ReaderStatus } from '@/components/shared/feedback/ReaderStatus';
import { getBranchQuotes } from '@/lib/api/branches';
import { TOPIC_PAGE_SIZE } from '@/lib/reading';
import type { BranchQuotesMeta } from '@/lib/api/branches';
import type { CountsByKind } from '@/lib/types/api';

interface BranchReaderProps {
  number: number;
  lang: string;
  items: ReaderItem[];
  total: number;
  /** Server-computed kind counts from the initial page fetch. */
  countsByKind?: CountsByKind;
  /** meta.hasNext of the server page: «show more» on «الكل» continues from page 2. */
  initialHasNext?: boolean;
}

export function BranchReader({ number, lang, items: initialItems, total, countsByKind, initialHasNext = false }: BranchReaderProps) {
  const t = useTranslations('sinDetail');
  const [activeKind, setActiveKind] = useState<TypeFilter>('all');

  const isFiltered = activeKind !== 'all';

  const {
    data,
    error,
    isError,
    isFetching,
    isFetchNextPageError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['branches', number, 'quotes', { lang, kind: activeKind }] as const,
    queryFn: ({ pageParam, signal }) =>
      getBranchQuotes(
        number,
        {
          page: pageParam as number,
          limit: TOPIC_PAGE_SIZE,
          lang,
          kind: activeKind === 'all' ? undefined : activeKind,
        },
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      (lastPage.meta as BranchQuotesMeta)?.hasNext
        ? ((lastPage.meta as BranchQuotesMeta).page + 1)
        : undefined,
    enabled: isFiltered,
    placeholderData: keepPreviousData,
  });

  // «الكل» is the server page; «show more» there fetches page 2 onwards.
  const [continued, setContinued] = useState(false);
  const continuation = useInfiniteQuery({
    queryKey: ['branches', number, 'quotes', { lang, kind: 'all', from: 2 }] as const,
    queryFn: ({ pageParam, signal }) =>
      getBranchQuotes(number, { page: pageParam as number, limit: TOPIC_PAGE_SIZE, lang }, { signal }),
    initialPageParam: 2,
    getNextPageParam: (lastPage) =>
      (lastPage.meta as BranchQuotesMeta)?.hasNext
        ? ((lastPage.meta as BranchQuotesMeta).page + 1)
        : undefined,
    enabled: !isFiltered && continued && initialHasNext,
  });

  const failed = isFiltered && isError && !data;
  const busy = isFiltered && !failed && !data ? true : isFiltered && isFetching && !isFetchingNextPage;

  const displayItems = useMemo(() => {
    if (!isFiltered) {
      const seen = new Set(initialItems.map((item) => item.id));
      const more = (continuation.data?.pages ?? []).flatMap((page) =>
        page.data.items
          .filter((item) => !seen.has(item.quote.id) && seen.add(item.quote.id))
          .map((item) => ({ id: item.quote.id, quote: item.quote, note: item.link.note })),
      );
      return [...initialItems, ...more];
    }
    // First load of a kind: the full list stays (dimmed); a failed load shows an empty list and an error.
    if (!data) return failed ? [] : initialItems;
    const pages = data.pages;
    return pages.flatMap((page) =>
      page.data.items.map((item) => ({
        id: item.quote.id,
        quote: item.quote,
        note: item.link.note,
      })),
    );
  }, [isFiltered, initialItems, data, failed, continuation.data]);

  const labels = {
    showMore: t('showMore'),
    tabAll: t('typeAll'),
    tabVerses: t('typeVerses'),
    tabHadith: t('typeHadith'),
    tabAthar: t('typeAthar'),
    atharSection: t('atharSection'),
    tabsLabel: t('tabsLabel'),
  };

  return (
    <>
    <ReminderReader
      items={displayItems}
      total={total}
      intent="iman-branch"
      countsByKind={countsByKind}
      onKindChange={(kind) => setActiveKind(kind)}
      loadingNextPage={isFiltered ? isFetchingNextPage : continuation.isFetching}
      hasNextPage={isFiltered ? hasNextPage : continued ? Boolean(continuation.hasNextPage) : initialHasNext}
      onShowMore={() => {
        if (isFiltered) void fetchNextPage();
        else if (!continued) setContinued(true);
        else void continuation.fetchNextPage();
      }}
      busy={busy}
      labels={labels}
    />
    <ReaderStatus
      busy={busy}
      failed={failed}
      nextPageFailed={isFiltered ? isFetchNextPageError : continuation.isError}
      error={error ?? continuation.error}
      onRetry={() => {
        if (!isFiltered) void (continuation.data ? continuation.fetchNextPage() : continuation.refetch());
        else void (isFetchNextPageError ? fetchNextPage() : refetch());
      }}
    />
    </>
  );
}
