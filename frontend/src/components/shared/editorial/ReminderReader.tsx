'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import type { QuoteCardIntent } from '@/components/shared/quote/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';

export interface ReaderItem {
  id: string;
  quote: QuoteDto;
  note?: string | null;
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
    showMore: string;
    tabAll: string;
    tabVerses: string;
    tabHadith: string;
    tabsLabel: string;
  };
}

function matchesFilter(item: ReaderItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'verse') return item.quote.type === QuoteType.QURAN_VERSE;
  return item.quote.type === QuoteType.HADITH;
}

function countOf(items: ReaderItem[], filter: TypeFilter): number {
  return items.filter((item) => matchesFilter(item, filter)).length;
}

/**
 * Topic reading surface: type tabs and a full-width list (10 at a time).
 */
export function ReminderReader({
  items,
  total: _total,
  intent,
  sections,
  labels,
}: ReminderReaderProps) {
  void _total;

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <SegmentTabs
        aria-label={labels.tabsLabel}
        items={tabItems}
        value={activeFilter}
        onValueChange={(value) => changeFilter(value as TypeFilter)}
        variant="segment"
        size="filled"
        className="min-w-0 w-full [&_[data-slot=tabs-list]]:w-full sm:[&_[data-slot=tabs-list]]:w-fit"
        listClassName="w-full sm:w-fit"
      />

      <div className="flex flex-col gap-8 md:gap-9">
        {shownSections.map((section) => (
          <section key={section.heading || 'texts'} className="flex flex-col gap-8 md:gap-9">
            {section.heading ? (
              <h2 className="font-arabic-display text-[22px] font-semibold md:text-[26px]">
                {section.heading}
              </h2>
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
