/**
 * «الأسماء الحسنى» (redesign §4.7), the fourth door of «أبواب الخير», after the website's /names: a search box and
 * numbered cards in two columns, the name in the Quran face. The search folds Arabic like the site's, ignores «ال»,
 * and also finds a name by its number or its transliterated slug. The native header owns Back.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SearchX, WifiOff } from 'lucide-react-native';
import { useNamesOfAllah } from '@/lib/api/names';
import { useIsOffline } from '@/lib/query-client';
import { foldArabic } from '@/lib/topics';
import type { NameOfAllahDto } from '@/lib/types/api';
import { GUTTER, space, useStyles, useTheme } from '@/theme';
import { Card, EmptyState, ErrorState, Field, Loading, Notice, PageHeader, Screen, Text } from '@/ui';

const keyExtractor = (item: NameOfAllahDto) => item.slug;

const makeStyles = () => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'], gap: space.md },
  row: { gap: space.md },
  header: { gap: space.xl, paddingBottom: space.sm },
  card: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 104, gap: space.xs },
  name: { fontSize: 28, lineHeight: 52 },
});

/** Folded without «ال». */
function nameKey(value: string): string {
  return foldArabic(value).replace(/^ال/, '');
}

const NameCard = memo(function NameCard({ name }: { name: NameOfAllahDto }) {
  const styles = useStyles(makeStyles);
  const handlePress = useCallback(() => router.push(`/names/${name.slug}`), [name.slug]);
  return (
    <Card onPress={handlePress} style={styles.card} accessibilityLabel={`${name.number} ${name.nameAr}`}>
      <Text variant="caption" tone="muted">
        {String(name.number)}
      </Text>
      <Text variant="quran" tone="primary" style={styles.name}>
        {name.nameAr}
      </Text>
    </Card>
  );
});

export default function NamesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [search, setSearch] = useState('');
  const isOffline = useIsOffline();
  const { data: names, isLoading, isError, isRefetching, refetch } = useNamesOfAllah();

  const filtered = useMemo(() => {
    if (!names) return [];
    const needle = nameKey(search.trim());
    const latin = search.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!needle && !latin) return names;
    return names.filter(
      (n) =>
        String(n.number) === search.trim() ||
        (needle.length > 0 && nameKey(n.nameAr).includes(needle)) ||
        (latin.length > 0 && n.slug.replace(/-/g, '').includes(latin)),
    );
  }, [names, search]);

  const renderItem = useCallback<ListRenderItem<NameOfAllahDto>>(({ item }) => <NameCard name={item} />, []);
  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  const header = (
    <View style={styles.header}>
      <PageHeader eyebrow={t('names.eyebrow')} title={t('names.pageTitle')} lead={t('names.lead')} />
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder={t('names.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  const empty = isLoading ? (
    <Loading />
  ) : isError ? (
    <ErrorState message={t('errors.network')} onRetry={handleRefresh} />
  ) : (
    <EmptyState icon={SearchX} message={t('names.empty')} />
  );

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />
    </Screen>
  );
}
