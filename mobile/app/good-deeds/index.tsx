/**
 * Good deed picker — full-screen searchable list.
 * Mirrors the sin picker (mobile-plan §3).
 */

import React, { useState, useMemo } from 'react';
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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGoodDeeds } from '@/lib/api/good-deeds';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

export default function GoodDeedPickerScreen() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const isAr = i18n.language === 'ar';

  const { data: deeds, isLoading, isError, refetch } = useGoodDeeds({
    sort: 'quoteCount',
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!deeds) return [];
    if (!search.trim()) return deeds;
    const q = search.toLowerCase();
    return deeds.filter(
      (d) =>
        d.nameAr.includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.descriptionAr ?? '').includes(q),
    );
  }, [deeds, search]);

  if (isError) {
    return <ErrorState message={t('errors.network')} onRetry={() => void refetch()} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('goodDeedPicker.title')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('goodDeedPicker.searchPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
          returnKeyType="search"
          accessibilityLabel={t('common.search')}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : filtered.length === 0 ? (
        <EmptyState message={t('goodDeedPicker.empty')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => router.push(`/good-deeds/${item.slug}`)}
              accessibilityRole="button"
            >
              <Text style={styles.itemName}>{isAr ? item.nameAr : item.name}</Text>
              {item.rewardAr && isAr && (
                <Text style={styles.itemReward} numberOfLines={2}>
                  {item.rewardAr}
                </Text>
              )}
              <Text style={styles.itemCount}>
                {item.quoteCount} {isAr ? 'محفّز' : 'motivations'}
              </Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
    color: Colors.intentGoodDeed,
    textAlign: 'right',
  },
  searchBar: { paddingHorizontal: Spacing['4'], paddingBottom: Spacing['2'] },
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
  list: { paddingBottom: Spacing['8'] },
  loader: { marginTop: Spacing['16'] },
  item: {
    paddingHorizontal: Spacing['5'],
    paddingVertical: Spacing['4'],
    gap: Spacing['1'],
  },
  itemName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  itemReward: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  itemCount: {
    fontSize: FontSize.xs,
    color: Colors.intentGoodDeed,
    textAlign: 'right',
  },
  separator: { height: 1, backgroundColor: Colors.separator, marginHorizontal: Spacing['4'] },
});
