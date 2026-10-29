/**
 * «لماذا هذه الآية؟» / «لماذا هذا الحديث؟» under the quote card's text: the website's disclosure (QuoteCard.tsx: a soft
 * primary box, Info, the label, a chevron), opening on what the text means. First the topic link's public note when
 * the card has one (`publicLinkNote`), then a short excerpt of the first row of المختصر في التفسير (verses) or
 * موسوعة الأحاديث (hadith) in the UI language, its source as a muted caption. The explanations are asked for on the
 * first open only, under the study sheet's query key. An athar, a scholar's words or a book excerpt has no
 * explanation source: the box shows only when there is a note.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Info } from 'lucide-react-native';
import { useQuoteExplanations } from '@/lib/api/quotes';
import { publicLinkNote } from '@/lib/study/link-note';
import { explanationSegments, isArabicRow, pickTabRows, studyCaption, studyExcerpt, type StudyTabId } from '@/lib/study/tabs';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Icon, Skeleton, Text } from '@/ui';

const MOTION_MS = 200;

const makeStyles = (t: Theme) => ({
  box: { borderRadius: radius.card, backgroundColor: t.colors.primarySoft, overflow: 'hidden' as const },
  trigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triggerPressed: { opacity: 0.7 },
  label: { flex: 1 },
  panel: { gap: space.md, paddingHorizontal: 14, paddingTop: space.md, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.colors.primarySoft },
  reading: { gap: space.xs },
  rtl: { writingDirection: 'rtl' as const },
  ltr: { writingDirection: 'ltr' as const },
  verse: { fontSize: 19, lineHeight: 32 },
  retry: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.sm },
  skeleton: { gap: space.sm },
});

/** The explanation source a quote's meaning is read from, or null when it has none. */
function meaningTab(quote: QuoteDto): StudyTabId | null {
  if (quote.isAthar) return null;
  if (quote.type === QuoteType.QURAN_VERSE) return 'mukhtasar';
  if (quote.type === QuoteType.HADITH) return 'sharh';
  return null;
}

/** The chevron turns and the panel fades in a few points down; instant when the system asks to reduce motion. */
function useDisclosureMotion(open: boolean) {
  const turn = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);
  useEffect(() => {
    // A card mounting closed has nothing to move (lists mount many of them).
    if (!mounted.current) {
      mounted.current = true;
      if (!open) return;
    }
    let cancelled = false;
    const to = open ? 1 : 0;
    // Closing unmounts the panel at once; it waits hidden for the next open.
    if (!open) reveal.setValue(0);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        turn.setValue(to);
        reveal.setValue(to);
        return;
      }
      const timing = { duration: MOTION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true };
      const moves = [Animated.timing(turn, { toValue: to, ...timing })];
      if (open) moves.push(Animated.timing(reveal, { toValue: 1, ...timing }));
      Animated.parallel(moves).start();
    });
    return () => {
      cancelled = true;
    };
  }, [open, turn, reveal]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] });
  return { rotate, panel: { opacity: reveal, transform: [{ translateY }] } };
}

export function QuoteWhy({ quote, linkNote }: { quote: QuoteDto; linkNote?: string | null }) {
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const handleToggle = useCallback(() => setOpen((value) => !value), []);
  const motion = useDisclosureMotion(open);
  const note = publicLinkNote(linkNote, english ? 'en' : 'ar');
  const tab = meaningTab(quote);
  if (!note && !tab) return null;

  const label =
    quote.type === QuoteType.QURAN_VERSE
      ? t('quoteCard.whyVerse')
      : quote.type === QuoteType.HADITH && !quote.isAthar
        ? t('quoteCard.whyHadith')
        : t('quoteCard.whyText');

  return (
    <View style={styles.box}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Icon icon={Info} size={16} tone="link" />
        <Text variant="small" style={styles.label}>
          {label}
        </Text>
        <Animated.View style={{ transform: [{ rotate: motion.rotate }] }}>
          <Icon icon={ChevronDown} size={16} tone="muted" />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View style={[styles.panel, motion.panel]}>
          {note ? (
            <Text variant="small" tone="muted" style={english ? styles.ltr : styles.rtl}>
              {note}
            </Text>
          ) : null}
          {tab ? <WhyMeaning quote={quote} tab={tab} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The excerpt of the first row of the source, or its loading, error and empty lines. */
function WhyMeaning({ quote, tab }: { quote: QuoteDto; tab: StudyTabId }) {
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  const { data, isLoading, isError, refetch } = useQuoteExplanations(quote.id);
  const handleRetry = useCallback(() => void refetch(), [refetch]);
  const row = useMemo(() => (data ? pickTabRows(data, tab, english ? 'en' : 'ar')[0] : undefined), [data, tab, english]);

  if (isLoading) {
    return (
      <View style={styles.skeleton} accessibilityLabel={t('common.loading')}>
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton width="72%" height={14} />
        <Skeleton width={120} height={10} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.retry}>
        <Text variant="small" tone="muted">
          {t('study.error')}
        </Text>
        <Button label={t('common.retry')} onPress={handleRetry} variant="ghost" />
      </View>
    );
  }
  if (!row) {
    return (
      <Text variant="small" tone="muted">
        {tab === 'mukhtasar' ? t('study.emptyTafsir') : t('study.emptySharh')}
      </Text>
    );
  }

  const arabic = isArabicRow(row);
  const caption = studyCaption(row, arabic);
  return (
    <View style={styles.reading}>
      <Text variant="body" style={arabic ? styles.rtl : styles.ltr} textBreakStrategy="highQuality">
        {explanationSegments(studyExcerpt(row.text)).map((segment) =>
          segment.quran ? (
            <Text key={segment.start} variant="quran" tone="link" style={styles.verse}>
              {segment.text}
            </Text>
          ) : (
            segment.text
          ),
        )}
      </Text>
      {caption ? (
        <Text variant="caption" tone="muted">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
