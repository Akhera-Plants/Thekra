'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

interface ExplanationRow {
  id: string;
  text: string;
  reference: string | null;
  languageCode: string;
  source: { nameAr: string | null; name: string };
}

const WORKS_AR: ReadonlyArray<{
  titleAr: string;
  titleEn: string;
  match: (source: ExplanationRow['source']) => boolean;
}> = [
  {
    titleAr: 'تفسير السعدي',
    titleEn: "Tafsir al-Sa'di",
    match: (source) => source.nameAr === 'تفسير السعدي' || /sa'?di/i.test(source.name),
  },
  {
    titleAr: 'التحرير والتنوير',
    titleEn: 'Al-Tahrir wa al-Tanwir',
    match: (source) => source.nameAr === 'التحرير والتنوير' || /tahrir/i.test(source.name),
  },
];

/** English UI lists only Al-Mukhtasar. Sa'di and Tahrir stay on /ar. */
const WORKS_EN: ReadonlyArray<{
  titleAr: string;
  titleEn: string;
  match: (source: ExplanationRow['source']) => boolean;
}> = [
  {
    titleAr: 'المختصر في تفسير القرآن الكريم',
    titleEn: 'Al-Mukhtasar fi Tafsir al-Qur\'an',
    match: (source) => /mukhtasar|مختصر/i.test(source.name) || source.nameAr === 'المختصر في تفسير القرآن الكريم',
  },
];

function pickRows(all: ExplanationRow[], match: (source: ExplanationRow['source']) => boolean, locale: string): ExplanationRow[] {
  const forWork = all.filter((row) => match(row.source));
  if (locale === 'en') {
    return forWork.filter((row) => row.languageCode === 'en');
  }
  const preferred = forWork.filter((row) => row.languageCode === locale);
  return preferred.length > 0 ? preferred : forWork;
}

function Disclosure({
  title,
  rows,
  loaded,
  failed,
  emptyLabel,
  onOpen,
}: {
  title: string;
  rows: ExplanationRow[];
  loaded: boolean;
  failed: boolean;
  emptyLabel: string;
  onOpen: () => void;
}) {
  return (
    <details
      className="border-b border-border py-2"
      onToggle={(event) => {
        if (event.currentTarget.open) onOpen();
      }}
    >
      <summary className="cursor-pointer text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {title}
      </summary>
      {failed ? null : !loaded ? null : rows.length === 0 ? (
        <p className="pt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-4 pt-3">
          {rows.map((row) => {
            const arabic = row.languageCode === 'ar' || /[\u0600-\u06FF]/.test(row.text);
            const caption = arabic
              ? (row.reference ?? row.source.nameAr ?? title)
              : (row.source.name || row.reference || title);
            return (
              <figure key={row.id} className="flex flex-col gap-2">
                <blockquote
                  dir={arabic ? 'rtl' : 'ltr'}
                  lang={arabic ? 'ar' : 'en'}
                  className={arabic ? 'font-arabic-ui text-base leading-loose' : 'text-base leading-relaxed'}
                >
                  {row.text}
                </blockquote>
                <figcaption
                  dir={/[\u0600-\u06FF]/.test(caption) ? 'rtl' : 'ltr'}
                  lang={/[\u0600-\u06FF]/.test(caption) ? 'ar' : 'en'}
                  className="text-sm text-muted-foreground"
                >
                  {caption}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </details>
  );
}

/** Collapsed tafsir under a verse. Fetched the first time any accordion opens. */
export function VerseTafsir({ quoteId }: { quoteId: string }) {
  const t = useTranslations('quote');
  const locale = useLocale();
  const arabic = locale === 'ar';
  const [rows, setRows] = useState<ExplanationRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  function load() {
    if (rows || failed) return;
    void apiGet<ExplanationRow[]>(`/quotes/${quoteId}/explanations`, { params: { lang: locale } })
      .then((result) => setRows(result.data))
      .catch(() => setFailed(true));
  }

  const works = arabic ? WORKS_AR : WORKS_EN;

  return (
    <div className="flex flex-col">
      {works.map((work) => {
        const forWork = rows ? pickRows(rows, work.match, locale) : [];
        return (
          <Disclosure
            key={work.titleEn}
            title={arabic ? work.titleAr : work.titleEn}
            rows={forWork}
            loaded={rows !== null}
            failed={failed}
            emptyLabel={t('tafsirEmpty')}
            onOpen={load}
          />
        );
      })}
    </div>
  );
}
