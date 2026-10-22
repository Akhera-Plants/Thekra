/**
 * Favorites tab — saved quotes, offline-capable.
 * mobile-plan §3 (Favorites screen), §6 (offline strategy).
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFavorites, useToggleFavorite } from '@/lib/api/favorites';
import { useAuthStore } from '@/lib/stores/auth-store';
import { QuoteCard } from '@/components/QuoteCard';
import { EmptyState } from '@/components/EmptyState';
import { Colors, FontSize, Radius, Spacing } from '@/lib/tokens';

function FavoriteQuoteItem({ quoteId, quote }: { quoteId: string; quote: any }) {
  const { isFavorite, toggle } = useToggleFavorite(quoteId);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
}

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: favorites, isLoading } = useFavorites();

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.signInContainer}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.signInMessage}>{t('favorites.signInPrompt')}</Text>
          <Link href="/(auth)/login" asChild>
            <Text style={styles.signInLink}>{t('auth.loginButton')}</Text>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          message={t('favorites.empty')}
          hint={t('favorites.emptyHint')}
          icon="★"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FavoriteQuoteItem quoteId={item.id} quote={item} />
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    paddingVertical: Spacing['2'],
  },
  loader: {
    flex: 1,
    marginTop: Spacing['16'],
  },
  signInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['8'],
    gap: Spacing['6'],
  },
  icon: {
    fontSize: 64,
  },
  signInMessage: {
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
  },
  signInLink: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing['6'],
    paddingVertical: Spacing['3'],
    borderRadius: Radius.md,
  },
});
