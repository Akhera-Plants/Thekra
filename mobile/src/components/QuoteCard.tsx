/**
 * QuoteCard: the website's quote card (frontend/src/components/shared/quote/QuoteCard.tsx) on the app theme.
 * - Header: the type pill (primary at 10%, icon + «آية قرآنية» / «حديث نبوي» / «أثر»), the reference capsule
 *   (surah | 2:255, or source | reference), the grade seal, narrator and grade-citation lines; share and favorite
 *   at the end.
 * - Body: Uthmani verse text in Amiri Quran; hadith and sayings in Plex at reading size. English UI with a
 *   translation shows it in Source Serif under the Arabic.
 * - ONE action (owner round 6, C-12): «عرض التفسير» (verses) / «عرض الشرح» (hadith), opening the reader
 *   (quotes/study/[id]: the text, «وجه التذكير» for the topic link `linkId`, the tafsirs or sharh inline). No «لماذا
 *   هذه الآية؟» and no separate tafsir button any more.
 * - On a topic page, the read mark (round 6, owner chat; practice-core `reads.ts`): «مقروء» / «غير مقروء» beside the
 *   action; a tap switches it. The reader marks a text read when it opens.
 * - Tapping the text opens the quote page, except on that page.
 * Share opens the share sheet (text or image, C-08); it sends the text, its attribution and the public link only,
 * never anything about the user.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookMarked, BookOpen, Bookmark, BookmarkCheck, Check, Circle, MessageSquareQuote, Share2, type LucideIcon } from 'lucide-react-native';
import { isQuoteId, setRead } from '@thekra/practice-core';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { ShareSheet } from '@/components/share/ShareSheet';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, IconButton } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { Notice } from '@/ui/feedback';
import { GradeBadge } from './GradeBadge';
import { VerseAudioButton } from './VerseAudioButton';
import { stripOuterQuotes } from '@/lib/quote-text';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { atharSpeakerLine, gradeCitationLine, type QuoteShareLabels } from '@/lib/share/quote-share';

interface QuoteCardProps {
  quote: QuoteDto;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Show the share action (default true). */
  shareable?: boolean;
  /** On the quote page itself: the site's weak and «ليس من الصحيحين» notices, and the text does not link to the page. */
  detail?: boolean;
  /** The topic↔text link (`TopicText.link.id`): the reader shows that link's «وجه التذكير». */
  linkId?: string | null;
  /** «عرض التفسير»: bordered on lists (default), solid only on the quote's own page where it is the main action. */
  primaryExplain?: boolean;
  /** Show the read mark «مقروء» / «غير مقروء» (topic pages). */
  showRead?: boolean;
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
  foot: { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: space.md },
  explain: { flexGrow: 1 },
  read: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, minHeight: 44, paddingHorizontal: space.xs },
  body: { gap: space.sm },
  bodyPressed: { opacity: 0.7 },
});

export function QuoteCard({ quote, isFavorite = false, onToggleFavorite, shareable = true, detail, linkId, primaryExplain = false, showRead = false }: QuoteCardProps) {
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
  const handleOpenQuote = useCallback(() => router.push(`/quotes/${quote.id}`), [quote.id]);
  const handleOpenStudy = useCallback(
    () => router.push(linkId ? { pathname: '/quotes/study/[id]', params: { id: quote.id, linkId } } : `/quotes/study/${quote.id}`),
    [quote.id, linkId],
  );
  const [sharing, setSharing] = useState(false);
  const read = usePracticeStore((s) => (showRead ? (s.store.reads ?? []).some((m) => m.quoteId === quote.id.toLowerCase() && m.read) : false));
  const setStore = usePracticeStore((s) => s.setStore);
  const canMarkRead = showRead && isQuoteId(quote.id);

  const body = (
    <>
      {/* Alignment follows the text itself (Arabic starts on the right in either app direction). */}
      <Text variant={isQuran ? 'quran' : 'reading'} textBreakStrategy="highQuality">
        {stripOuterQuotes(quote.textAr)}
      </Text>
      {translation ? <Text variant="body">{translation}</Text> : null}
    </>
  );

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
          {isQuran && quote.quran?.surahNumber && quote.quran.ayahNumber ? (
            <VerseAudioButton surah={quote.quran.surahNumber} ayah={quote.quran.ayahNumber} />
          ) : null}
          {shareable && (isQuran || isHadith) ? (
            <IconButton icon={Share2} label={t('share.action')} onPress={() => setSharing(true)} />
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

      {detail ? (
        <View style={styles.body}>{body}</View>
      ) : (
        <Pressable
          onPress={handleOpenQuote}
          accessibilityRole="link"
          accessibilityHint={t('quoteCard.open')}
          style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
        >
          {body}
        </Pressable>
      )}

      {isQuran || isHadith || canMarkRead ? (
        <View style={styles.foot}>
          {isQuran || isHadith ? (
            <View style={styles.explain}>
              <Button
                icon={BookMarked}
                label={isQuran ? t('study.showTafsir') : t('study.showSharh')}
                onPress={handleOpenStudy}
                variant={primaryExplain ? 'solid' : 'outline'}
                block
              />
            </View>
          ) : null}
          {canMarkRead ? (
            <Pressable
              onPress={() => setStore((s) => setRead(s, quote.id, !read))}
              accessibilityRole="button"
              accessibilityState={{ checked: read }}
              accessibilityLabel={read ? t('reads.markUnread') : t('reads.markRead')}
              hitSlop={4}
              style={({ pressed }) => [styles.read, pressed && { opacity: 0.7 }]}
            >
              <Icon icon={read ? Check : Circle} size={15} tone={read ? 'link' : 'muted'} />
              <Text variant="caption" tone={read ? 'link' : 'muted'}>
                {read ? t('reads.read') : t('reads.unread')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {shareable && sharing ? (
        <ShareSheet quote={quote} visible={sharing} onClose={() => setSharing(false)} showTranslation={Boolean(translation)} />
      ) : null}
    </View>
  );
}
