'use client';

import { useMemo, useState, useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { NarrationList } from '@/components/shared/quote/NarrationList';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { ThemeChips, type ThemeChip } from '@/components/shared/editorial/ThemeChips';
import type { QuoteCardIntent } from '@/components/shared/quote/QuoteCard';
import type { CountsByKind, QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { useReadMarks } from '@/features/topic/hooks/useReadMarks';
import { useQuoteFavoriteProps } from '@/features/favorites/hooks/useQuoteFavoriteProps';
import { cn } from '@/lib/utils';

export interface ReaderItem {
  id: string;
  quote: QuoteDto;
  note?: string | null;
  /** The topic↔text link id: the reader shows that link's «وجه التذكير» (round 6, C-13). */
  linkId?: string | null;
}

/** «مقروء» filter (round 6): every text, the unread ones, or the read ones. */
export type ReadFilter = 'all' | 'unread' | 'read';

export interface ReaderSection {
  heading: string;
  items: ReaderItem[];
  /** Which list of the API page fills it, so «show more» appends to the right heading. */
  source?: 'items' | 'companion';
}

export type TypeFilter = 'all' | 'verse' | 'hadith' | 'athar';

/**
 * «الميزان» inside the tabs (owner, 2026-11-01: every text of a topic page sits under «الكل · الآيات · الأحاديث»):
 * shown first in the tab its texts belong to, never under a theme chip; the same text is not repeated in the list.
 */
export interface ReaderHighlight {
  title: string;
  lead?: string;
  items: ReaderItem[];
}

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
  /** Theme chips under the tabs (topic-themes.yaml). Omit to hide the row. */
  themes?: ThemeChip[];
  activeTheme?: string | null;
  /** Called with a key, or null for «الكل»; the parent fetches `theme=`. */
  onThemeChange?: (key: string | null) => void;
  themeLang?: 'ar' | 'en';
  /** True while the parent fetches a new filter; the current list stays, dimmed. */
  busy?: boolean;
  /** «الميزان»: first in the tab content (see {@link ReaderHighlight}). */
  highlight?: ReaderHighlight | null;
  /** More text for «الكل» only, after the highlight and before the list (a branch's explanation). */
  intro?: ReactNode;
  /**
   * The main heading over the tabs that says what these texts are for (O-05/F-04/W-05), e.g. «آيات وأحاديث تعينك على
   * هذه الطاعة». With it, the section headings and «الميزان» become its sub-headings (h3).
   */
  heading?: string;
  labels: {
    showMore: string;
    tabAll: string;
    tabVerses: string;
    tabHadith: string;
    tabAthar?: string;
    atharSection?: string;
    tabsLabel: string;
    themesLabel?: string;
    themeAll?: string;
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
  themes,
  activeTheme = null,
  onThemeChange,
  themeLang = 'ar',
  busy = false,
  highlight = null,
  intro,
  heading,
  labels,
}: ReminderReaderProps) {
  void _total;

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [localLoadingMore, setLocalLoadingMore] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const favoriteProps = useQuoteFavoriteProps();
  const reads = useReadMarks();
  const tReads = useTranslations('reads');
  const readFilterOn = reads.enabled && readFilter !== 'all';
  const passesRead = (item: ReaderItem) => !readFilterOn || reads.isRead(item.quote.id) === (readFilter === 'read');
  const listId = useId();

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

  // A theme may hold no text of the current kind, so a new theme starts on «الكل».
  function changeTheme(next: string | null) {
    if (filter !== 'all') changeFilter('all');
    onThemeChange?.(next);
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

  // «الميزان» heads the tab its texts belong to, and only without a theme chip (a theme narrows the list).
  const highlightItems = useMemo(
    () => (highlight && !activeTheme ? highlight.items.filter((item) => matchesFilter(item, activeFilter)) : []),
    [highlight, activeTheme, activeFilter],
  );
  const listSections = useMemo(() => {
    const ids = new Set(highlightItems.map((item) => item.id));
    return shownSections
      .map((section) => ({ ...section, items: section.items.filter((item) => !ids.has(item.id)) }))
      .filter((section) => section.items.length > 0);
  }, [shownSections, highlightItems]);
  // The read filter narrows what is loaded (the pages keep loading with «عرض المزيد»).
  const readSections = listSections
    .map((section) => ({ ...section, items: section.items.filter(passesRead) }))
    .filter((section) => section.items.length > 0);
  const readHighlight = highlightItems.filter(passesRead);
  const showIntro = Boolean(intro) && activeFilter === 'all' && !activeTheme;

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

  const showThemes = Boolean(themes && themes.length > 0 && onThemeChange && themes.some((theme) => theme.count > 0 || theme.key === activeTheme));
  const SectionHeading = heading ? 'h3' : 'h2';
  const renderCard = (item: ReaderItem) => (
    <QuoteCard
      quote={item.quote}
      link={item.note ? { relevanceScore: null, note: item.note } : null}
      linkId={item.linkId ?? null}
      detailHref={`/quotes/${item.quote.id}`}
      intent={intent}
      clamp
      read={reads.enabled ? reads.isRead(item.quote.id) : undefined}
      onToggleRead={reads.enabled ? (value) => reads.setRead(item.quote.id, value) : undefined}
      {...favoriteProps(item.quote)}
    />
  );

  return (
    <section
      aria-labelledby={heading ? `${listId}-heading` : undefined}
      className="flex w-full min-w-0 flex-col gap-8"
    >
      <div className="flex min-w-0 flex-col gap-3">
        {heading ? (
          <h2 id={`${listId}-heading`} className="font-arabic-display text-[24px] font-semibold leading-snug md:text-[28px]">
            {heading}
          </h2>
        ) : null}
        <SegmentTabs
          aria-label={labels.tabsLabel}
          controls={listId}
          items={tabItems}
          value={activeFilter}
          onValueChange={(value) => changeFilter(value as TypeFilter)}
          variant="segment"
          size="filled"
          // Long English labels («Sayings of the Salaf») do not fit four-up on a phone: tabs keep
          // their text width and the track scrolls from its start edge instead of overlapping.
          className={cn(
            'min-w-0 w-full [&_[data-slot=tabs-list]]:w-full sm:[&_[data-slot=tabs-list]]:w-fit',
            // justify-start: a centred row that overflows would cut its first tab off unreachably.
            '[&_[data-slot=tabs-list]]:justify-start [&_[data-slot=tabs-list]]:overflow-x-auto [&_[data-slot=tabs-list]]:overscroll-x-contain [&_[data-slot=tabs-list]]:[scrollbar-width:none]',
            '[&_[data-slot=tabs-trigger]]:min-w-fit',
          )}
          listClassName="w-full sm:w-fit"
        />
        {/* Owner round 7 (B2): the theme chips and the read filter are one group, parted by a bold green bar; the group
            wraps on a phone (the bar stays with the read filter). Without chips the read filter stands alone. */}
        {showThemes || reads.enabled ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            {showThemes ? (
              <ThemeChips
                themes={themes!}
                value={activeTheme}
                onValueChange={changeTheme}
                allLabel={labels.themeAll ?? labels.tabAll}
                label={labels.themesLabel ?? labels.tabsLabel}
                lang={themeLang}
                className="flex-wrap overflow-visible py-0"
              />
            ) : null}
            {reads.enabled ? (
              <div className="flex shrink-0 items-center gap-3">
                {showThemes ? <span aria-hidden className="h-8 w-[3px] shrink-0 rounded-full bg-primary" /> : null}
                <SegmentTabs
                  aria-label={tReads('filterLabel')}
                  controls={listId}
                  items={[
                    { value: 'all', label: tReads('all') },
                    { value: 'unread', label: tReads('unread') },
                    { value: 'read', label: tReads('read') },
                  ]}
                  value={readFilter}
                  onValueChange={(value) => setReadFilter(value as ReadFilter)}
                  className="w-auto"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        id={listId}
        role="tabpanel"
        aria-label={labels.tabsLabel}
        aria-busy={busy || undefined}
        className="flex flex-col gap-8 transition-opacity duration-150 md:gap-9 aria-busy:opacity-60"
      >
        {highlight && readHighlight.length > 0 ? (
          <section aria-labelledby={`${listId}-mizan`} className="flex flex-col gap-3">
            <SectionHeading id={`${listId}-mizan`} className="font-arabic-display text-[20px] font-semibold md:text-[22px]">
              {highlight.title}
            </SectionHeading>
            {highlight.lead ? <p className="-mt-1 text-sm leading-7 text-muted-foreground">{highlight.lead}</p> : null}
            <NarrationList items={readHighlight} renderItem={(item) => renderCard({ ...item, note: null })} />
          </section>
        ) : null}
        {showIntro ? intro : null}
        {readFilterOn && readSections.length === 0 && readHighlight.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{readFilter === 'read' ? tReads('noneRead') : tReads('noneUnread')}</p>
        ) : null}
        {readSections.map((section) => (
          <section key={section.heading || 'texts'} className="flex flex-col gap-8 md:gap-9">
            {section.heading ? (
              <SectionHeading className="font-arabic-display text-[20px] font-semibold md:text-[22px]">
                {section.heading}
              </SectionHeading>
            ) : null}
            <NarrationList items={section.items} renderItem={renderCard} />
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

    </section>
  );
}
