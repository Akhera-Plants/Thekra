'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Button } from '@/components/shared/kit/button';
import { NarrationList } from '@/components/shared/quote/NarrationList';
import { useQuoteSearch } from '@/features/quran-hadith-browser/hooks/useQuoteSearch';
import { useQuoteFavoriteProps } from '@/features/favorites/hooks/useQuoteFavoriteProps';
import type { QuotesQuery } from '@/lib/types/api';

interface InfiniteQuoteListProps {
  params: QuotesQuery;
}

export function InfiniteQuoteList({ params }: InfiniteQuoteListProps) {
  const tBrowse = useTranslations('browse');
  const favoriteProps = useQuoteFavoriteProps();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    error,
    refetch,
  } = useQuoteSearch(params);

  const items = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data ?? []).map((quote) => ({ id: quote.id, quote })),
    [data],
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-8 md:gap-9">
        {Array.from({ length: 5 }).map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState message={tBrowse('noResults')} />;
  }

  return (
    <section className="flex flex-col gap-8 md:gap-9">
      {/* Narrations of the same text show once, the others under «وروي بألفاظ أخرى» (W-08). */}
      <NarrationList
        aria-label={tBrowse('listLabel')}
        items={items}
        renderItem={({ quote }) => (
          <QuoteCard quote={quote} detailHref={`/quotes/${quote.id}`} clamp {...favoriteProps(quote)} />
        )}
      />
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button variant="outline" tone="neutral" size="md" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {tBrowse('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
