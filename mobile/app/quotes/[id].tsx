/**
 * One text, after the website's quote page (quotes/[id] → QuoteDetail): the quote card in full (type, reference,
 * grade, share and favorite live in the card), the other translations, then the related sins and good deeds as
 * chips. The website's page title is for screen readers only, so the card is the page.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuote } from '@/lib/api/quotes';
import { useToggleFavorite } from '@/lib/api/favorites';
import { QuoteCard } from '@/components/QuoteCard';
import { space, useStyles, useTheme } from '@/theme';
import { Chip, ErrorState, QuoteCardSkeleton, Rule, Screen, Text, Wrap } from '@/ui';

/** Translation languages written right to left; every other translation reads left to right in either UI. */
const RTL_LANGUAGES = new Set(['ar', 'fa', 'ur', 'he']);

const makeStyles = () => ({
  group: { gap: space.md },
  translation: { gap: space.xs },
  ltr: { writingDirection: 'ltr' as const },
  rtl: { writingDirection: 'rtl' as const },
});

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);

  const { data: quote, isLoading, isError, isRefetching, refetch } = useQuote(id ?? '');
  const { isFavorite, toggle } = useToggleFavorite(id ?? '');
  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  if (isLoading) {
    return (
      <Screen edges={['bottom']}>
        <QuoteCardSkeleton />
      </Screen>
    );
  }

  if (isError || !quote) {
    return (
      <Screen edges={['bottom']} refreshing={isRefetching} onRefresh={handleRefresh}>
        <ErrorState message={isError ? undefined : t('errors.notFound')} onRetry={handleRefresh} />
      </Screen>
    );
  }

  // The card already shows the UI-language translation in English; list only the others.
  const cardTranslation = english ? quote.translation?.text : null;
  const translations = (quote.allTranslations ?? []).filter((tr) => tr.text !== cardTranslation);
  const hasRelated = quote.relatedSins.length > 0 || quote.relatedGoodDeeds.length > 0;

  return (
    <Screen edges={['bottom']} refreshing={isRefetching} onRefresh={handleRefresh}>
      <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} detail />

      {translations.length > 0 ? (
        <View style={styles.group}>
          {translations.map((tr) => (
            <View key={tr.languageCode} style={styles.translation}>
              <Text variant="eyebrow" tone="muted">
                {tr.languageCode.toUpperCase()}
              </Text>
              <Text variant="body" style={RTL_LANGUAGES.has(tr.languageCode) ? styles.rtl : styles.ltr}>
                {tr.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {hasRelated ? <Rule /> : null}

      {quote.relatedSins.length > 0 ? (
        <View style={styles.group}>
          <Text variant="small" weight="semibold" tone="muted" accessibilityRole="header">
            {t('quoteDetail.relatedSins')}
          </Text>
          <Wrap>
            {quote.relatedSins.map((sin) => (
              <Chip
                key={sin.id}
                label={english ? sin.name || sin.nameAr : sin.nameAr}
                onPress={() => router.push(`/sins/${sin.slug}`)}
              />
            ))}
          </Wrap>
        </View>
      ) : null}

      {quote.relatedGoodDeeds.length > 0 ? (
        <View style={styles.group}>
          <Text variant="small" weight="semibold" tone="muted" accessibilityRole="header">
            {t('quoteDetail.relatedGoodDeeds')}
          </Text>
          <Wrap>
            {quote.relatedGoodDeeds.map((deed) => (
              <Chip
                key={deed.id}
                label={english ? deed.name || deed.nameAr : deed.nameAr}
                onPress={() => router.push(`/good-deeds/${deed.slug}`)}
              />
            ))}
          </Wrap>
        </View>
      ) : null}
    </Screen>
  );
}
