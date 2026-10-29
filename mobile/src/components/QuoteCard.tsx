/**
 * QuoteCard: the website's quote card (frontend/src/components/shared/quote/QuoteCard.tsx) on the app theme.
 * - Header: the type pill (primary at 10%, icon + «آية قرآنية» / «حديث نبوي» / «أثر»), the reference capsule
 *   (surah | 2:255, or source | reference), the grade seal, narrator and grade-citation lines; share and favorite
 *   at the end.
 * - Body: Uthmani verse text in Amiri Quran; hadith and sayings in Plex at reading size. English UI with a
 *   translation shows it in Source Serif under the Arabic.
 * - «اقرأ التفسير» (verses) / «اقرأ الشرح» (hadith): the site's ghost study button, to quotes/study/[id].
 * - «اقرأ النص كاملًا» to the quote page, except on that page.
 * Share sends the text, its attribution and the public link only, never anything about the user.
 */

import React from 'react';
import { Share, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookMarked, BookOpen, Bookmark, BookmarkCheck, MessageSquareQuote, Share2, type LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, IconButton, TextLink } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { Notice } from '@/ui/feedback';
import { GradeBadge } from './GradeBadge';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { atharSpeakerLine, gradeCitationLine, quoteShareText, type QuoteShareLabels } from '@/lib/share/quote-share';

interface QuoteCardProps {
  quote: QuoteDto;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Show the share action (default true). */
  shareable?: boolean;
  /** On the quote page itself: the site's weak and «ليس من الصحيحين» notices, and no «read the full text» link. */
  detail?: boolean;
}

const TYPE: Record<QuoteType, { key: string; icon: LucideIcon }> = {
  [QuoteType.QURAN_VERSE]: { key: 'quran', icon: BookOpen },
  [QuoteType.HADITH]: { key: 'hadith', icon: MessageSquareQuote },
  [QuoteType.SCHOLAR_QUOTE]: { key: 'scholar', icon: BookOpen },
  [QuoteType.BOOK_EXCERPT]: { key: 'book', icon: BookOpen },
};

const makeStyles = (t: Theme) => ({
  card: {
    backgroundColor: t.colors.card,
    borderColor: t.colors.border,
    borderWidth: 1,
    borderRadius: radius.quote,
    padding: space.xl,
    gap: space.xl,
  },
  header: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.md },
  meta: { flex: 1, alignItems: 'flex-start' as const, gap: space.sm },
  typePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: t.colors.primarySoft,
  },
  typePillQuiet: { backgroundColor: t.colors.muted },
  capsuleRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.sm },
  capsule: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
    maxWidth: '100%' as const,
  },
  capsuleRule: { width: 1, height: 12, backgroundColor: t.colors.border },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const },
  body: { gap: space.sm },
  /** The ghost button's own padding, pulled back so its icon lines up with the text above. */
  study: { marginStart: -space.sm, marginVertical: -space.sm },
});

export function QuoteCard({ quote, isFavorite = false, onToggleFavorite, shareable = true, detail }: QuoteCardProps) {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const arabicUI = i18n.language !== 'en';
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const isHadith = quote.type === QuoteType.HADITH;
  const isAthar = Boolean(quote.isAthar);
  const type = TYPE[quote.type];
  const typeLabel = t(`quoteCard.type.${isAthar ? 'athar' : type.key}`);
  const grade = isHadith && !isAthar ? quote.hadith?.grade : null;

  const shareLabels: QuoteShareLabels = {
    atharNotice: t('share.atharNotice'),
    atharNarrated: (speaker) => t('share.atharNarrated', { speaker }),
    grade: { SAHIH: t('grade.SAHIH'), HASAN: t('grade.HASAN'), DAIF: t('grade.DAIF'), MAWDU: t('grade.MAWDU') },
  };
  const speakerLine = atharSpeakerLine(quote, shareLabels);
  const gradeLine = gradeCitationLine(quote, arabicUI ? 'ar' : 'en');
  const sourceName = arabicUI ? quote.source.nameAr ?? quote.source.name : quote.source.name || quote.source.nameAr;
  const surahName = arabicUI ? quote.quran?.surahNameAr : quote.quran?.surahName || quote.quran?.surahNameAr;
  const hadithRef = quote.hadith?.reference?.trim() || null;
  const narrator = arabicUI ? quote.hadith?.narratorAr : quote.hadith?.narrator || quote.hadith?.narratorAr;
  const showSourceInCapsule = Boolean(sourceName && !(hadithRef && sourceName && hadithRef.includes(sourceName)));
  const translation = arabicUI ? null : quote.translation?.text;
  const isWeak = grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU;
  const isOutsideSahihayn = isHadith && Boolean(quote.hadith?.outsideSahihayn);

  async function handleShare() {
    const message = quoteShareText(quote, {
      locale: arabicUI ? 'ar' : 'en',
      showTranslation: Boolean(translation),
      labels: shareLabels,
    });
    try {
      await Share.share({ message });
    } catch {
      // Dismissed or unavailable: nothing to do.
    }
  }

  return (
    <View style={styles.card} accessibilityLabel={typeLabel}>
      <View style={styles.header}>
        <View style={styles.meta}>
          <View style={[styles.typePill, isAthar && styles.typePillQuiet]}>
            <Icon icon={type.icon} size={14} tone={isAthar ? 'muted' : 'link'} />
            <Text variant="caption" weight="medium" tone={isAthar ? 'muted' : 'link'}>
              {typeLabel}
            </Text>
          </View>

          {isQuran && quote.quran ? (
            <View style={styles.capsuleRow}>
              {surahName || (quote.quran.surahNumber && quote.quran.ayahNumber) ? (
                <View style={styles.capsule}>
                  {surahName ? (
                    <Text variant="caption" numberOfLines={1}>
                      {surahName}
                    </Text>
                  ) : null}
                  {quote.quran.surahNumber && quote.quran.ayahNumber ? (
                    <>
                      <View style={styles.capsuleRule} />
                      <Text variant="caption" tone="muted" style={{ writingDirection: 'ltr' }}>
                        {`${quote.quran.surahNumber}:${quote.quran.ayahNumber}`}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : null}
              {sourceName ? (
                <Text variant="caption" tone="muted">
                  {sourceName}
                </Text>
              ) : null}
            </View>
          ) : null}

          {isHadith ? (
            <View style={{ alignItems: 'flex-start', gap: 6 }}>
              <View style={styles.capsuleRow}>
                {showSourceInCapsule || hadithRef ? (
                  <View style={styles.capsule}>
                    {showSourceInCapsule ? (
                      <Text variant="caption" numberOfLines={1}>
                        {sourceName}
                      </Text>
                    ) : null}
                    {showSourceInCapsule && hadithRef ? <View style={styles.capsuleRule} /> : null}
                    {hadithRef ? (
                      <Text variant="caption" tone={showSourceInCapsule ? 'muted' : 'default'} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {hadithRef}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {grade && grade !== HadithGrade.UNGRADED ? <GradeBadge grade={grade} /> : null}
              </View>
              {narrator ? (
                <Text variant="caption" tone="muted">
                  {`${t('quoteCard.narrator')}: ${narrator}`}
                </Text>
              ) : null}
              {gradeLine && !isAthar ? (
                <Text variant="caption" tone="muted" style={{ fontSize: 12 }}>
                  {gradeLine}
                </Text>
              ) : null}
              {speakerLine ? (
                <Text variant="caption" tone="muted">
                  {speakerLine}
                </Text>
              ) : null}
              {isAthar ? (
                <Text variant="caption" tone="muted" style={{ fontSize: 12 }}>
                  {t('share.atharNotice')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!isQuran && !isHadith ? (
            <Text variant="caption" tone="muted" style={{ fontSize: 12 }}>
              {sourceName ?? quote.book?.bookTitle ?? typeLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {shareable && (isQuran || isHadith) ? (
            <IconButton icon={Share2} label={t('share.action')} onPress={() => void handleShare()} />
          ) : null}
          {onToggleFavorite ? (
            <IconButton
              icon={isFavorite ? BookmarkCheck : Bookmark}
              label={isFavorite ? t('quoteCard.favoriteRemove') : t('quoteCard.favoriteAdd')}
              onPress={onToggleFavorite}
              active={isFavorite}
            />
          ) : null}
        </View>
      </View>

      {detail && isWeak ? <Notice>{t('quoteDetail.weakNotice')}</Notice> : null}
      {detail && isOutsideSahihayn ? (
        <Text variant="small" tone="muted">
          {t('quoteDetail.outsideSahihayn')}
        </Text>
      ) : null}

      <View style={styles.body}>
        {/* Alignment follows the text itself (Arabic starts on the right in either app direction). */}
        <Text variant={isQuran ? 'quran' : 'reading'} textBreakStrategy="highQuality">
          {quote.textAr}
        </Text>
        {translation ? (
          <Text variant="body">
            {translation}
          </Text>
        ) : null}
      </View>

      {isQuran || isHadith ? (
        <Button
          variant="ghost"
          icon={BookMarked}
          label={isQuran ? t('study.openTafsir') : t('study.openSharh')}
          onPress={() => router.push(`/quotes/study/${quote.id}`)}
          style={styles.study}
        />
      ) : null}

      {!detail ? <TextLink label={t('quoteCard.open')} onPress={() => router.push(`/quotes/${quote.id}`)} /> : null}
    </View>
  );
}
