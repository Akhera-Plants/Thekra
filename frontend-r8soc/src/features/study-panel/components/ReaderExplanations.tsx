'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { SegmentTabs } from '@/components/shared/kit/segment-tabs';
import { ReportMistakeButton } from '@/components/shared/quote/ReportMistake';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { getQuoteReader } from '../api';
import { hadithTabsForLocale, pickTabRows, type ExplanationRow } from '../lib/tabs';
import { StudyReading } from './StudyReading';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The reader's sections after the text (owner round 6, C-13 / C-01n), parted by the flower divider: «وجه التذكير» (only
 * when written for this topic↔text link; clearly labelled as our editorial line, «أبلغ عن خطأ» under it), then the
 * explanations — a verse's المختصر، السعدي، ابن عاشور (التحرير والتنوير), a hadith's sharh, fawaid and word meanings —
 * side by side as tabs, the reader picking one (owner round 7, B6: never stacked under each other, as before round 6). Everything comes from the database (`GET /quotes/:id/reader`); nothing is generated.
 * The English view shows only English rows (no Arabic prose on /en).
 */
export function ReaderExplanations({ quoteId, linkId, isHadith }: { quoteId: string; linkId: string | null; isHadith: boolean }) {
  const t = useTranslations('reader');
  const tTabs = useTranslations('studyPanel.tabs');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const link = linkId && UUID.test(linkId) ? linkId : null;
  const panelId = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [...queryKeys.quotes.detail(quoteId), 'reader', lang, link] as const,
    queryFn: async () => (await getQuoteReader(quoteId, lang, link)).data,
    staleTime: 5 * 60_000,
  });

  if (query.isPending) return <BrandLoader label={t('loading')} showLabel className="py-6 text-sm" />;
  if (query.isError) return <QueryErrorState error={query.error} message={t('error')} onRetry={() => void query.refetch()} className="py-6" />;

  const data = query.data;
  const sections: { key: string; title: string; full?: string; rows: ExplanationRow[] }[] = [];
  for (const tafsir of data.tafsirs) {
    if (lang === 'en' && tafsir.languageCode !== 'en') continue;
    const full = lang === 'en' ? tafsir.source.name : (tafsir.source.nameAr ?? tafsir.source.name);
    // The tab reads short («المختصر · السعدي · ابن عاشور»); the source's full name stays its accessible panel name.
    const short = t.has(`tafsirTabs.${tafsir.key}`) ? t(`tafsirTabs.${tafsir.key}`) : full;
    sections.push({
      key: tafsir.key,
      title: short,
      full,
      rows: tafsir.entries.map((entry) => ({
        id: entry.id,
        kind: 'TAFSIR',
        languageCode: tafsir.languageCode,
        text: entry.text,
        reference: entry.reference,
        source: tafsir.source,
      })),
    });
  }
  for (const tab of hadithTabsForLocale(lang)) {
    const rows = pickTabRows(data.explanations, tab, lang);
    if (rows.length > 0) sections.push({ key: tab, title: tTabs(tab), rows });
  }

  const active = sections.find((section) => section.key === picked) ?? sections[0] ?? null;

  return (
    <>
      {data.reminderAngle ? (
        <>
          <SectionDivider />
          <section aria-labelledby="reader-angle" className="flex flex-col gap-3">
            <h2 id="reader-angle" className="text-xl font-medium">
              {t('angleTitle')}
            </h2>
            <p
              lang={data.reminderAngle.languageCode}
              dir={data.reminderAngle.languageCode === 'ar' ? 'rtl' : 'ltr'}
              className="max-w-[68ch] text-lg leading-9"
            >
              {data.reminderAngle.text}
            </p>
            <p className="text-sm text-muted-foreground">{t('angleNote')}</p>
            {/* «أبلغ عن خطأ» under the line (C-01n), for every text: the report endpoint takes any type. */}
            <ReportMistakeButton quoteId={quoteId} className="self-start" />
          </section>
        </>
      ) : null}

      {sections.length > 0 && active ? (
        <>
          <SectionDivider />
          <section aria-labelledby="reader-explain" className="flex flex-col gap-5">
            <h2 id="reader-explain" className="text-xl font-medium">
              {isHadith ? t('sharhTitle') : t('tafsirTitle')}
            </h2>
            {sections.length > 1 ? (
              <SegmentTabs
                aria-label={isHadith ? t('sharhTitle') : t('tafsirTitle')}
                items={sections.map((section) => ({ value: section.key, label: section.title }))}
                value={active.key}
                onValueChange={setPicked}
                variant="segment"
                size="filled"
                controls={panelId}
                className={cn(
                  'min-w-0 w-full [&_[data-slot=tabs-list]]:w-full sm:[&_[data-slot=tabs-list]]:w-fit',
                  '[&_[data-slot=tabs-list]]:justify-start [&_[data-slot=tabs-list]]:overflow-x-auto [&_[data-slot=tabs-list]]:[scrollbar-width:none]',
                  '[&_[data-slot=tabs-trigger]]:min-w-fit',
                )}
                listClassName="w-full sm:w-fit"
              />
            ) : (
              <h3 className="text-base font-medium text-primary-text">{active.full ?? active.title}</h3>
            )}
            <div id={panelId} role={sections.length > 1 ? 'tabpanel' : undefined} aria-label={active.full ?? active.title}>
              <StudyReading key={active.key} rows={active.rows} hideCaption={active.full ?? active.title} />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
