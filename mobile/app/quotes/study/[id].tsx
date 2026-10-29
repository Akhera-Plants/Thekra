/**
 * «التفسير» for a verse, «الشرح» for a hadith: the website's study page (StudyFullPage under the page title)
 * pushed from the quote card. The text on top (verses in Amiri Quran), then one tab per source that has a
 * reading in the UI language (rules in src/lib/study/tabs.ts), then the reading with its source and reference.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BookMarked, WifiOff } from 'lucide-react-native';
import { useQuote, useQuoteExplanations } from '@/lib/api/quotes';
import { availableStudyTabs, pickTabRows, type ExplanationRow, type StudyTabId } from '@/lib/study/tabs';
import { QuoteType } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';
import { StudyReading, StudyReadingSkeleton } from '@/components/StudyReading';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { useIsOffline } from '@/lib/query-client';
import { EmptyState, ErrorState, Notice, PageHeader, Screen, SegmentTabs, Skeleton, Text } from '@/ui';

const NO_ROWS: ExplanationRow[] = [];

const makeStyles = (t: Theme) => ({
  quote: {
    gap: space.sm,
    paddingStart: space.lg,
    borderStartWidth: 2,
    borderStartColor: t.colors.ring,
  },
  reference: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.sm },
  ltr: { writingDirection: 'ltr' as const },
  rtl: { writingDirection: 'rtl' as const },
  study: { gap: space.xl },
  skeleton: { gap: space.lg },
});

export default function QuoteStudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = id ?? '';
  const { t } = useTranslation();
  const isOffline = useIsOffline();

  const { data: quote, isLoading, isError, isRefetching, refetch } = useQuote(quoteId);
  const explanations = useQuoteExplanations(quoteId);
  const refetchExplanations = explanations.refetch;
  const isRefreshing = isRefetching || explanations.isRefetching;

  const handleRefresh = useCallback(() => {
    void refetch();
    void refetchExplanations();
  }, [refetch, refetchExplanations]);

  if (isLoading) {
    return (
      <Screen edges={['bottom']}>
        <StudyScreenSkeleton />
      </Screen>
    );
  }

  if (isError || !quote) {
    return (
      <Screen edges={['bottom']} refreshing={isRefetching} onRefresh={handleRefresh}>
        {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
        <ErrorState message={isError ? undefined : t('errors.notFound')} onRetry={handleRefresh} />
      </Screen>
    );
  }

  const isVerse = quote.type === QuoteType.QURAN_VERSE;

  return (
    <Screen edges={['bottom']} refreshing={isRefreshing} onRefresh={handleRefresh}>
      <PageHeader title={isVerse ? t('study.titleTafsir') : t('study.titleSharh')} />
      {isOffline ? <Notice icon={WifiOff}>{t('common.offlineBanner')}</Notice> : null}
      <StudyQuote quote={quote} />
      {explanations.isLoading ? (
        <StudyReadingSkeleton />
      ) : explanations.isError ? (
        <ErrorState message={t('study.error')} onRetry={handleRefresh} />
      ) : (
        <StudyTabs quote={quote} rows={explanations.data ?? NO_ROWS} />
      )}
    </Screen>
  );
}

/** The sources as tabs (only those with a reading) and the reading of the chosen one. */
function StudyTabs({ quote, rows }: { quote: QuoteDto; rows: ExplanationRow[] }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { english } = useTheme();
  const locale = english ? 'en' : 'ar';
  const tabs = useMemo(() => availableStudyTabs(rows, quote.type, locale), [rows, quote.type, locale]);
  const [tab, setTab] = useState<StudyTabId | null>(null);
  const activeTab = tab && tabs.includes(tab) ? tab : (tabs[0] ?? null);
  const activeRows = useMemo(() => (activeTab ? pickTabRows(rows, activeTab, locale) : NO_ROWS), [rows, activeTab, locale]);
  const tabItems = useMemo(() => tabs.map((key) => ({ key, label: t(`study.tabs.${key}`) })), [tabs, t]);

  if (!activeTab) {
    const isVerse = quote.type === QuoteType.QURAN_VERSE;
    return <EmptyState icon={BookMarked} message={isVerse ? t('study.emptyTafsir') : t('study.emptySharh')} />;
  }

  return (
    <View style={styles.study}>
      <SegmentTabs items={tabItems} value={activeTab} onChange={setTab} />
      <StudyReading rows={activeRows} />
    </View>
  );
}

/** The text being read: its reference line, the Arabic, and in English the translation under it. */
function StudyQuote({ quote }: { quote: QuoteDto }) {
  const styles = useStyles(makeStyles);
  const { english } = useTheme();
  const isVerse = quote.type === QuoteType.QURAN_VERSE;
  const sourceName = english ? quote.source.name || quote.source.nameAr : quote.source.nameAr ?? quote.source.name;
  const surahName = english ? quote.quran?.surahName || quote.quran?.surahNameAr : quote.quran?.surahNameAr;
  const ayahKey = quote.quran?.surahNumber && quote.quran.ayahNumber ? `${quote.quran.surahNumber}:${quote.quran.ayahNumber}` : null;
  const hadithRef = quote.hadith?.reference?.trim() || null;
  const showSource = Boolean(sourceName && !(hadithRef && sourceName && hadithRef.includes(sourceName)));
  const translation = english ? quote.translation?.text : null;

  return (
    <View style={styles.quote}>
      <View style={styles.reference}>
        {isVerse ? (
          <>
            {surahName ? (
              <Text variant="caption" tone="muted">
                {surahName}
              </Text>
            ) : null}
            {ayahKey ? (
              <Text variant="caption" tone="muted" style={styles.ltr}>
                {ayahKey}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {showSource ? (
              <Text variant="caption" tone="muted">
                {sourceName}
              </Text>
            ) : null}
            {hadithRef ? (
              <Text variant="caption" tone="muted">
                {hadithRef}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <Text variant={isVerse ? 'quran' : 'reading'} style={styles.rtl} textBreakStrategy="highQuality" selectable>
        {quote.textAr}
      </Text>
      {translation ? <Text variant="body">{translation}</Text> : null}
    </View>
  );
}

/** The page's shape while the quote loads: title, the quoted text, then the readings. */
function StudyScreenSkeleton() {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.skeleton}>
      <Skeleton width={120} height={32} />
      <View style={styles.quote}>
        <Skeleton width={110} height={12} />
        <Skeleton height={18} />
        <Skeleton width="80%" height={18} />
      </View>
      <StudyReadingSkeleton />
    </View>
  );
}
