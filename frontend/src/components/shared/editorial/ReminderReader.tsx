'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import type { QuoteCardIntent } from '@/components/shared/quote/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { cn } from '@/lib/utils';

export interface ReaderItem {
  id: string;
  quote: QuoteDto;
  note?: string | null;
}

interface ReminderReaderProps {
  items: ReaderItem[];
  total: number;
  intent: QuoteCardIntent;
  labels: {
    another: string;
    previous: string;
    next: string;
    showAll: string;
    showOne: string;
    of: string;
  };
  /** Fetches a different accepted reminder. Omitted when the route has no shuffle API. */
  onAnother?: () => Promise<ReaderItem | null>;
}

/**
 * One reminder in a page frame, the way a book shows one passage.
 * «عرض الكل» opens the same set as a list.
 */
export function ReminderReader({
  items,
  total,
  intent,
  labels,
  onAnother,
}: ReminderReaderProps) {
  const [list, setList] = useState(items);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false);
  const current = list[index];

  if (!current) return null;

  async function handleAnother() {
    if (!onAnother || pending) return;
    setPending(true);
    try {
      const next = await onAnother();
      if (!next) return;
      setList((previous) => {
        const without = previous.filter((item) => item.id !== next.id);
        const inserted = [...without];
        inserted.splice(index, 0, next);
        return inserted;
      });
    } finally {
      setPending(false);
    }
  }

  if (showAll) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="self-start border-b border-border pb-1 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.showOne}
        </button>
        <ul className="flex flex-col">
          {list.map((item) => (
            <li key={item.id}>
              <QuoteCard
                quote={item.quote}
                link={item.note ? { relevanceScore: null, note: item.note } : null}
                detailHref={`/quotes/${item.quote.id}`}
                intent={intent}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div key={current.id} className="reader-turn">
        <QuoteCard
          quote={current.quote}
          link={current.note ? { relevanceScore: null, note: current.note } : null}
          detailHref={`/quotes/${current.quote.id}`}
          intent={intent}
          density="full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={index === 0}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground enabled:hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4 ltr:hidden" aria-hidden />
          <ChevronLeft className="hidden size-4 ltr:block" aria-hidden />
          {labels.previous}
        </button>

        <p className="text-sm text-muted-foreground">
          <FormattedNumber value={index + 1} />
          <span className="px-1">{labels.of}</span>
          <FormattedNumber value={total} />
        </p>

        <button
          type="button"
          onClick={() => setIndex((value) => Math.min(list.length - 1, value + 1))}
          disabled={index >= list.length - 1}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground enabled:hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.next}
          <ChevronLeft className="size-4 ltr:hidden" aria-hidden />
          <ChevronRight className="hidden size-4 ltr:block" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        {onAnother && (
          <button
            type="button"
            onClick={handleAnother}
            disabled={pending}
            className={cn(
              'min-h-11 border-b-2 border-foreground pb-1 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              intent === 'sin' && 'border-intent-sin',
              intent === 'good-deed' && 'border-intent-good-deed',
              intent === 'iman-branch' && 'border-intent-iman-branch',
            )}
          >
            {labels.another}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.showAll}
        </button>
      </div>
    </div>
  );
}
