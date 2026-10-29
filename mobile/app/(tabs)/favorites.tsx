/**
 * Favorites, after the website's favorites page: the title and lead, then the saved quote cards. A guest sees why
 * to sign in and the way to do it; an empty list points to where texts are found. Offline-capable: the list is
 * served from the cache when there is no connection (see `useFavorites`).
 */

import React, { memo, useCallback, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkPlus, WifiOff } from 'lucide-react-native';
import { useFavorites, useToggleFavorite } from '@/lib/api/favorites';
import { useAuthStore } from '@/lib/stores/auth-store';
import { QuoteCard } from '@/components/QuoteCard';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { useIsOffline } from '@/lib/query-client';
import { EmptyState, ErrorState, Notice, PageHeader, QuoteCardSkeleton, Screen } from '@/ui';
import type { QuoteDto } from '@/lib/types/api';

const SKELETON_COUNT = 3;

const makeStyles = (t: Theme) => ({
  list: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] },
  header: { gap: space.lg, paddingBottom: space.xl },
  gap: { height: space.lg },
  skeletons: { gap: space.lg },
  fill: { backgroundColor: t.colors.background },
});

const FavoriteQuoteItem = memo(function FavoriteQuoteItem({ quote }: { quote: QuoteDto }) {
  const { isFavorite, toggle } = useToggleFavorite(quote.id);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
});

const renderFavorite: ListRenderItem<QuoteDto> = ({ item }) => <FavoriteQuoteItem quote={item} />;
const keyOf = (item: QuoteDto) => item.id;

function Gap() {
  const styles = useStyles(makeStyles);
  return <View style={styles.gap} />;
}

function FavoritesHeader() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const isOffline = useIsOffline();
  return (
    <View style={styles.header}>
      <PageHeader title={t('favorites.title')} lead={t('favorites.lead')} />
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
    </View>
  );
}

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { data: favorites, isLoading, isError, refetch } = useFavorites();
  const [isPulling, setIsPulling] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsPulling(true);
    try {
      await refetch();
    } finally {
      setIsPulling(false);
    }
  }, [refetch]);

  if (!user) {
    return (
      <Screen>
        <FavoritesHeader />
        <EmptyState
          icon={BookmarkPlus}
          message={t('favorites.signInPrompt')}
          hint={t('auth.guestNote')}
          actionLabel={t('auth.loginButton')}
          onAction={() => router.push('/(auth)/login')}
        />
      </Screen>
    );
  }

  const empty = isError ? (
    <ErrorState onRetry={() => void refetch()} />
  ) : isLoading ? (
    <View style={styles.skeletons}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <QuoteCardSkeleton key={`skeleton-${i}`} />
      ))}
    </View>
  ) : (
    <EmptyState
      icon={Bookmark}
      message={t('favorites.empty')}
      hint={t('favorites.emptyHint')}
      actionLabel={t('tabs.browse')}
      onAction={() => router.navigate('/browse')}
    />
  );

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        data={isError ? [] : (favorites ?? [])}
        keyExtractor={keyOf}
        renderItem={renderFavorite}
        ListHeaderComponent={FavoritesHeader}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Gap}
        style={styles.fill}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isPulling}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      />
    </Screen>
  );
}
