/**
 * Quotes for a feeling, after the website's feelings page: the feeling's name as the page title, then the quote
 * cards. The way in when the user cannot name a sin (mobile-plan §3, emotion entry).
 */

import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuotesInfinite } from '@/lib/api/quotes';
import { useTag } from '@/lib/api/tags';
import { useToggleFavorite } from '@/lib/api/favorites';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteCard } from '@/components/QuoteCard';
import { GUTTER, space, useStyles, useTheme } from '@/theme';
import { EmptyState, ErrorState, PageHeader, QuoteCardSkeleton, Screen, Skeleton } from '@/ui';

const LOADING_CARDS = ['q1', 'q2', 'q3'];
const keyExtractor = (item: QuoteDto) => item.id;

const makeStyles = () => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { paddingBottom: space['2xl'] },
  gap: { height: space.lg },
  stack: { gap: space.lg },
  footer: { paddingTop: space.lg },
});

/** One row: a component, so the favorite hook runs under React's rules (never inside `renderItem` itself). */
const QuoteItem = memo(function QuoteItem({ quote }: { quote: QuoteDto }) {
  const { isFavorite, toggle } = useToggleFavorite(quote.id);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
});

function CardGap() {
  const styles = useStyles(makeStyles);
  return <View style={styles.gap} />;
}

const renderItem: ListRenderItem<QuoteDto> = ({ item }) => <QuoteItem quote={item} />;

export default function FeelingsScreen() {
  const { tagSlug } = useLocalSearchParams<{ tagSlug: string }>();
  const { t } = useTranslation();
  const { english, colors } = useTheme();
  const styles = useStyles(makeStyles);

  const { data: tag, isLoading: tagLoading } = useTag(tagSlug ?? '');

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    isFetchNextPageError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useQuotesInfinite({
    tag: tagSlug ? [tagSlug] : undefined,
    limit: 20,
  });

  const allQuotes = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const handleRefresh = useCallback(() => void refetch(), [refetch]);
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const tagName = english ? tag?.name || tag?.nameAr : tag?.nameAr || tag?.name;

  const header = (
    <View style={styles.header}>
      {tagLoading ? (
        <Skeleton width="60%" height={30} />
      ) : (
        <PageHeader title={tagName || t('feelings.title')} />
      )}
    </View>
  );

  const empty = isLoading ? (
    <View style={styles.stack}>
      {LOADING_CARDS.map((key) => (
        <QuoteCardSkeleton key={key} />
      ))}
    </View>
  ) : isError ? (
    <ErrorState onRetry={handleRefresh} />
  ) : (
    <EmptyState message={t('feelings.empty')} />
  );

  const footer = isFetchingNextPage ? (
    <View style={styles.footer}>
      <QuoteCardSkeleton />
    </View>
  ) : isFetchNextPageError ? (
    <View style={styles.footer}>
      <ErrorState onRetry={() => void fetchNextPage()} />
    </View>
  ) : null;

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <FlatList
        data={isLoading ? [] : allQuotes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={CardGap}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
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
