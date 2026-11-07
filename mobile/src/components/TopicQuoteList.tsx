/**
 * The quote list of one topic (a sin's reminders, a good deed's motivations, a branch), after the website's topic
 * pages: the page header (with short `meta` lines such as «كبيرة»), then the type filter right under it (SegmentTabs
 * with the counts read under «الكل»), then everything of the tab: the page's own top part (`intro`: its one action,
 * the reward…), the reading sections with their headings (see `buildTopicSections`) and `footer`. Owner, 2026-11-01:
 * no text above the tabs. The API's reading order is kept: no shuffle (owner rule, PROJECT_GUIDE §6).
 * The screen owns the query; this renders its states (skeletons, error, empty, refresh, next page).
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, View, type SectionListRenderItem } from 'react-native';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToggleFavorite } from '@/lib/api/favorites';
import type { TopicSection } from '@/lib/topics';
import type { QuoteDto } from '@/lib/types/api';
import type { QuoteType } from '@/lib/types/enums';
import { QuoteCard } from '@/components/QuoteCard';
import { GUTTER, space, useStyles, useTheme } from '@/theme';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  QuoteCardSkeleton,
  Screen,
  SegmentTabs,
  Skeleton,
  Text,
  type SegmentItem,
} from '@/ui';

export type TopicFilter = QuoteType | 'ALL';

const FILTERS: Array<{ key: TopicFilter; labelKey: string }> = [
  { key: 'ALL', labelKey: 'reminders.filterAll' },
  { key: 'QURAN_VERSE', labelKey: 'reminders.filterVerses' },
  { key: 'HADITH', labelKey: 'reminders.filterHadith' },
  { key: 'SCHOLAR_QUOTE', labelKey: 'reminders.filterScholar' },
  { key: 'BOOK_EXCERPT', labelKey: 'reminders.filterBook' },
];

const LOADING_CARDS = ['q1', 'q2', 'q3'];
const PAGE_SIZE = 10;

type TopicQueryState = Pick<
  UseInfiniteQueryResult,
  'isLoading' | 'isError' | 'isRefetching' | 'isFetchNextPageError' | 'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage' | 'refetch'
>;

/** The type filter of a topic page and the request params it gives. */
export function useTopicQuoteParams() {
  const [filter, setFilter] = useState<TopicFilter>('ALL');
  const params = { type: filter !== 'ALL' ? [filter] : undefined, limit: PAGE_SIZE };
  return { filter, setFilter, params };
}

/** The last defined value: keeps the title and the tab counts in place while a new filter loads. */
export function useLastDefined<T>(value: T | undefined): T | undefined {
  const [kept, setKept] = useState(value);
  if (value !== undefined && value !== kept) setKept(value);
  return value ?? kept;
}

interface TopicQuoteListProps {
  query: TopicQueryState;
  sections: TopicSection[];
  /** Counts per type from the response read under «الكل». */
  counts?: Partial<Record<QuoteType, number>>;
  filter: TopicFilter;
  onFilterChange: (filter: TopicFilter) => void;
  eyebrow: string;
  /** Null while the topic itself is loading. */
  title: string | null;
  lead?: string | null;
  /** Short lines about the topic in the title block («كبيرة · …», «موضوع معاصر»), never a text. */
  meta?: React.ReactNode;
  emptyMessage: string;
  /** The page's ONE primary action, on the title's line (owner round 5, F-10 a / A-07): a `sm` Button. */
  titleAction?: React.ReactNode;
  /** The top of the tab's content, under the tabs (a secondary action, the reward…). */
  intro?: React.ReactNode;
  footer?: React.ReactNode;
}

const makeStyles = () => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.xl, paddingBottom: space.lg },
  intro: { gap: space['2xl'], paddingTop: space.xs },
  headerSkeleton: { gap: space.md },
  gap: { height: space.lg },
  sectionTitle: { paddingTop: space.lg, paddingBottom: space.lg },
  stack: { gap: space.lg },
  footer: { gap: space['2xl'], paddingTop: space.lg },
});

/** One row: a component, so the favorite hook runs under React's rules (never inside `renderItem` itself). */
const QuoteItem = memo(function QuoteItem({ quote, linkNote }: { quote: QuoteDto; linkNote?: string }) {
  const { isFavorite, toggle } = useToggleFavorite(quote.id);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} linkNote={linkNote} />;
});

function CardGap() {
  const styles = useStyles(makeStyles);
  return <View style={styles.gap} />;
}

function SectionTitle({ section }: { section: TopicSection }) {
  const styles = useStyles(makeStyles);
  if (!section.title) return null;
  return (
    <Text variant="title" accessibilityRole="header" style={styles.sectionTitle}>
      {section.title}
    </Text>
  );
}

const keyExtractor = (quote: QuoteDto) => quote.id;
const renderItem: SectionListRenderItem<QuoteDto, TopicSection> = ({ item, section }) => (
  <QuoteItem quote={item} linkNote={section.notes[item.id]} />
);
const renderSectionHeader = ({ section }: { section: TopicSection }) => <SectionTitle section={section} />;

export function TopicQuoteList({
  query,
  sections,
  counts,
  filter,
  onFilterChange,
  eyebrow,
  title,
  lead,
  meta,
  emptyMessage,
  titleAction,
  intro,
  footer,
}: TopicQuoteListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isLoading, isError, isRefetching, isFetchNextPageError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;

  const tabs = useMemo<SegmentItem<TopicFilter>[]>(() => {
    const total = counts ? Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) : undefined;
    // Counts that cover nothing (a contemporary topic whose texts come from derived topics) prove nothing: every tab
    // stays, without numbers.
    const known = counts !== undefined && (total ?? 0) > 0;
    return FILTERS.filter((f) => f.key === 'ALL' || f.key === filter || !known || (counts?.[f.key] ?? 0) > 0).map((f) => ({
      key: f.key,
      label: t(f.labelKey),
      count: known ? (f.key === 'ALL' ? total : counts?.[f.key]) : undefined,
    }));
  }, [counts, filter, t]);
  // The type tabs are on every topic page (owner round 3, item 2), contemporary topics included.
  const showTabs = tabs.length > 1;

  const handleRefresh = useCallback(() => void refetch(), [refetch]);
  const handleRetryMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const header = title ? (
    <View style={styles.header}>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead ?? undefined} action={titleAction}>
        {meta}
      </PageHeader>
      {showTabs ? <SegmentTabs items={tabs} value={filter} onChange={onFilterChange} /> : null}
      {intro ? <View style={styles.intro}>{intro}</View> : null}
    </View>
  ) : isLoading ? (
    <View style={[styles.header, styles.headerSkeleton]}>
      <Skeleton width={120} height={14} />
      <Skeleton width="70%" height={30} />
      <Skeleton width="90%" height={14} />
    </View>
  ) : null;

  const empty = isLoading ? (
    <View style={styles.stack}>
      {LOADING_CARDS.map((key) => (
        <QuoteCardSkeleton key={key} />
      ))}
    </View>
  ) : isError ? (
    <ErrorState onRetry={handleRefresh} />
  ) : (
    <EmptyState message={emptyMessage} />
  );

  const listFooter = (
    <View style={styles.footer}>
      {isFetchingNextPage ? <QuoteCardSkeleton /> : null}
      {isFetchNextPageError ? <ErrorState onRetry={handleRetryMore} /> : null}
      {footer}
    </View>
  );

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <SectionList
        sections={isLoading ? [] : sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={CardGap}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={listFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </Screen>
  );
}
