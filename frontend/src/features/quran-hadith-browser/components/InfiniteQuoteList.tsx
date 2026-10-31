'use client';

import { useTranslations } from 'next-intl';
import { StaggerReveal } from '@/components/shared/StaggerReveal';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Button } from '@/components/ui/button';
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

  const pages = data?.pages ?? [];
  const firstPage = pages[0]?.data ?? [];
  const rest = pages.slice(1).flatMap((p) => p.data ?? []);
  const quotes = [...firstPage, ...rest];

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

  if (quotes.length === 0) {
    return <EmptyState message={tBrowse('noResults')} />;
  }

  return (
    <section className="flex flex-col gap-8 md:gap-9">
      <div className="flex flex-col gap-8 md:gap-9" role="list" aria-label="quotes">
        <StaggerReveal>
          {firstPage.map((quote) => (
            <div key={quote.id} role="listitem" className="min-w-0">
              <QuoteCard
                quote={quote}
                detailHref={`/quotes/${quote.id}`}
                {...favoriteProps(quote)}
              />
            </div>
          ))}
        </StaggerReveal>
        {rest.map((quote) => (
          <div key={quote.id} role="listitem" className="min-w-0">
            <QuoteCard
              quote={quote}
              detailHref={`/quotes/${quote.id}`}
              {...favoriteProps(quote)}
            />
          </div>
        ))}
      </div>
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
