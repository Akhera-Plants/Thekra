'use client';

import { useTranslations } from 'next-intl';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { useQuoteSearch } from '@/features/quran-hadith-browser/hooks/useQuoteSearch';
import type { QuotesQuery } from '@/lib/types/api';

interface InfiniteQuoteListProps {
  params: QuotesQuery;
}

export function InfiniteQuoteList({ params }: InfiniteQuoteListProps) {
  const tBrowse = useTranslations('browse');
  const tError = useTranslations('errorState');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useQuoteSearch(params);

  const pages = data?.pages ?? [];
  const quotes = pages.flatMap((p) => p.data ?? []);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={tError('default')}
        retryLabel={tError('retry')}
        onRetry={() => refetch()}
      />
    );
  }

  if (quotes.length === 0) {
    return <EmptyState message={tBrowse('noResults')} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4" aria-label="quotes">
        {quotes.map((quote) => (
          <li key={quote.id}>
            <QuoteCard
              quote={quote}
              detailHref={`/quotes/${quote.id}`}
            />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage
              ? '...'
              : tBrowse('loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}
