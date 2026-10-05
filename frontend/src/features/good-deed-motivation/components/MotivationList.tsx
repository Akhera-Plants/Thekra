'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useGoodDeedQuotes } from '@/features/good-deed-motivation/hooks/useGoodDeedQuotes';
import type { GoodDeedQuotesMeta, GoodDeedQuotesQuery } from '@/lib/types/api';
import type { QuoteType } from '@/lib/types/enums';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const INITIAL_PARAMS: GoodDeedQuotesQuery = { page: 1, limit: 10 };

const TYPE_KEY_MAP: Record<QuoteType, string> = {
  QURAN_VERSE: 'typeQuran',
  HADITH: 'typeHadith',
  SCHOLAR_QUOTE: 'typeScholar',
  BOOK_EXCERPT: 'typeBook',
};

interface MotivationListProps {
  goodDeedSlug: string;
}

export function MotivationList({ goodDeedSlug }: MotivationListProps) {
  const tDeed = useTranslations('goodDeedDetail');
  const tEmpty = useTranslations('emptyState');
  const tError = useTranslations('errorState');

  const [params, setParams] = useState<GoodDeedQuotesQuery>(INITIAL_PARAMS);
  const [activeType, setActiveType] = useState<QuoteType | null>(null);
  const [seed, setSeed] = useState('');

  const { data, isPending, isError, refetch } = useGoodDeedQuotes(
    goodDeedSlug,
    params,
  );
  const response = data?.data;
  const meta = data?.meta as GoodDeedQuotesMeta | undefined;
  const countsByType = meta?.countsByType ?? {};

  const statusRef = useRef<HTMLDivElement>(null);
  const itemCount = response?.items.length ?? 0;

  useEffect(() => {
    if (statusRef.current && !isPending) {
      statusRef.current.textContent = `${itemCount}`;
    }
  }, [itemCount, isPending]);

  const handleTypeFilter = useCallback((type: QuoteType | null) => {
    setActiveType(type);
    setParams((prev) => ({
      ...prev,
      type: type ? [type] : undefined,
      shuffle: undefined,
      seed: undefined,
    }));
  }, []);

  const handleAnotherMotivation = useCallback(() => {
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
  const types = Object.keys(countsByType) as QuoteType[];

  return (
    <section className="flex flex-col gap-6">
      <div ref={statusRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {types.length > 1 && (
        <ToggleGroup
          type="single"
          value={activeType ?? ''}
          onValueChange={(v) =>
            handleTypeFilter(v === '' ? null : (v as QuoteType))
          }
          className="flex flex-wrap gap-2"
        >
          <ToggleGroupItem value="" size="sm">
            {tDeed('typeAll')}
          </ToggleGroupItem>
          {types.map((type) => (
            <ToggleGroupItem key={type} value={type} size="sm">
              {tDeed(TYPE_KEY_MAP[type])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {items.length === 0 ? (
        <EmptyState message={tEmpty('noQuotes')} />
      ) : (
        <ul className="flex flex-col gap-4">
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
        <Button
          variant="outline"
          onClick={handleAnotherMotivation}
          disabled={isPending}
        >
          <RefreshCw className="size-4 me-2" aria-hidden />
          {tDeed('anotherMotivation')}
        </Button>
      </div>
    </section>
  );
}
