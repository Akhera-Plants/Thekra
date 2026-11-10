/**
 * The reader (owner round 6, C-13 / C-01n; our design): opened from a card's «عرض التفسير» / «عرض الشرح» as a native
 * form sheet (app/_layout.tsx; deep links open it the same way). Three parts separated by the flower divider, nothing
 * behind a click:
 * 1. the text: its reference line, the Arabic (verses in Amiri Quran), the English translation in the English UI, the
 *    grade; the verse's play button reads in the member's reciter (settings);
 * 2. «وجه التذكير» — only when the topic link (`?linkId=`) has one written (`GET /quotes/:id/reader`), labelled as
 *    our editorial wording, with «أبلغ عن خطأ» under it;
 * 3. the explanations: for a verse المختصر، السعدي، ابن عاشور (التحرير والتنوير); for a hadith its sharh, fawaid and the
 *    rest (src/lib/study/tabs.ts groups them) — side by side as tabs, the reader picking one (owner round 7, B6).
 * «أبلغ عن خطأ» is also at the end when there is no «وجه التذكير». Opening the reader marks the text «مقروء» (practice-core
 * reads.ts, synced with the account).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookMarked, Share2, WifiOff } from 'lucide-react-native';
import { isQuoteId, markRead } from '@thekra/practice-core';
import { useQuote, useQuoteReader, type QuoteReaderDto } from '@/lib/api/quotes';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { availableStudyTabs, pickTabRows, type ExplanationRow } from '@/lib/study/tabs';
import { HadithGrade, QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { StudyReading, StudyReadingSkeleton } from '@/components/StudyReading';
import { GradeBadge } from '@/components/GradeBadge';
import { VerseAudioButton } from '@/components/VerseAudioButton';
import { ReportMistakeSheet } from '@/components/ReportMistakeSheet';
import { ShareSheet } from '@/components/share/ShareSheet';
import { stripOuterQuotes } from '@/lib/quote-text';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { useIsOffline } from '@/lib/query-client';
import { EmptyState, ErrorState, IconButton, Notice, SectionDivider, SectionHeader, SegmentTabs, SheetScreen, Skeleton, Text, TextLink } from '@/ui';

const makeStyles = (t: Theme) => ({
  quote: { gap: space.md },
  head: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  reference: { flex: 1, flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 44 },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const },
  ltr: { writingDirection: 'ltr' as const },
  rtl: { writingDirection: 'rtl' as const },
  angle: { gap: space.sm, paddingStart: space.lg, borderStartWidth: 2, borderStartColor: t.colors.ring },
  part: { gap: space.lg },
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
  skeleton: { gap: space.lg },
});

export default function QuoteReaderScreen() {
  const { id, linkId } = useLocalSearchParams<{ id: string; linkId?: string }>();
  const quoteId = id ?? '';
  const { t } = useTranslation();
  const isOffline = useIsOffline();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const [reporting, setReporting] = useState(false);

  const { data: quote, isLoading, isError, refetch } = useQuote(quoteId);
  const reader = useQuoteReader(quoteId, typeof linkId === 'string' ? linkId : undefined);
  const refetchReader = reader.refetch;

  // Opening the reader is reading: the text is marked «مقروء» once the store is ready.
  useEffect(() => {
    if (hydrated && quote && isQuoteId(quote.id)) setStore((s) => markRead(s, quote.id));
  }, [hydrated, quote, setStore]);

  const handleRetry = useCallback(() => {
    void refetch();
    void refetchReader();
  }, [refetch, refetchReader]);

  if (isLoading) {
    return (
      <SheetScreen>
        <View style={styles.skeleton}>
          <Skeleton width={110} height={12} />
          <Skeleton height={18} />
          <Skeleton width="80%" height={18} />
        </View>
        <StudyReadingSkeleton />
      </SheetScreen>
    );
  }

  if (isError || !quote) {
    return (
      <SheetScreen>
        {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
        <ErrorState message={isError ? undefined : t('errors.notFound')} onRetry={handleRetry} />
      </SheetScreen>
    );
  }

  const angle = reader.data?.reminderAngle ?? null;
  return (
    <SheetScreen title={t('study.readerTitle')}>
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
      <ReaderQuote quote={quote} />

      {angle ? (
        <>
          <SectionDivider />
          <View style={styles.part}>
            <SectionHeader title={t('study.angle.title')} size="heading" />
            <View style={styles.angle}>
              <Text variant="reading" style={angle.languageCode === 'ar' ? styles.rtl : styles.ltr}>
                {angle.text}
              </Text>
              <Text variant="caption" tone="muted">
                {t('study.angle.editorial')}
              </Text>
            </View>
            <TextLink label={t('report.title')} onPress={() => setReporting(true)} />
          </View>
        </>
      ) : null}

      <SectionDivider />
      {reader.isLoading ? (
        <StudyReadingSkeleton />
      ) : reader.isError ? (
        <ErrorState message={t('study.error')} onRetry={handleRetry} />
      ) : (
        <ReaderExplanations quote={quote} data={reader.data} />
      )}

      {angle ? null : (
        <>
          <SectionDivider />
          <TextLink label={t('report.title')} onPress={() => setReporting(true)} />
        </>
      )}
      <ReportMistakeSheet quoteId={quote.id} visible={reporting} onClose={() => setReporting(false)} />
    </SheetScreen>
  );
}

/** The text being read: its reference, the actions (listen, share), the Arabic, the translation in English, the grade. */
function ReaderQuote({ quote }: { quote: QuoteDto }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { english } = useTheme();
  const [sharing, setSharing] = useState(false);
  const isVerse = quote.type === QuoteType.QURAN_VERSE;
  const sourceName = english ? quote.source.name || quote.source.nameAr : quote.source.nameAr ?? quote.source.name;
  const surahName = english ? quote.quran?.surahName || quote.quran?.surahNameAr : quote.quran?.surahNameAr;
  const surah = quote.quran?.surahNumber ?? null;
  const ayah = quote.quran?.ayahNumber ?? null;
  const hadithRef = quote.hadith?.reference?.trim() || null;
  const showSource = Boolean(sourceName && !(hadithRef && sourceName && hadithRef.includes(sourceName)));
  const translation = english ? quote.translation?.text : null;
  const grade = quote.type === QuoteType.HADITH && !quote.isAthar ? quote.hadith?.grade : null;

  return (
    <View style={styles.quote}>
      <View style={styles.head}>
        <View style={styles.reference}>
          {isVerse ? (
            <>
              {surahName ? (
                <Text variant="caption" tone="muted">
                  {surahName}
                </Text>
              ) : null}
              {surah && ayah ? (
                <Text variant="caption" tone="muted" style={styles.ltr}>
                  {`${surah}:${ayah}`}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {/* Beside the grade the source is a badge, as on the card (owner round 7, B4). */}
              {showSource || hadithRef ? (
                <View style={styles.capsule}>
                  {showSource ? (
                    <Text variant="caption" numberOfLines={1}>
                      {sourceName}
                    </Text>
                  ) : null}
                  {showSource && hadithRef ? <View style={styles.capsuleRule} /> : null}
                  {hadithRef ? (
                    <Text variant="caption" tone={showSource ? 'muted' : 'default'} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {hadithRef}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {grade && grade !== HadithGrade.UNGRADED ? <GradeBadge grade={grade} /> : null}
            </>
          )}
        </View>
        <View style={styles.actions}>
          {isVerse && surah && ayah ? <VerseAudioButton surah={surah} ayah={ayah} /> : null}
          {isVerse || quote.type === QuoteType.HADITH ? <IconButton icon={Share2} label={t('share.action')} onPress={() => setSharing(true)} /> : null}
        </View>
      </View>
      <Text variant={isVerse ? 'quran' : 'reading'} style={styles.rtl} textBreakStrategy="highQuality" selectable>
        {stripOuterQuotes(quote.textAr)}
      </Text>
      {translation ? <Text variant="body">{translation}</Text> : null}
      {quote.isAthar ? (
        <Text variant="caption" tone="muted">
          {t('share.atharNotice')}
        </Text>
      ) : null}
      {sharing ? <ShareSheet quote={quote} visible={sharing} onClose={() => setSharing(false)} showTranslation={Boolean(translation)} /> : null}
    </View>
  );
}

/** Part 3: the tafsirs (verses) or the hadith explanations, as tabs (round 7, B6). */
function ReaderExplanations({ quote, data }: { quote: QuoteDto; data: QuoteReaderDto | undefined }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { english } = useTheme();
  const locale = english ? 'en' : 'ar';
  const isVerse = quote.type === QuoteType.QURAN_VERSE;
  const [picked, setPicked] = useState<string | null>(null);

  const parts = useMemo(() => {
    if (!data) return [];
    if (isVerse) {
      return data.tafsirs
        .map((tafsir) => ({
          key: tafsir.key,
          title: t(`study.reader.${tafsir.key}`),
          tab: t(`study.readerTab.${tafsir.key}`),
          rows: tafsir.entries.map<ExplanationRow>((e) => ({
            id: e.id,
            kind: 'TAFSIR',
            languageCode: tafsir.languageCode,
            text: e.text,
            reference: e.reference,
            source: tafsir.source,
          })),
        }))
        .filter((p) => p.rows.length > 0);
    }
    const rows = data.explanations as ExplanationRow[];
    return availableStudyTabs(rows, quote.type, locale).map((tab) => ({ key: tab, title: t(`study.tabs.${tab}`), tab: t(`study.tabs.${tab}`), rows: pickTabRows(rows, tab, locale) }));
  }, [data, isVerse, quote.type, locale, t]);

  const active = parts.find((p) => p.key === picked) ?? parts[0] ?? null;

  if (!active) {
    return <EmptyState icon={BookMarked} message={isVerse ? t('study.emptyTafsir') : t('study.emptySharh')} />;
  }
  // Owner round 7 (B6): the tafsirs (and a hadith's explanations) sit side by side as tabs — «المختصر · السعدي · ابن
  // عاشور» — and the reader picks one; never stacked under each other.
  return (
    <View style={styles.part}>
      {parts.length > 1 ? (
        <SegmentTabs items={parts.map((p) => ({ key: p.key, label: p.tab }))} value={active.key} onChange={setPicked} />
      ) : (
        <SectionHeader title={active.title} size="heading" />
      )}
      <StudyReading key={active.key} rows={active.rows} />
    </View>
  );
}
