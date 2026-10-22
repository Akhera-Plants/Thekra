/**
 * Browse tab — infinite list of quotes with search and type/grade filters.
 * mobile-plan §3 (Browse screen).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuotesInfinite } from '@/lib/api/quotes';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';
import type { QuoteType } from '@/lib/types/enums';

const QUOTE_TYPE_FILTERS: Array<{ key: QuoteType | 'ALL'; labelKey: string }> = [
  { key: 'ALL', labelKey: 'browse.tabAll' },
  { key: 'QURAN_VERSE', labelKey: 'browse.tabQuran' },
  { key: 'HADITH', labelKey: 'browse.tabHadith' },
];

export default function BrowseScreen() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<QuoteType | 'ALL'>('ALL');

  const params = {
    q: search.length > 1 ? search : undefined,
    type: typeFilter !== 'ALL' ? ([typeFilter] as QuoteType[]) : undefined,
    limit: 20,
  };

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useQuotesInfinite(params);

  const allQuotes = data?.pages.flatMap((p) => p.data) ?? [];

  function FavoriteWrapper({ quoteId }: { quoteId: string }) {
    const { isFavorite, toggle } = useToggleFavorite(quoteId);
    return { isFavorite, toggle } as any;
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
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('browse.searchPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel={t('common.search')}
        />
      </View>

      {/* Type filter chips */}
      <View style={styles.filters}>
        {QUOTE_TYPE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setTypeFilter(f.key)}
            style={[styles.chip, typeFilter === f.key && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: typeFilter === f.key }}
          >
            <Text style={[styles.chipText, typeFilter === f.key && styles.chipTextActive]}>
              {t(f.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quote list */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : allQuotes.length === 0 ? (
        <EmptyState message={t('browse.empty')} />
      ) : (
        <FlatList
          data={allQuotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { isFavorite, toggle } = useToggleFavorite(item.id);
            return (
              <QuoteCard
                quote={item}
                isFavorite={isFavorite}
                onToggleFavorite={toggle}
              />
            );
          }}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    padding: Spacing['4'],
    paddingBottom: Spacing['2'],
  },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing['4'],
    paddingBottom: Spacing['2'],
    gap: Spacing['2'],
  },
  chip: {
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['2'],
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.textInverse,
    fontWeight: '600',
  },
  list: {
    paddingVertical: Spacing['2'],
  },
  loader: {
    marginVertical: Spacing['8'],
  },
});
