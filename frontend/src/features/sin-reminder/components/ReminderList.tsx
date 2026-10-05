'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useSinQuotes } from '@/features/sin-reminder/hooks/useSinQuotes';
import type { SinQuotesMeta, SinQuotesQuery } from '@/lib/types/api';
import type { QuoteType } from '@/lib/types/enums';
import { AlternativeDeedsBlock } from './AlternativeDeedsBlock';
import { AnotherReminderButton } from './AnotherReminderButton';
import { ReminderTypeFilter } from './ReminderTypeFilter';

const INITIAL_PARAMS: SinQuotesQuery = { page: 1, limit: 10 };

interface ReminderListProps {
  sinSlug: string;
}

/**
 * Interactive reminder list for a sin detail page.
 * Handles type filter, shuffle ("another reminder"), and live region.
 * HydrationBoundary on the server paints the first page with no spinner.
 */
export function ReminderList({ sinSlug }: ReminderListProps) {
  const tSin = useTranslations('sinDetail');
  const tEmpty = useTranslations('emptyState');
  const tError = useTranslations('errorState');

  const [params, setParams] = useState<SinQuotesQuery>(INITIAL_PARAMS);
  const [activeType, setActiveType] = useState<QuoteType | null>(null);
  const [seed, setSeed] = useState<string>('');

  const { data, isPending, isError, refetch } = useSinQuotes(sinSlug, params);
  const response = data?.data;
  const meta = data?.meta as SinQuotesMeta | undefined;

  const statusRef = useRef<HTMLDivElement>(null);
  const itemCount = response?.items.length ?? 0;

  // Announce list changes to screen readers
  useEffect(() => {
    if (statusRef.current && !isPending) {
      statusRef.current.textContent = `${itemCount}`;
    }
  }, [itemCount, isPending]);

  const handleTypeFilter = useCallback(
    (type: QuoteType | null) => {
      setActiveType(type);
      setParams((prev) => ({
        ...prev,
        type: type ? [type] : undefined,
        shuffle: undefined,
        seed: undefined,
      }));
    },
    [],
  );

  const handleAnotherReminder = useCallback(() => {
    const newSeed = Date.now().toString(36);
    setSeed(newSeed);
    setParams((prev) => ({ ...prev, shuffle: true, seed: newSeed }));
  }, []);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
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

  const items = response?.items ?? [];
  const alternatives = response?.alternatives ?? [];
  const countsByType = meta?.countsByType ?? {};

  return (
    <section aria-labelledby="reminder-list-heading" className="flex flex-col gap-6">
      {/* Accessible status region */}
      <div ref={statusRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {Object.keys(countsByType).length > 1 && (
        <ReminderTypeFilter
          countsByType={countsByType}
          selected={activeType}
          onSelect={handleTypeFilter}
        />
      )}

      {items.length === 0 ? (
        <EmptyState message={tEmpty('noQuotes')} />
      ) : (
        <ul className="flex flex-col gap-4" aria-label={tSin('noReminders')}>
          {items.map(({ link, quote }) => (
            <li key={`${quote.id}-${seed}`}>
              <QuoteCard
                quote={quote}
                link={link}
                detailHref={`/quotes/${quote.id}`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-center">
        <AnotherReminderButton
          onClick={handleAnotherReminder}
          isPending={isPending}
        />
      </div>

      <AlternativeDeedsBlock
        alternatives={alternatives}
        heading={tSin('alternativesHeading')}
      />
    </section>
  );
}
