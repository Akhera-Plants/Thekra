'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReminderReader, type ReaderItem, type ReaderSection, type TypeFilter } from '@/components/shared/editorial/ReminderReader';
import { getGoodDeedQuotes } from '@/lib/api/good-deeds';
import type { CountsByKind, GoodDeedQuotesMeta } from '@/lib/types/api';

interface GoodDeedReaderProps {
  slug: string;
  lang: string;
  items: ReaderItem[];
  total: number;
  sections?: ReaderSection[];
  /** Server-computed kind counts from the initial page fetch. */
  countsByKind?: CountsByKind;
}

export function GoodDeedReader({ slug, lang, items: initialItems, total, sections: initialSections, countsByKind }: GoodDeedReaderProps) {
  const t = useTranslations('goodDeedDetail');
  const [activeKind, setActiveKind] = useState<TypeFilter>('all');

  const isFiltered = activeKind !== 'all';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['good-deeds', slug, 'quotes', { lang, kind: activeKind }] as const,
    queryFn: ({ pageParam }) =>
      getGoodDeedQuotes(slug, {
        page: pageParam as number,
        limit: 50,
        lang: lang as 'ar' | 'en',
        kind: activeKind === 'all' ? undefined : activeKind,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      (lastPage.meta as GoodDeedQuotesMeta)?.hasNext
        ? ((lastPage.meta as GoodDeedQuotesMeta).page + 1)
        : undefined,
    enabled: isFiltered,
  });

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
      intent="good-deed"
      countsByKind={countsByKind}
      onKindChange={(kind) => setActiveKind(kind)}
      loadingNextPage={isFetchingNextPage}
      hasNextPage={isFiltered ? hasNextPage : false}
      onShowMore={() => void fetchNextPage()}
      labels={labels}
    />
  );
}
