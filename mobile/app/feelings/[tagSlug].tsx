/**
 * Emotion entry — enter from a feeling when the user cannot name a sin.
 * mobile-plan §3 (Emotion entry screen).
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuotesInfinite } from '@/lib/api/quotes';
import { useTag } from '@/lib/api/tags';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Spacing } from '@/lib/tokens';

function QuoteItem({ quoteId, quote }: { quoteId: string; quote: any }) {
  const { isFavorite, toggle } = useToggleFavorite(quoteId);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
}

export default function FeelingsScreen() {
  const { tagSlug } = useLocalSearchParams<{ tagSlug: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const { data: tag } = useTag(tagSlug ?? '');

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useQuotesInfinite({
    tag: tagSlug ? [tagSlug] : undefined,
    limit: 20,
  });

  const allQuotes = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t('errors.unknown')}
        onRetry={() => void refetch()}
      />
    );
  }

  const tagLabel = isAr ? (tag?.nameAr ?? tag?.name ?? tagSlug) : (tag?.name ?? tagSlug);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={allQuotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <QuoteItem quoteId={item.id} quote={item} />
        )}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{tagLabel}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState message={t('feelings.empty')} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage
            ? () => <ActivityIndicator color={Colors.primary} style={styles.loader} />
            : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: Spacing['16'] },
  list: { paddingBottom: Spacing['12'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['4'],
    paddingTop: Spacing['4'],
    paddingBottom: Spacing['2'],
    gap: Spacing['3'],
  },
  backBtn: { padding: Spacing['2'] },
  backText: { fontSize: FontSize.xl, color: Colors.primary },
  title: {
    flex: 1,
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'right',
  },
});
