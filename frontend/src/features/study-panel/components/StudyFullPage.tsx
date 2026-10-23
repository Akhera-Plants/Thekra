'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { QuoteBody } from '@/components/shared/quote/QuoteBody';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteType } from '@/lib/types/enums';
import { useExplanations } from '../hooks/useExplanations';
import {
  hadithTabsForLocale,
  pickTabRows,
  verseTabsForLocale,
  type StudyTabId,
} from '../lib/tabs';
import { StudyReading } from './StudyReading';

export function StudyFullPage({ quote }: { quote: QuoteDto }) {
  const t = useTranslations('studyPanel');
  const locale = useLocale();
  const search = useSearchParams();
  const isVerse = quote.type === QuoteType.QURAN_VERSE;
  const candidateTabs = isVerse
    ? verseTabsForLocale(locale)
    : hadithTabsForLocale(locale);

  const { data: rows = [], isLoading, isError, error, refetch } = useExplanations(quote.id, true);
  const availableTabs = useMemo(
    () => candidateTabs.filter((tab) => pickTabRows(rows, tab, locale).length > 0),
    [candidateTabs, rows, locale],
  );

  const requested = search.get('tab') as StudyTabId | null;
  const [tab, setTab] = useState<StudyTabId | null>(requested);
  const activeTab: StudyTabId | null =
    tab && availableTabs.includes(tab) ? tab : (availableTabs[0] ?? null);

  const activeRows = useMemo(
    () => (activeTab ? pickTabRows(rows, activeTab, locale) : []),
    [rows, activeTab, locale],
  );

  return (
    <div className="flex flex-col gap-8">
      <QuoteBody quote={quote} />

      {availableTabs.length > 0 && activeTab ? (
        <SegmentTabs
          aria-label={isVerse ? t('titleTafsir') : t('titleSharh')}
          items={availableTabs.map((value) => ({
            value,
            label: t(`tabs.${value}`),
          }))}
          value={activeTab}
          onValueChange={(value) => setTab(value as StudyTabId)}
          variant="segment"
          size="filled"
        />
      ) : null}

      {isLoading ? (
        <BrandLoader label={t('loading')} showLabel className="text-sm" />
      ) : isError ? (
        <QueryErrorState error={error} message={t('error')} onRetry={() => void refetch()} className="py-8" />
      ) : (
        <StudyReading rows={activeRows} />
      )}
    </div>
  );
}
