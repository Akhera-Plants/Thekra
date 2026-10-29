/**
 * Browse, after the website's browse page: the title, a search field, the «الكل · القرآن · الحديث» segment, then the
 * quote cards in one virtualized list. The header lives in the list so it scrolls with the cards and the search
 * field keeps focus while results load; loading, empty and error show in place of the cards.
 */

import React, { memo, useCallback, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react-native';
import { useQuotesInfinite } from '@/lib/api/quotes';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { EmptyState, ErrorState, Field, PageHeader, QuoteCardSkeleton, Screen, SegmentTabs, type SegmentItem } from '@/ui';
import type { QuoteDto } from '@/lib/types/api';
import type { QuoteType } from '@/lib/types/enums';

type TypeFilter = QuoteType | 'ALL';

const QUOTE_TYPE_FILTERS: Array<{ key: TypeFilter; labelKey: string }> = [
  { key: 'ALL', labelKey: 'browse.tabAll' },
  { key: 'QURAN_VERSE', labelKey: 'browse.tabQuran' },
  { key: 'HADITH', labelKey: 'browse.tabHadith' },
];

const SKELETON_COUNT = 3;

const makeStyles = (t: Theme) => ({
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.lg, paddingBottom: space.xl },
  gap: { height: space.lg },
  skeletons: { gap: space.lg },
  footer: { paddingTop: space.lg },
  fill: { backgroundColor: t.colors.background },
});

/** One row: a component, so the favorite hook runs under React's rules (never inside `renderItem` itself). */
const QuoteItem = memo(function QuoteItem({ quote }: { quote: QuoteDto }) {
  const { isFavorite, toggle } = useToggleFavorite(quote.id);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
});

const renderQuote: ListRenderItem<QuoteDto> = ({ item }) => <QuoteItem quote={item} />;
const keyOf = (item: QuoteDto) => item.id;

function Gap() {
  const styles = useStyles(makeStyles);
  return <View style={styles.gap} />;
}

export default function BrowseScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [isPulling, setIsPulling] = useState(false);

  const params = {
    q: search.length > 1 ? search : undefined,
    type: typeFilter !== 'ALL' ? ([typeFilter] as QuoteType[]) : undefined,
    limit: 20,
  };

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useQuotesInfinite(params);

  const allQuotes = data?.pages.flatMap((p) => p.data) ?? [];

  const segments: SegmentItem<TypeFilter>[] = QUOTE_TYPE_FILTERS.map((f) => ({ key: f.key, label: t(f.labelKey) }));

  const handleRefresh = useCallback(async () => {
    setIsPulling(true);
    try {
      await refetch();
    } finally {
      setIsPulling(false);
    }
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const header = (
    <View style={styles.header}>
      <PageHeader title={t('browse.title')} />
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder={t('browse.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      <SegmentTabs items={segments} value={typeFilter} onChange={setTypeFilter} />
    </View>
  );

  const empty = isError ? (
    <ErrorState
      message={error instanceof Error ? error.message : t('errors.unknown')}
      onRetry={() => void refetch()}
    />
  ) : isLoading ? (
    <View style={styles.skeletons}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <QuoteCardSkeleton key={`skeleton-${i}`} />
      ))}
    </View>
  ) : (
    <EmptyState icon={SearchX} message={t('browse.empty')} />
  );

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={isError ? [] : allQuotes}
        keyExtractor={keyOf}
        renderItem={renderQuote}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Gap}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <QuoteCardSkeleton />
            </View>
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.fill}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isPulling}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      />
    </Screen>
  );
}
