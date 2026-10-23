'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { ReminderReader, type ReaderItem, type TypeFilter } from '@/components/shared/editorial/ReminderReader';
import { ReaderStatus } from '@/components/shared/feedback/ReaderStatus';
import { getBranchQuotes } from '@/lib/api/branches';
import type { BranchQuotesMeta } from '@/lib/api/branches';
import type { CountsByKind } from '@/lib/types/api';

interface BranchReaderProps {
  number: number;
  lang: string;
  items: ReaderItem[];
  total: number;
  /** Server-computed kind counts from the initial page fetch. */
  countsByKind?: CountsByKind;
}

export function BranchReader({ number, lang, items: initialItems, total, countsByKind }: BranchReaderProps) {
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
          limit: 50,
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

  const failed = isFiltered && isError && !data;
  const busy = isFiltered && !failed && !data ? true : isFiltered && isFetching && !isFetchingNextPage;

  const displayItems = useMemo(() => {
    if (!isFiltered) return initialItems;
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
  }, [isFiltered, initialItems, data, failed]);

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
      loadingNextPage={isFetchingNextPage}
      hasNextPage={isFiltered ? hasNextPage : false}
      onShowMore={() => void fetchNextPage()}
      busy={busy}
      labels={labels}
    />
    <ReaderStatus
      busy={busy}
      failed={failed}
      nextPageFailed={isFiltered && isFetchNextPageError}
      error={error}
      onRetry={() => void (isFetchNextPageError ? fetchNextPage() : refetch())}
    />
    </>
  );
}
