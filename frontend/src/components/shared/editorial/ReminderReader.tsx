'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  X,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import type { QuoteCardIntent } from '@/components/shared/quote/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { cn } from '@/lib/utils';

export interface ReaderItem {
  id: string;
  quote: QuoteDto;
  note?: string | null;
  reviewLabel?: string | null;
}

export interface ReaderSection {
  heading: string;
  items: ReaderItem[];
}

type TypeFilter = 'all' | 'verse' | 'hadith';

const PAGE_SIZE = 10;

interface ReminderReaderProps {
  items: ReaderItem[];
  total: number;
  intent: QuoteCardIntent;
  sections?: ReaderSection[];
  labels: {
    another: string;
    previous: string;
    next: string;
    showMore: string;
    of: string;
    tabAll: string;
    tabVerses: string;
    tabHadith: string;
    tabsLabel: string;
    closeHighlight: string;
  };
  /** Fetches a different accepted reminder. Omitted when the route has no shuffle API. */
  onAnother?: () => Promise<ReaderItem | null>;
}

function ReviewLine({ label }: { label?: string | null }) {
  if (!label) return null;
  return <p className="pb-2 text-xs text-muted-foreground">{label}</p>;
}

function matchesFilter(item: ReaderItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'verse') return item.quote.type === QuoteType.QURAN_VERSE;
  return item.quote.type === QuoteType.HADITH;
}

function countOf(items: ReaderItem[], filter: TypeFilter): number {
  return items.filter((item) => matchesFilter(item, filter)).length;
}

function intentTone(intent: QuoteCardIntent): 'sin' | 'deed' | 'branch' {
  if (intent === 'sin') return 'sin';
  if (intent === 'good-deed') return 'deed';
  return 'branch';
}

/**
 * Topic reading surface: type tabs, a full-width list (10 at a time),
 * and an optional highlighted shuffle card with prev/next.
 */
export function ReminderReader({
  items,
  total: _total,
  intent,
  sections,
  labels,
  onAnother,
}: ReminderReaderProps) {
  void _total;
  const locale = useLocale();
  const tone = intentTone(intent);

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [shufflePending, setShufflePending] = useState(false);
  const [highlight, setHighlight] = useState<ReaderItem | null>(null);
  const [highlightTrail, setHighlightTrail] = useState<ReaderItem[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const allItems = useMemo(() => {
    if (sections && sections.length > 0) {
      return sections.flatMap((section) => section.items);
    }
    return items;
  }, [items, sections]);

  const verseCount = countOf(allItems, 'verse');
  const hadithCount = countOf(allItems, 'hadith');
  const allCount = allItems.length;
  const activeFilter: TypeFilter =
    filter === 'verse' && verseCount === 0
      ? 'all'
      : filter === 'hadith' && hadithCount === 0
        ? 'all'
        : filter;

  function changeFilter(next: TypeFilter) {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  const filteredSections = useMemo(() => {
    const source =
      sections && sections.length > 0
        ? sections
        : [{ heading: '', items: allItems }];
    return source
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => matchesFilter(item, activeFilter)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, allItems, activeFilter]);

  const filteredFlat = useMemo(
    () => filteredSections.flatMap((section) => section.items),
    [filteredSections],
  );

  const shownSections = useMemo(() => {
    let remaining = visibleCount;
    const result: ReaderSection[] = [];
    for (const section of filteredSections) {
      if (remaining <= 0) break;
      const slice = section.items.slice(0, remaining);
      if (slice.length === 0) continue;
      result.push({ heading: section.heading, items: slice });
      remaining -= slice.length;
    }
    return result;
  }, [filteredSections, visibleCount]);

  const canShowMore = visibleCount < filteredFlat.length;
  const activeHighlight = highlightTrail[highlightIndex] ?? highlight;

  async function handleAnother() {
    if (!onAnother || shufflePending) return;
    setShufflePending(true);
    try {
      const next = await onAnother();
      if (process.env.NODE_ENV !== 'production') {
        console.info('[reader] shuffle result', next?.id ?? null);
      }
      if (!next) return;
      setHighlight(next);
      setHighlightTrail((previous) => {
        const without = previous.filter((item) => item.id !== next.id);
        const nextTrail = [...without, next];
        setHighlightIndex(nextTrail.length - 1);
        return nextTrail;
      });
    } finally {
      setShufflePending(false);
    }
  }

  function closeHighlight() {
    setHighlight(null);
    setHighlightTrail([]);
    setHighlightIndex(0);
  }

  function stepHighlight(direction: -1 | 1) {
    setHighlightIndex((value) => {
      const next = value + direction;
      if (next < 0 || next >= highlightTrail.length) return value;
      return next;
    });
  }

  function handleShowMore() {
    setLoadingMore(true);
    // Keep the loading affordance visible for a beat so the press feels answered.
    window.setTimeout(() => {
      setVisibleCount((value) => Math.min(value + PAGE_SIZE, filteredFlat.length));
      setLoadingMore(false);
    }, 180);
  }

  const tabItems = [
    {
      value: 'all',
      label: labels.tabAll,
      count: allCount,
    },
    {
      value: 'verse',
      label: labels.tabVerses,
      count: verseCount,
      hidden: verseCount === 0,
    },
    {
      value: 'hadith',
      label: labels.tabHadith,
      count: hadithCount,
      hidden: hadithCount === 0,
    },
  ];

  const shuffleButton = onAnother ? (
    <Button
      type="button"
      variant="outline"
      tone={tone}
      size="md"
      loading={shufflePending}
      icon={<Shuffle aria-hidden />}
      iconPosition="start"
      onClick={() => void handleAnother()}
      className="w-full justify-center sm:w-auto"
    >
      {labels.another}
    </Button>
  ) : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <SegmentTabs
          aria-label={labels.tabsLabel}
          items={tabItems}
          value={activeFilter}
          onValueChange={(value) => changeFilter(value as TypeFilter)}
          variant="segment"
          size="filled"
          className="min-w-0 w-full flex-1 sm:w-auto sm:flex-none [&_[data-slot=tabs-list]]:w-full sm:[&_[data-slot=tabs-list]]:w-fit"
          listClassName="w-full sm:w-fit"
        />
        {shuffleButton ? (
          <div className="w-full shrink-0 sm:w-auto">{shuffleButton}</div>
        ) : null}
      </div>

      {activeHighlight ? (
        <div
          role="region"
          aria-label={labels.another}
          className={cn(
            'reader-turn relative flex flex-col gap-3 rounded-xl border border-border p-4 ring-1',
            intent === 'sin' &&
              'bg-[color-mix(in_oklch,var(--intent-sin)_12%,var(--card))] ring-intent-sin/35',
            intent === 'good-deed' &&
              'bg-[color-mix(in_oklch,var(--intent-good-deed)_12%,var(--card))] ring-intent-good-deed/35',
            intent === 'iman-branch' &&
              'bg-[color-mix(in_oklch,var(--intent-iman-branch)_12%,var(--card))] ring-intent-iman-branch/35',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                disabled={highlightIndex <= 0}
                aria-label={labels.previous}
                icon={
                  locale === 'ar' ? (
                    <ChevronRight aria-hidden />
                  ) : (
                    <ChevronLeft aria-hidden />
                  )
                }
                onClick={() => stepHighlight(-1)}
              />
              <p className="px-1 text-sm text-muted-foreground tabular-nums">
                <FormattedNumber value={highlightIndex + 1} />
                <span className="px-1">{labels.of}</span>
                <FormattedNumber value={highlightTrail.length} />
              </p>
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                iconOnly
                disabled={highlightIndex >= highlightTrail.length - 1}
                aria-label={labels.next}
                icon={
                  locale === 'ar' ? (
                    <ChevronLeft aria-hidden />
                  ) : (
                    <ChevronRight aria-hidden />
                  )
                }
                onClick={() => stepHighlight(1)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              tone="neutral"
              size="sm"
              iconOnly
              aria-label={labels.closeHighlight}
              icon={<X aria-hidden />}
              onClick={closeHighlight}
            />
          </div>
          <QuoteCard
            quote={activeHighlight.quote}
            link={
              activeHighlight.note
                ? { relevanceScore: null, note: activeHighlight.note }
                : null
            }
            detailHref={`/quotes/${activeHighlight.quote.id}`}
            intent={intent}
            density="full"
          />
          <ReviewLine label={activeHighlight.reviewLabel} />
        </div>
      ) : null}

      <div className="flex flex-col gap-8 md:gap-9">
        {shownSections.map((section) => (
          <section key={section.heading || 'texts'} className="flex flex-col gap-8 md:gap-9">
            {section.heading ? (
              <h2 className="font-arabic-display text-2xl">{section.heading}</h2>
            ) : null}
            <ul className="flex flex-col gap-8 md:gap-9">
              {section.items.map((item) => (
                <li key={`${section.heading}-${item.id}`}>
                  <QuoteCard
                    quote={item.quote}
                    link={item.note ? { relevanceScore: null, note: item.note } : null}
                    detailHref={`/quotes/${item.quote.id}`}
                    intent={intent}
                  />
                  <ReviewLine label={item.reviewLabel} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canShowMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            tone="neutral"
            size="md"
            loading={loadingMore}
            icon={<ChevronDown aria-hidden />}
            iconPosition="end"
            onClick={handleShowMore}
          >
            {labels.showMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
