/**
 * Motivations screen — reward callout first, then ranked motivation cards.
 * Core screen: good deed → motivations (mobile-plan §3).
 */

import React, { useState } from 'react';
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
import { useGoodDeedQuotesInfinite } from '@/lib/api/good-deeds';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import type { QuoteType } from '@/lib/types/enums';

function QuoteItem({ quoteId, quote }: { quoteId: string; quote: any }) {
  const { isFavorite, toggle } = useToggleFavorite(quoteId);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
}

export default function MotivationsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const isAr = i18n.language === 'ar';

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useGoodDeedQuotesInfinite(slug ?? '', { seed, limit: 10 });

  const firstPage = data?.pages[0];
  const deed = firstPage?.data.goodDeed;
  const allItems = data?.pages.flatMap((p) => p.data.items) ?? [];

  function shuffle() {
    setSeed(String(Math.random()).slice(2));
  }

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

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.quote.id}
        renderItem={({ item }) => (
          <QuoteItem quoteId={item.quote.id} quote={item.quote} />
        )}
        ListHeaderComponent={() => (
          <View>
            {/* Back + Deed name */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
              >
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.deedName} numberOfLines={2}>
                {isAr ? (deed?.nameAr ?? slug) : (deed?.name ?? slug)}
              </Text>
            </View>

            {/* Reward callout — always first (mobile-plan §3) */}
            {(deed?.rewardAr || deed?.reward) && (
              <View style={styles.rewardCard}>
                <Text style={styles.rewardLabel}>{t('motivations.reward')}</Text>
                <Text style={styles.rewardText}>
                  {isAr ? (deed.rewardAr ?? deed.reward) : (deed.reward ?? deed.rewardAr)}
                </Text>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={() => (
          <View>
            {isFetchingNextPage && (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            )}

            {/* Another motivation button */}
            <TouchableOpacity
              style={styles.shuffleBtn}
              onPress={shuffle}
              accessibilityRole="button"
            >
              <Text style={styles.shuffleBtnText}>{t('reminders.anotherReminder')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<EmptyState message={t('motivations.empty')} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
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
  deedName: {
    flex: 1,
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.intentGoodDeed,
    textAlign: 'right',
  },
  rewardCard: {
    margin: Spacing['4'],
    padding: Spacing['5'],
    backgroundColor: Colors.intentGoodDeedLight,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.intentGoodDeed,
    gap: Spacing['2'],
  },
  rewardLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.intentGoodDeed,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardText: {
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
    lineHeight: FontSize.lg * 1.9,
  },
  shuffleBtn: {
    margin: Spacing['4'],
    padding: Spacing['4'],
    backgroundColor: Colors.intentGoodDeedLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.intentGoodDeed,
    alignItems: 'center',
  },
  shuffleBtnText: { color: Colors.intentGoodDeed, fontWeight: '600', fontSize: FontSize.base },
});
