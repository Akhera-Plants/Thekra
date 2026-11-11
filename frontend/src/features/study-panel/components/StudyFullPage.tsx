'use client';

import { useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { Link } from '@/i18n/navigation';
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
  const panelId = useId();
  const locale = useLocale();
  const search = useSearchParams();
  const router = useRouter();
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
          controls={panelId}
        />
      ) : null}

      {/* The one panel every tab controls (W-18: aria-controls must name an element that exists). */}
      <div id={panelId} role={availableTabs.length > 0 ? 'tabpanel' : undefined} aria-label={isVerse ? t('titleTafsir') : t('titleSharh')}>
        {isLoading ? (
          <BrandLoader label={t('loading')} showLabel className="text-sm" />
        ) : isError ? (
          <QueryErrorState error={error} message={t('error')} onRetry={() => void refetch()} className="py-8" />
        ) : availableTabs.length === 0 ? (
          // One honest sentence (the app says the same), then the next step: the text itself, or back to where they came from.
          <div className="flex flex-col items-start gap-4">
            <p className="text-base text-muted-foreground">{isVerse ? t('emptyTafsir') : t('emptySharh')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" tone="primary" size="md">
                <Link href={`/quotes/${quote.id}`}>{t('readText')}</Link>
              </Button>
              <Button type="button" variant="outline" tone="neutral" size="md" onClick={() => router.back()}>
                {t('back')}
              </Button>
            </div>
          </div>
        ) : (
          <StudyReading rows={activeRows} />
        )}
      </div>
    </div>
  );
}
