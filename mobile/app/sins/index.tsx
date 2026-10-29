/**
 * Sin picker: the website's topic catalogue (TopicCatalog, `.topic-item` rows) as a full-screen searchable list,
 * not a bottom sheet: the keyboard would take half a sheet, and this must work one-handed, fast, under stress
 * (mobile-plan §3). The native header owns Back; the page shows its own title.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DoorOpen, SearchX } from 'lucide-react-native';
import { useSins } from '@/lib/api/sins';
import type { SinDto } from '@/lib/types/api';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { EmptyState, ErrorState, Field, ListRow, PageHeader, Screen, Skeleton } from '@/ui';

const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const keyExtractor = (item: SinDto) => item.id;

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.xl, paddingBottom: space.sm },
  skeletonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  skeletonText: { flex: 1, gap: space.sm },
});

interface SinRowProps {
  sin: SinDto;
  english: boolean;
}

const SinRow = memo(function SinRow({ sin, english }: SinRowProps) {
  const handlePress = useCallback(() => router.push(`/sins/${sin.slug}`), [sin.slug]);
  return (
    <ListRow
      icon={DoorOpen}
      title={english ? sin.name || sin.nameAr : sin.nameAr}
      hint={sin.quoteCount > 0 ? String(sin.quoteCount) : undefined}
      onPress={handlePress}
    />
  );
});

function TopicRowsSkeleton() {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t('common.loading')}>
      {SKELETON_ROWS.map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width={24} height={24} round />
          <View style={styles.skeletonText}>
            <Skeleton width="55%" height={16} />
            <Skeleton width={36} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SinPickerScreen() {
  const { t } = useTranslation();
  const { english, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [search, setSearch] = useState('');

  const { data: sins, isLoading, isError, isRefetching, refetch } = useSins({
    sort: 'quoteCount',
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!sins) return [];
    if (!search.trim()) return sins;
    const q = search.toLowerCase();
    return sins.filter(
      (s) => s.nameAr.includes(q) || s.name.toLowerCase().includes(q) || (s.descriptionAr ?? '').includes(q),
    );
  }, [sins, search]);

  const renderItem = useCallback<ListRenderItem<SinDto>>(({ item }) => <SinRow sin={item} english={english} />, [english]);
  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  const header = (
    <View style={styles.header}>
      <PageHeader eyebrow={t('sinPicker.eyebrow')} title={t('sinPicker.title')} lead={t('sinPicker.lead')} />
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder={t('sinPicker.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  const empty = isLoading ? (
    <TopicRowsSkeleton />
  ) : isError ? (
    <ErrorState message={t('errors.network')} onRetry={handleRefresh} />
  ) : (
    <EmptyState icon={SearchX} message={t('sinPicker.empty')} />
  );

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </Screen>
  );
}
