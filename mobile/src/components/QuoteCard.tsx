/**
 * QuoteCard — the core reading unit.
 *
 * Displays:
 *  - textAr at a comfortable Arabic reading size (≥18px, generous line height)
 *  - Grade badge (for hadith)
 *  - Source attribution
 *  - Quran reference or hadith reference
 *  - Favorite toggle button
 *
 * Design: mobile-plan §3, frontend-plan §5 (QuoteCard equivalent).
 * Never convey grade by colour alone (ARCHITECTURE.md authenticity requirement).
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize, LineHeight, Radius, Shadow, Spacing } from '@/lib/tokens';
import { GradeBadge } from './GradeBadge';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';

interface QuoteCardProps {
  quote: QuoteDto;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Show the English translation if available. */
  showTranslation?: boolean;
}

export function QuoteCard({
  quote,
  isFavorite = false,
  onToggleFavorite,
  showTranslation = false,
}: QuoteCardProps) {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isArabicUI = i18n.language === 'ar';

  // Source display name
  const sourceName = quote.source.nameAr ?? quote.source.name;

  // Provenance line (varies by type)
  let provenance: string | null = null;
  if (quote.type === QuoteType.QURAN_VERSE && quote.quran) {
    const { surahNameAr, surahNumber, ayahNumber } = quote.quran;
    if (surahNameAr && surahNumber && ayahNumber) {
      provenance = `${surahNameAr} (${surahNumber}:${ayahNumber})`;
    }
  } else if (quote.type === QuoteType.HADITH && quote.hadith?.reference) {
    provenance = quote.hadith.reference;
  } else if (quote.type === QuoteType.BOOK_EXCERPT && quote.book?.bookTitle) {
    provenance = quote.book.bookTitle;
  }

  const grade = quote.type === QuoteType.HADITH ? quote.hadith?.grade : null;

  return (
    <View
      style={[
        styles.card,
        isDark && styles.cardDark,
        Shadow.sm,
      ]}
    >
      {/* Arabic text — always shown, always RTL, always primary */}
      <Text
        style={[styles.arabicText, isDark && styles.arabicTextDark]}
        textBreakStrategy="highQuality"
      >
        {quote.textAr}
      </Text>

      {/* Translation (LTR, secondary, optional) */}
      {showTranslation && quote.translation && (
        <Text style={[styles.translation, isDark && styles.translationDark]}>
          {quote.translation.text}
        </Text>
      )}

      {/* Footer: grade + source + provenance + favorite */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {/* Grade badge */}
          {quote.type === QuoteType.HADITH && (
            <GradeBadge grade={grade} compact />
          )}

          {/* Source */}
          <Text
            style={[styles.source, isDark && styles.sourceDark]}
            numberOfLines={1}
          >
            {sourceName}
          </Text>

          {/* Provenance (e.g. surah:ayah, hadith reference) */}
          {provenance && (
            <Text
              style={[styles.provenance, isDark && styles.provenanceDark]}
              numberOfLines={1}
            >
              {provenance}
            </Text>
          )}
        </View>

        {/* Favorite button */}
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={onToggleFavorite}
            style={styles.favoriteBtn}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? t('quoteDetail.unfavorite') : t('quoteDetail.favorite')
            }
            accessibilityState={{ selected: isFavorite }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.favoriteStar, isFavorite && styles.favoriteStarActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing['6'],
    marginHorizontal: Spacing['4'],
    marginVertical: Spacing['2'],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardDark: {
    backgroundColor: Colors.cardDark,
    borderColor: Colors.borderDark,
  },

  arabicText: {
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.arabic,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '400',
    marginBottom: Spacing['4'],
  },
  arabicTextDark: {
    color: Colors.textDark,
  },

  translation: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.relaxed,
    color: Colors.textMuted,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: Spacing['4'],
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: Spacing['3'],
  },
  translationDark: {
    color: Colors.textMutedDark,
    borderTopColor: Colors.separatorDark,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing['2'],
  },
  footerLeft: {
    flex: 1,
    gap: Spacing['1'],
    alignItems: 'flex-end',
  },

  source: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'right',
  },
  sourceDark: {
    color: Colors.textMutedDark,
  },

  provenance: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'left',   // hadith references are LTR (e.g. "Bukhari 13")
    writingDirection: 'ltr',
  },
  provenanceDark: {
    color: Colors.textMutedDark,
  },

  favoriteBtn: {
    paddingStart: Spacing['3'],
  },
  favoriteStar: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
  favoriteStarActive: {
    color: Colors.primary,
  },
});
