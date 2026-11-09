'use client';

import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { ReportMistakeButton } from '@/components/shared/quote/ReportMistake';
import { queryKeys } from '@/lib/query-keys';
import { getQuoteReader } from '../api';
import { hadithTabsForLocale, pickTabRows, type ExplanationRow } from '../lib/tabs';
import { StudyReading } from './StudyReading';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The reader's sections after the text (owner round 6, C-13 / C-01n), parted by the flower divider: «وجه التذكير» (only
 * when written for this topic↔text link; clearly labelled as our editorial line, «أبلغ عن خطأ» under it), then the
 * explanations inline without a click — a verse's المختصر، السعدي، ابن عاشور (التحرير والتنوير), a hadith's sharh,
 * fawaid and word meanings. Everything comes from the database (`GET /quotes/:id/reader`); nothing is generated.
 * The English view shows only English rows (no Arabic prose on /en).
 */
export function ReaderExplanations({ quoteId, linkId, isHadith }: { quoteId: string; linkId: string | null; isHadith: boolean }) {
  const t = useTranslations('reader');
  const tTabs = useTranslations('studyPanel.tabs');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const link = linkId && UUID.test(linkId) ? linkId : null;
  const query = useQuery({
    queryKey: [...queryKeys.quotes.detail(quoteId), 'reader', lang, link] as const,
    queryFn: async () => (await getQuoteReader(quoteId, lang, link)).data,
    staleTime: 5 * 60_000,
  });

  if (query.isPending) return <BrandLoader label={t('loading')} showLabel className="py-6 text-sm" />;
  if (query.isError) return <QueryErrorState error={query.error} message={t('error')} onRetry={() => void query.refetch()} className="py-6" />;

  const data = query.data;
  const sections: { key: string; title: string; rows: ExplanationRow[] }[] = [];
  for (const tafsir of data.tafsirs) {
    if (lang === 'en' && tafsir.languageCode !== 'en') continue;
    const title = lang === 'en' ? tafsir.source.name : (tafsir.source.nameAr ?? tafsir.source.name);
    sections.push({
      key: tafsir.key,
      title,
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
            {/* «أبلغ عن خطأ» under the line (C-01n). The report endpoint takes hadith only for now. */}
            {isHadith ? <ReportMistakeButton quoteId={quoteId} className="self-start" /> : null}
          </section>
        </>
      ) : null}

      {sections.length > 0 ? (
        <>
          <SectionDivider />
          <section aria-labelledby="reader-explain" className="flex flex-col gap-8">
            <h2 id="reader-explain" className="text-xl font-medium">
              {isHadith ? t('sharhTitle') : t('tafsirTitle')}
            </h2>
            {sections.map((section, index) => (
              <Fragment key={section.key}>
                {index > 0 ? <hr className="border-border" /> : null}
                <section aria-labelledby={`reader-${section.key}`} className="flex flex-col gap-3">
                  <h3 id={`reader-${section.key}`} className="text-base font-medium text-primary-text">
                    {section.title}
                  </h3>
                  <StudyReading rows={section.rows} hideCaption={section.title} />
                </section>
              </Fragment>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}
