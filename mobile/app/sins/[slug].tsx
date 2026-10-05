/**
 * Reminders screen — vertically scrolled quote cards for a sin.
 * Core screen: sin → reminders (mobile-plan §3).
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
import { useSinQuotesInfinite } from '@/lib/api/sins';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import type { QuoteType } from '@/lib/types/enums';

type FilterKey = QuoteType | 'ALL';

const FILTERS: Array<{ key: FilterKey; labelKey: string }> = [
  { key: 'ALL',          labelKey: 'reminders.filterAll' },
  { key: 'QURAN_VERSE',  labelKey: 'reminders.filterQuran' },
  { key: 'HADITH',       labelKey: 'reminders.filterHadith' },
  { key: 'SCHOLAR_QUOTE',labelKey: 'reminders.filterScholar' },
  { key: 'BOOK_EXCERPT', labelKey: 'reminders.filterBook' },
];

function QuoteItem({ quoteId, quote }: { quoteId: string; quote: any }) {
  const { isFavorite, toggle } = useToggleFavorite(quoteId);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
}

export default function RemindersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const isAr = i18n.language === 'ar';

  const params = {
    type: filter !== 'ALL' ? ([filter] as QuoteType[]) : undefined,
    seed,
    limit: 10,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSinQuotesInfinite(slug ?? '', params);

  const firstPage = data?.pages[0];
  const sin = firstPage?.data.sin;
  const allItems = data?.pages.flatMap((p) => p.data.items) ?? [];
  const alternatives = firstPage?.data.alternatives ?? [];

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
            {/* Back + Sin name */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
              >
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.sinName} numberOfLines={2}>
                {isAr ? (sin?.nameAr ?? slug) : (sin?.name ?? slug)}
              </Text>
            </View>

            {/* Type filter chips */}
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.chip, filter === f.key && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === f.key }}
                >
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                    {t(f.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        ListFooterComponent={() => (
          <View>
            {isFetchingNextPage && (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            )}

            {/* Another reminder button */}
            <TouchableOpacity
              style={styles.shuffleBtn}
              onPress={shuffle}
              accessibilityRole="button"
            >
              <Text style={styles.shuffleBtnText}>{t('reminders.anotherReminder')}</Text>
            </TouchableOpacity>

            {/* Alternatives block */}
            {alternatives.length > 0 && (
              <View style={styles.alternatives}>
                <Text style={styles.alternativesTitle}>{t('reminders.alternatives')}</Text>
                {alternatives.map((alt) => (
                  <TouchableOpacity
                    key={alt.id}
                    style={styles.altItem}
                    onPress={() => router.push(`/good-deeds/${alt.slug}`)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.altName}>{isAr ? alt.nameAr : alt.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<EmptyState message={t('reminders.empty')} />}
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
  sinName: {
    flex: 1,
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.intentSin,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing['4'],
    paddingBottom: Spacing['2'],
    gap: Spacing['2'],
  },
  chip: {
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['1.5'],
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.intentSin, borderColor: Colors.intentSin },
  chipText: { fontSize: FontSize.xs, color: Colors.textMuted },
  chipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  shuffleBtn: {
    margin: Spacing['4'],
    padding: Spacing['4'],
    backgroundColor: Colors.intentSinLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.intentSin,
    alignItems: 'center',
  },
  shuffleBtnText: { color: Colors.intentSin, fontWeight: '600', fontSize: FontSize.base },
  alternatives: {
    margin: Spacing['4'],
    padding: Spacing['4'],
    backgroundColor: Colors.intentGoodDeedLight,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.intentGoodDeed,
    gap: Spacing['3'],
  },
  alternativesTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.intentGoodDeed,
    textAlign: 'right',
  },
  altItem: {
    paddingVertical: Spacing['2'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  altName: {
    fontSize: FontSize.base,
    color: Colors.intentGoodDeed,
    textAlign: 'right',
  },
});
