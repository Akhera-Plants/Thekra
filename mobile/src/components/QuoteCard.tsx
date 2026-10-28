/**
 * QuoteCard — the core reading unit.
 *
 * Displays:
 *  - textAr at a comfortable Arabic reading size (≥18px, generous line height)
 *  - Grade badge (for hadith)
 *  - Source attribution
 *  - Quran reference or hadith reference
 *  - Favorite toggle button
 *  - Share action (React Native `Share`): the displayed text + attribution (+ «أثر، وليس حديثًا» for an
 *    athar) + the public page link. Never anything about the user (roadmap §0.5, §6).
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
  Share,
  useColorScheme,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, LineHeight, Radius, Shadow, Spacing } from '@/lib/tokens';
import { GradeBadge } from './GradeBadge';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { atharSpeakerLine, gradeCitationLine, quoteProvenance, quoteShareText, type QuoteShareLabels } from '@/lib/share/quote-share';

interface QuoteCardProps {
  quote: QuoteDto;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Show the English translation if available. */
  showTranslation?: boolean;
  /** Show the share action (default true). */
  shareable?: boolean;
}

export function QuoteCard({
  quote,
  isFavorite = false,
  onToggleFavorite,
  showTranslation = false,
  shareable = true,
}: QuoteCardProps) {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isArabicUI = i18n.language === 'ar';

  // Source display name
  const sourceName = quote.source.nameAr ?? quote.source.name;

  // Provenance line (varies by type)
  const provenance = quoteProvenance(quote);
  const isAthar = Boolean(quote.isAthar);

  const shareLabels: QuoteShareLabels = {
    atharNotice: t('share.atharNotice'),
    atharNarrated: (speaker) => t('share.atharNarrated', { speaker }),
    grade: {
      SAHIH: t('grade.SAHIH'),
      HASAN: t('grade.HASAN'),
      DAIF: t('grade.DAIF'),
      MAWDU: t('grade.MAWDU'),
    },
  };
  const speakerLine = atharSpeakerLine(quote, shareLabels);
  // «رواه بمعناه … · حكمه الأستاذ …»: marks a lecturer's retelling, as on the web card.
  const gradeLine = gradeCitationLine(quote, isArabicUI ? 'ar' : 'en');

  async function handleShare() {
    const message = quoteShareText(quote, {
      locale: isArabicUI ? 'ar' : 'en',
      showTranslation: Boolean(showTranslation && quote.translation),
      labels: shareLabels,
    });
    try {
      await Share.share({ message });
    } catch {
      // The share sheet was dismissed or is unavailable: nothing to do.
    }
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
          {/* Grade badge — an athar is never shown as hadith: it gets its own label instead */}
          {isAthar ? (
            <View style={styles.atharBadge} accessibilityRole="text">
              <Text style={styles.atharBadgeText}>{t('share.atharNotice')}</Text>
            </View>
          ) : quote.type === QuoteType.HADITH ? (
            <GradeBadge grade={grade} compact />
          ) : null}

          {gradeLine && (
            <Text style={[styles.source, isDark && styles.sourceDark]}>
              {gradeLine}
            </Text>
          )}

          {speakerLine && (
            <Text style={[styles.source, isDark && styles.sourceDark]} numberOfLines={1}>
              {speakerLine}
            </Text>
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

        {/* Share button */}
        {shareable && (
          <TouchableOpacity
            onPress={() => void handleShare()}
            style={styles.favoriteBtn}
            accessibilityRole="button"
            accessibilityLabel={t('share.action')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.shareIcon}>↗</Text>
          </TouchableOpacity>
        )}

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
    fontFamily: FontFamily.arabic,
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
  shareIcon: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
  },
  atharBadge: {
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    backgroundColor: Colors.gradeUngradedBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  atharBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gradeUngraded,
  },
});
