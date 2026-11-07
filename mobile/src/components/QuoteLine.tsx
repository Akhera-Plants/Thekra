/**
 * One text shown on its own, outside a quote card (owner round 5, A-16): at reading size (Uthmani for a verse), the
 * outer quote marks dropped (A-04), and its source line under it («هود: 114», or the hadith's book and number).
 * Tapping it opens the text's page.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { stripOuterQuotes, verseSourceLine } from '@/lib/quote-text';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { space } from '@/theme';
import { Text } from '@/ui';

export function QuoteLine({ quote, numberOfLines }: { quote: QuoteDto; numberOfLines?: number }) {
  const { i18n } = useTranslation();
  const arabicUI = i18n.language !== 'en';
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const source = isQuran
    ? verseSourceLine(quote.quran, arabicUI)
    : quote.hadith?.reference?.trim() || (arabicUI ? quote.source.nameAr ?? quote.source.name : quote.source.name || quote.source.nameAr) || null;
  const text = stripOuterQuotes(quote.textAr);
  return (
    <Pressable
      onPress={() => router.push(`/quotes/${quote.id}`)}
      accessibilityRole="link"
      accessibilityLabel={source ? `${text}. ${source}` : text}
      style={({ pressed }) => [{ gap: space.xs }, pressed && { opacity: 0.7 }]}
    >
      <Text variant={isQuran ? 'quran' : 'reading'} numberOfLines={numberOfLines}>
        {isQuran ? `﴿${text}﴾` : text}
      </Text>
      {source ? (
        <View>
          <Text variant="caption" tone="muted">
            {source}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
