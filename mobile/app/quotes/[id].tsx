/**
 * Quote detail — full text, all translations, provenance, native share. Opened from QuoteCard.
 * An athar is never shown as hadith: it gets «أثر، وليس حديثًا» and its speaker instead of a grade badge.
 * mobile-plan §3 (Quote detail screen).
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuote } from '@/lib/api/quotes';
import { useToggleFavorite } from '@/lib/api/favorites';
import { GradeBadge } from '@/components/GradeBadge';
import { ErrorState } from '@/components/ErrorState';
import { Colors, FontSize, LineHeight, Radius, Spacing } from '@/lib/tokens';
import { QuoteType } from '@/lib/types/enums';
import { atharSpeakerLine, gradeCitationLine, quoteShareText } from '@/lib/share/quote-share';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const { data: quote, isLoading, isError, error, refetch } = useQuote(id ?? '');
  const { isFavorite, toggle } = useToggleFavorite(id ?? '');

  async function handleShare() {
    if (!quote) return;
    // Same text as the QuoteCard share: displayed text + attribution (+ athar label) + public page link.
    const message = quoteShareText(quote, {
      locale: isAr ? 'ar' : 'en',
      showTranslation: false,
      labels: {
        atharNotice: t('share.atharNotice'),
        atharNarrated: (speaker) => t('share.atharNarrated', { speaker }),
        grade: { SAHIH: t('grade.SAHIH'), HASAN: t('grade.HASAN'), DAIF: t('grade.DAIF'), MAWDU: t('grade.MAWDU') },
      },
    });
    try {
      await Share.share({ message });
    } catch {
      // dismissed
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (isError || !quote) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t('errors.unknown')}
        onRetry={() => void refetch()}
      />
    );
  }

  const grade = quote.type === QuoteType.HADITH ? quote.hadith?.grade : null;
  const isAthar = Boolean(quote.isAthar);
  const speakerLine = atharSpeakerLine(quote, { atharNarrated: (speaker) => t('share.atharNarrated', { speaker }) });
  const gradeLine = gradeCitationLine(quote, isAr ? 'ar' : 'en');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            {/* Share */}
            <TouchableOpacity
              onPress={() => void handleShare()}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={t('quoteDetail.share')}
            >
              <Text style={styles.actionBtnText}>↗</Text>
            </TouchableOpacity>
            {/* Favorite */}
            <TouchableOpacity
              onPress={() => toggle()}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? t('quoteDetail.unfavorite') : t('quoteDetail.favorite')}
              accessibilityState={{ selected: isFavorite }}
            >
              <Text style={[styles.actionBtnText, isFavorite && { color: Colors.primary }]}>
                {isFavorite ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Arabic text */}
        <Text style={styles.arabicText}>{quote.textAr}</Text>

        {/* Grade badge — an athar gets its own label, never a hadith grade */}
        {isAthar ? (
          <View style={[styles.badge, styles.atharBadge]} accessibilityRole="text">
            <Text style={styles.atharBadgeText}>{t('share.atharNotice')}</Text>
          </View>
        ) : quote.type === QuoteType.HADITH ? (
          <View style={styles.badge}>
            <GradeBadge grade={grade} />
          </View>
        ) : null}
        {speakerLine ? <Text style={styles.provenanceValue}>{speakerLine}</Text> : null}
        {gradeLine ? <Text style={styles.provenanceValue}>{gradeLine}</Text> : null}

        {/* Source + provenance */}
        <View style={styles.provenanceBlock}>
          <Text style={styles.provenanceLabel}>{t('quoteDetail.source')}</Text>
          <Text style={styles.provenanceValue}>
            {quote.source.nameAr ?? quote.source.name}
          </Text>
          {quote.type === QuoteType.QURAN_VERSE && quote.quran && (
            <Text style={[styles.provenanceValue, styles.ltrText]}>
              {`${quote.quran.surahNameAr} (${quote.quran.surahNumber}:${quote.quran.ayahNumber})`}
            </Text>
          )}
          {quote.type === QuoteType.HADITH && quote.hadith?.narrator && (
            <Text style={styles.provenanceValue}>
              {isAr ? (quote.hadith.narratorAr ?? quote.hadith.narrator) : quote.hadith.narrator}
            </Text>
          )}
          {quote.type === QuoteType.HADITH && quote.hadith?.reference && (
            <Text style={[styles.provenanceValue, styles.ltrText]}>
              {quote.hadith.reference}
            </Text>
          )}
        </View>

        {/* All translations */}
        {quote.allTranslations && quote.allTranslations.length > 0 && (
          <View style={styles.translationsBlock}>
            {quote.allTranslations.map((tr) => (
              <View key={tr.languageCode} style={styles.translation}>
                <Text style={styles.translationLang}>{tr.languageCode.toUpperCase()}</Text>
                <Text style={styles.translationText}>{tr.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Related sins */}
        {quote.relatedSins.length > 0 && (
          <View style={styles.relatedBlock}>
            <Text style={styles.relatedLabel}>{t('quoteDetail.relatedSins')}</Text>
            {quote.relatedSins.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => router.push(`/sins/${s.slug}`)}
                style={styles.relatedItem}
                accessibilityRole="link"
              >
                <Text style={styles.relatedItemText}>{isAr ? s.nameAr : s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Related good deeds */}
        {quote.relatedGoodDeeds.length > 0 && (
          <View style={styles.relatedBlock}>
            <Text style={[styles.relatedLabel, { color: Colors.intentGoodDeed }]}>
              {t('quoteDetail.relatedGoodDeeds')}
            </Text>
            {quote.relatedGoodDeeds.map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => router.push(`/good-deeds/${d.slug}`)}
                style={styles.relatedItem}
                accessibilityRole="link"
              >
                <Text style={[styles.relatedItemText, { color: Colors.intentGoodDeed }]}>
                  {isAr ? d.nameAr : d.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: Spacing['16'] },
  scroll: { padding: Spacing['5'], gap: Spacing['5'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: Spacing['2'] },
  backText: { fontSize: FontSize.xl, color: Colors.primary },
  headerActions: { flexDirection: 'row', gap: Spacing['3'] },
  actionBtn: { padding: Spacing['2'] },
  actionBtnText: { fontSize: FontSize.xl, color: Colors.textMuted },
  arabicText: {
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.arabic,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '400',
  },
  badge: { alignItems: 'flex-end' },
  atharBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing['2'],
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.gradeUngradedBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  atharBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gradeUngraded },
  provenanceBlock: {
    padding: Spacing['4'],
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing['1'],
  },
  provenanceLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  provenanceValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
  },
  ltrText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  translationsBlock: { gap: Spacing['3'] },
  translation: {
    padding: Spacing['4'],
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing['2'],
  },
  translationLang: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  translationText: {
    fontSize: FontSize.base,
    color: Colors.text,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  relatedBlock: { gap: Spacing['2'] },
  relatedLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.intentSin,
    textAlign: 'right',
  },
  relatedItem: {
    padding: Spacing['3'],
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  relatedItemText: {
    fontSize: FontSize.base,
    color: Colors.intentSin,
    textAlign: 'right',
  },
});
