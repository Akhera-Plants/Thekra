'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <Tabs value={tab} onValueChange={handleTabChange}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>
          <TabsTrigger value="quran">{t('tabQuran')}</TabsTrigger>
          <TabsTrigger value="hadith">{t('tabHadith')}</TabsTrigger>
        </TabsList>
        <QuoteFilters
          tab={tab}
          grade={grade}
          surah={surah}
          sourceId={sourceId}
          onGradeChange={(v) => updateParam('grade', v)}
          onSurahChange={(v) => updateParam('surah', v)}
          onSourceChange={(v) => updateParam('source', v)}
        />
      </div>

      {(['all', 'quran', 'hadith'] as BrowseTab[]).map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="mt-6">
          <InfiniteQuoteList params={quoteParams} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
