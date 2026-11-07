'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import type { HadithGrade, QuoteType } from '@/lib/types/enums';
import { InfiniteQuoteList } from './InfiniteQuoteList';
import { QuoteFilters } from './QuoteFilters';

type BrowseTab = 'all' | 'quran' | 'hadith';

const TAB_TO_TYPES: Record<BrowseTab, QuoteType[] | undefined> = {
  all: undefined,
  quran: ['QURAN_VERSE'],
  hadith: ['HADITH'],
};

export function BrowseTabs() {
  const t = useTranslations('browse');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get('tab') ?? 'all') as BrowseTab;
  const grade = searchParams.get('grade') ?? undefined;
  const surah = searchParams.get('surah') ?? undefined;
  const sourceId = searchParams.get('source') ?? undefined;

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      params.set('tab', value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router],
  );

  const quoteParams = {
    type: TAB_TO_TYPES[tab],
    grades: grade ? ([grade] as HadithGrade[]) : undefined,
    surahNumber: surah ? Number(surah) : undefined,
    sourceId: sourceId || undefined,
    limit: 10,
  };

  return (
    // The site's segmented tabs (44px to touch, W-17), then the filters, then the list.
    <SegmentTabs
      aria-label={t('pageTitle')}
      items={[
        { value: 'all', label: t('tabAll') },
        { value: 'quran', label: t('tabQuran') },
        { value: 'hadith', label: t('tabHadith') },
      ]}
      value={tab}
      onValueChange={handleTabChange}
      className="gap-4"
    >
      <QuoteFilters
        tab={tab}
        grade={grade}
        surah={surah}
        sourceId={sourceId}
        onGradeChange={(v) => updateParam('grade', v)}
        onSurahChange={(v) => updateParam('surah', v)}
        onSourceChange={(v) => updateParam('source', v)}
      />
      {(['all', 'quran', 'hadith'] as BrowseTab[]).map((tabValue) => (
        <SegmentTabsContent key={tabValue} value={tabValue} className="mt-2">
          <InfiniteQuoteList params={quoteParams} />
        </SegmentTabsContent>
      ))}
    </SegmentTabs>
  );
}
