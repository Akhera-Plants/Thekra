'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import type { QuoteCardIntent } from '@/components/shared/quote/QuoteCard';
import type { CountsByKind, QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { StudyPanel } from '@/features/study-panel/components/StudyPanel';

export interface ReaderItem {
  id: string;
  quote: QuoteDto;
  note?: string | null;
}

export interface ReaderSection {
  heading: string;
  items: ReaderItem[];
}

export type TypeFilter = 'all' | 'verse' | 'hadith' | 'athar';

const PAGE_SIZE = 10;

interface ReminderReaderProps {
  items: ReaderItem[];
  total: number;
  intent: QuoteCardIntent;
  sections?: ReaderSection[];
  /** Server-computed counts for all kinds — drives tab visibility without a client-side scan. */
  countsByKind?: CountsByKind;
  /** Called when the user switches tabs; parent fetches new items for that kind. */
  onKindChange?: (kind: TypeFilter) => void;
  /** True while the parent is fetching the next page (show more spinner). */
  loadingNextPage?: boolean;
  /** True when more pages are available for the current kind. */
  hasNextPage?: boolean;
  /** Called when the user clicks «show more»; parent fetches the next page. */
  onShowMore?: () => void;
  labels: {
    showMore: string;
    tabAll: string;
    tabVerses: string;
    tabHadith: string;
    tabAthar?: string;
    atharSection?: string;
    tabsLabel: string;
  };
}

function isAtharItem(item: ReaderItem): boolean {
  return Boolean(item.quote.isAthar);
}

function matchesFilter(item: ReaderItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'verse') return item.quote.type === QuoteType.QURAN_VERSE;
  if (filter === 'athar') return isAtharItem(item);
  // Hadith tab: prophetic hadith only — never mix athar.
  return item.quote.type === QuoteType.HADITH && !isAtharItem(item);
}

/** When the caller passes a flat list, split athar into its own section after hadith. */
function withAtharSection(
  items: ReaderItem[],
  sections: ReaderSection[] | undefined,
  atharHeading: string | undefined,
): ReaderSection[] {
  if (sections && sections.length > 0) return sections;
  if (!atharHeading) return [{ heading: '', items }];
  const athar = items.filter(isAtharItem);
  if (athar.length === 0) return [{ heading: '', items }];
  const main = items.filter((item) => !isAtharItem(item));
  return [
    ...(main.length > 0 ? [{ heading: '', items: main }] : []),
    { heading: atharHeading, items: athar },
  ];
}

/**
 * Topic reading surface: type tabs and a full-width list.
 *
 * When `countsByKind` is supplied (server counts), tabs are driven by those
 * numbers and `onKindChange` is called on tab switch so the parent can fetch
 * the correct kind.  When omitted, falls back to client-side counting (legacy).
 *
 * When `hasNextPage` / `onShowMore` are supplied, «show more» triggers a
 * network fetch; otherwise it slices locally.
 */
export function ReminderReader({
  items,
  total: _total,
  intent,
  sections,
  countsByKind,
  onKindChange,
  loadingNextPage = false,
  hasNextPage,
  onShowMore,
  labels,
}: ReminderReaderProps) {
  void _total;

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [localLoadingMore, setLocalLoadingMore] = useState(false);
  const [studyQuoteId, setStudyQuoteId] = useState<string | null>(null);

  const baseSections = useMemo(
    () => withAtharSection(items, sections, labels.atharSection),
    [items, sections, labels.atharSection],
  );

  const allItems = useMemo(
    () => baseSections.flatMap((section) => section.items),
    [baseSections],
  );

  // Use server-provided counts when available; otherwise scan loaded items.
  const verseCount = countsByKind?.verse ?? allItems.filter((item) => matchesFilter(item, 'verse')).length;
  const hadithCount = countsByKind?.hadith ?? allItems.filter((item) => matchesFilter(item, 'hadith')).length;
  const atharCount = countsByKind?.athar ?? allItems.filter((item) => matchesFilter(item, 'athar')).length;
  const allCount = countsByKind?.all ?? allItems.length;

  const activeFilter: TypeFilter =
    filter === 'verse' && verseCount === 0
      ? 'all'
      : filter === 'hadith' && hadithCount === 0
        ? 'all'
        : filter === 'athar' && atharCount === 0
          ? 'all'
          : filter;

  function changeFilter(next: TypeFilter) {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
    onKindChange?.(next);
  }

  // When kind is controlled by the parent, all loaded items match the active kind already.
  // When not controlled (legacy), filter client-side.
  const isControlled = Boolean(onKindChange);

  const filteredSections = useMemo(() => {
    if (isControlled) {
      // Items are already filtered by the parent; split into sections as-is.
      return baseSections.filter((section) => section.items.length > 0);
    }
    return baseSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => matchesFilter(item, activeFilter)),
      }))
      .filter((section) => section.items.length > 0);
  }, [baseSections, activeFilter, isControlled]);

  const filteredFlat = useMemo(
    () => filteredSections.flatMap((section) => section.items),
    [filteredSections],
  );

  // In network-controlled mode: always show everything loaded (parent pages items in).
  // In legacy mode: slice locally.
  const shownSections = useMemo(() => {
    if (isControlled) return filteredSections;
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
  }, [filteredSections, visibleCount, isControlled]);

  // «Show more» is available when:
  // - network mode: parent says there's a next page
  // - legacy mode: more items loaded than currently shown
  const canShowMore = isControlled
    ? Boolean(hasNextPage)
    : visibleCount < filteredFlat.length;

  const loadingMore = isControlled ? loadingNextPage : localLoadingMore;

  function handleShowMore() {
    if (isControlled) {
      onShowMore?.();
      return;
    }
    setLocalLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((value) => Math.min(value + PAGE_SIZE, filteredFlat.length));
      setLocalLoadingMore(false);
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
    {
      value: 'athar',
      label: labels.tabAthar ?? labels.tabHadith,
      count: atharCount,
      hidden: atharCount === 0 || !labels.tabAthar,
    },
  ];

  const studyListIds = useMemo(
    () =>
      filteredFlat
        .filter(
          (item) =>
            item.quote.type === QuoteType.QURAN_VERSE
            || item.quote.type === QuoteType.HADITH,
        )
        .map((item) => item.quote.id),
    [filteredFlat],
  );
  const studyQuote =
    studyQuoteId
      ? (allItems.find((item) => item.quote.id === studyQuoteId)?.quote ?? null)
      : null;

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
                    onOpenStudy={(quote) => setStudyQuoteId(quote.id)}
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

      <StudyPanel
        open={Boolean(studyQuote)}
        onOpenChange={(open) => {
          if (!open) setStudyQuoteId(null);
        }}
        quote={studyQuote}
        listIds={studyListIds}
        onNavigate={setStudyQuoteId}
      />
    </div>
  );
}
