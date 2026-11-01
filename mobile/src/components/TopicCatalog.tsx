/**
 * The sins and good-deeds lists (owner, 2026-11-01: categorized, fast and clear): the page title, the search, then one
 * row of chips (the quick filter and the website's topic domains, each with its count), then the list: in domain groups
 * under their headings when no chip and no search is on, else one list. Rows are the website's `.topic-item`. The logic
 * is `src/lib/topic-catalog.ts`; this renders it and the states (skeleton, error with retry, empty, offline, refresh).
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, SectionList, View, type SectionListRenderItem } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SearchX, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useIsOffline } from '@/lib/query-client';
import { catalogChips, catalogSections, type CatalogEntry, type CatalogFilter, type CatalogOptions, type CatalogSection } from '@/lib/topic-catalog';
import { topicMeta } from '@/lib/topics';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { Chip, EmptyState, ErrorState, Field, ListRow, Notice, PageHeader, Screen, Skeleton, Text } from '@/ui';

const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5', 's6'];

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.lg, paddingBottom: space.sm },
  chips: { flexDirection: 'row' as const, gap: space.sm, paddingVertical: 2 },
  /** The chip row runs to the screen edges, so a cut chip shows there is more to scroll. */
  chipScroll: { marginHorizontal: -GUTTER },
  chipScrollContent: { paddingHorizontal: GUTTER },
  sectionTitle: { paddingTop: space.xl, paddingBottom: space.xs },
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

export interface TopicCatalogProps<T extends CatalogEntry> {
  entries: readonly T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  eyebrow: string;
  title: string;
  lead?: string;
  searchPlaceholder: string;
  emptyMessage: string;
  icon: LucideIcon;
  /** The quick filter this list offers. */
  options: CatalogOptions;
  /** The label of the quick filter chip. */
  quickLabel: string;
  onOpen: (slug: string) => void;
}

function RowsSkeleton() {
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

const TopicRow = memo(function TopicRow({
  entry,
  icon,
  grouped,
  onOpen,
}: {
  entry: CatalogEntry;
  icon: LucideIcon;
  grouped: boolean;
  onOpen: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const { english } = useTheme();
  const handlePress = useCallback(() => onOpen(entry.slug), [onOpen, entry.slug]);
  return (
    <ListRow
      icon={icon}
      title={english ? entry.name || entry.nameAr : entry.nameAr}
      hint={topicMeta(entry, t, grouped)}
      onPress={handlePress}
    />
  );
});

export function TopicCatalog<T extends CatalogEntry>({
  entries,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  eyebrow,
  title,
  lead,
  searchPlaceholder,
  emptyMessage,
  icon,
  options,
  quickLabel,
  onOpen,
}: TopicCatalogProps<T>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const isOffline = useIsOffline();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');

  const chips = useMemo(() => catalogChips(entries ?? [], options), [entries, options]);
  const sections = useMemo(() => catalogSections(entries ?? [], filter, query, options), [entries, filter, query, options]);
  const grouped = sections.length > 0 && sections[0]!.domain !== null;
  const chipLabel = (key: CatalogFilter) =>
    key === 'all' ? t('catalog.all') : key === 'kabira' || key === 'habits' ? quickLabel : t(`topicMeta.domains.${key}`);

  const renderItem = useCallback<SectionListRenderItem<T, CatalogSection<T>>>(
    ({ item, section }) => <TopicRow entry={item} icon={icon} grouped={section.domain !== null} onOpen={onOpen} />,
    [icon, onOpen],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: CatalogSection<T> }) =>
      section.domain ? (
        <Text variant="heading" accessibilityRole="header" style={styles.sectionTitle}>
          {t(`topicMeta.domains.${section.domain}`)}
        </Text>
      ) : null,
    [styles.sectionTitle, t],
  );

  const header = (
    <View style={styles.header}>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        accessibilityLabel={t('common.search')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {chips.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipScrollContent}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('catalog.filters')}
        >
          <View style={styles.chips}>
            {chips.map((chip) => (
              <Chip key={chip.key} label={chipLabel(chip.key)} count={chip.count} selected={filter === chip.key} onPress={() => setFilter(chip.key)} />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );

  const empty = isLoading ? (
    <RowsSkeleton />
  ) : isError ? (
    <ErrorState message={t('errors.network')} onRetry={onRefresh} />
  ) : (
    <EmptyState icon={SearchX} message={emptyMessage} />
  );

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.slug}
        renderItem={renderItem}
        renderSectionHeader={grouped ? renderSectionHeader : undefined}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />
    </Screen>
  );
}
