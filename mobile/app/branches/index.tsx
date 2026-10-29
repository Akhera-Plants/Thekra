/**
 * شعب الإيمان: the website's branches catalogue (branches/page.tsx through TopicCatalog, `.topic-item` rows with the
 * open book) as a full-screen searchable list, like the sin and good-deed pickers. The 77 branches in their order;
 * the search folds Arabic like the site's and also finds a branch by its number. The native header owns Back.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, SearchX, WifiOff } from 'lucide-react-native';
import { useBranches } from '@/lib/api/branches';
import { useIsOffline } from '@/lib/query-client';
import { foldArabic, topicMeta } from '@/lib/topics';
import type { BranchesQuery, ImanBranchDto } from '@/lib/types/api';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { EmptyState, ErrorState, Field, ListRow, Notice, PageHeader, Screen, Skeleton } from '@/ui';

const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5', 's6'];
/** All 77 in one page (the API allows 100). */
const BRANCHES_QUERY: BranchesQuery = { limit: 100 };
const keyExtractor = (item: ImanBranchDto) => item.id;

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

const BranchRow = memo(function BranchRow({ branch, english }: { branch: ImanBranchDto; english: boolean }) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => router.push(`/branches/${branch.number}`), [branch.number]);
  return (
    <ListRow
      icon={BookOpen}
      title={english ? branch.title || t('branches.branchFallback', { number: branch.number }) : branch.titleAr}
      hint={topicMeta({ quoteCount: branch.quoteCount }, t)}
      onPress={handlePress}
    />
  );
});

function BranchRowsSkeleton() {
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

export default function BranchesScreen() {
  const { t } = useTranslation();
  const { english, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [search, setSearch] = useState('');
  const isOffline = useIsOffline();
  const { data: branches, isLoading, isError, isRefetching, refetch } = useBranches(BRANCHES_QUERY);

  const filtered = useMemo(() => {
    if (!branches) return [];
    const needle = foldArabic(search);
    if (!needle) return branches;
    return branches.filter(
      (b) => String(b.number) === needle || [b.titleAr, b.title ?? ''].some((name) => foldArabic(name).includes(needle)),
    );
  }, [branches, search]);

  const renderItem = useCallback<ListRenderItem<ImanBranchDto>>(({ item }) => <BranchRow branch={item} english={english} />, [english]);
  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  const header = (
    <View style={styles.header}>
      <PageHeader eyebrow={t('home.branchOverline')} title={t('branches.pageTitle')} lead={t('home.branchEntryDescription')} />
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder={t('branches.searchPlaceholder')}
        accessibilityLabel={t('common.search')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  const empty = isLoading ? (
    <BranchRowsSkeleton />
  ) : isError ? (
    <ErrorState message={t('errors.network')} onRetry={handleRefresh} />
  ) : (
    <EmptyState icon={SearchX} message={t('branches.noResults')} />
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
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />
    </Screen>
  );
}
