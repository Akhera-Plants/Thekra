/**
 * Sin picker — full-screen searchable list (not a bottom sheet like web).
 * Reason: keyboard consumes half a sheet on mobile; this must be usable
 * one-handed, fast, under stress. (mobile-plan §3)
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
import { useSins } from '@/lib/api/sins';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

export default function SinPickerScreen() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const isAr = i18n.language === 'ar';

  const { data: sins, isLoading, isError, refetch } = useSins({
    sort: 'quoteCount',
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!sins) return [];
    if (!search.trim()) return sins;
    const q = search.toLowerCase();
    return sins.filter(
      (s) =>
        s.nameAr.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.descriptionAr ?? '').includes(q),
    );
  }, [sins, search]);

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
        <Text style={styles.title}>{t('sinPicker.title')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('sinPicker.searchPlaceholder')}
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
        <EmptyState message={t('sinPicker.empty')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => router.push(`/sins/${item.slug}`)}
              accessibilityRole="button"
            >
              <Text style={styles.itemName}>{isAr ? item.nameAr : item.name}</Text>
              {item.descriptionAr && isAr && (
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {item.descriptionAr}
                </Text>
              )}
              <Text style={styles.itemCount}>
                {item.quoteCount} {isAr ? 'تذكير' : 'reminders'}
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
    color: Colors.intentSin,
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
  itemDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  itemCount: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'right',
  },
  separator: { height: 1, backgroundColor: Colors.separator, marginHorizontal: Spacing['4'] },
});
