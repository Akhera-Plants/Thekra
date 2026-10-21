'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReminderReader, type ReaderItem, type ReaderSection, type TypeFilter } from '@/components/shared/editorial/ReminderReader';
import { getSinQuotes } from '@/lib/api/sins';
import type { CountsByKind, SinQuotesMeta } from '@/lib/types/api';

interface SinReaderProps {
  slug: string;
  lang: string;
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
  /** Server-computed kind counts from the initial page fetch. */
  countsByKind?: CountsByKind;
}

export function SinReader({ slug, lang, items: initialItems, total, sections: initialSections, countsByKind }: SinReaderProps) {
  const t = useTranslations('sinDetail');
  const [activeKind, setActiveKind] = useState<TypeFilter>('all');

  const isFiltered = activeKind !== 'all';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['sins', slug, 'quotes', { lang, kind: activeKind }] as const,
    queryFn: ({ pageParam }) =>
      getSinQuotes(slug, {
        page: pageParam as number,
        limit: 50,
        lang: lang as 'ar' | 'en',
        kind: activeKind === 'all' ? undefined : activeKind,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      (lastPage.meta as SinQuotesMeta)?.hasNext
        ? ((lastPage.meta as SinQuotesMeta).page + 1)
        : undefined,
    // Only activate query when a specific kind is selected — for 'all' we use
    // the server-rendered initial items. For specific kinds we start fresh.
    enabled: isFiltered,
  });

  // Build items for display:
  // - 'all': use server-rendered initial items (with sections/companion)
  // - specific kind: use infinite query pages (flat list, no sections)
  const { displayItems, displaySections } = useMemo(() => {
    if (!isFiltered) {
      return { displayItems: initialItems, displaySections: initialSections };
    }
    const pages = data?.pages ?? [];
    const flat: ReaderItem[] = pages.flatMap((page) =>
      page.data.items.map((item) => ({
        id: item.quote.id,
        quote: item.quote,
        note: item.link.note,
      })),
    );
    return { displayItems: flat, displaySections: undefined };
  }, [isFiltered, initialItems, initialSections, data]);

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
    <ReminderReader
      items={displayItems}
      total={total}
      sections={displaySections}
      intent="sin"
      countsByKind={countsByKind}
      onKindChange={(kind) => setActiveKind(kind)}
      loadingNextPage={isFetchingNextPage}
      hasNextPage={isFiltered ? hasNextPage : false}
      onShowMore={() => void fetchNextPage()}
      labels={labels}
    />
  );
}
