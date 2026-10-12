'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

interface ExplanationRow {
  id: string;
  text: string;
  reference: string | null;
  languageCode: string;
  source: { nameAr: string | null; name: string };
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
          {rows.map((row) => (
            <figure key={row.id} className="flex flex-col gap-2">
              <blockquote dir="rtl" lang="ar" className="font-arabic-ui text-base leading-loose">
                {row.text}
              </blockquote>
              <figcaption dir="rtl" lang="ar" className="text-sm text-muted-foreground">
                {row.reference ?? row.source.nameAr ?? title}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </details>
  );
}

/** Collapsed tafsir under a verse. The text is fetched the first time either one opens. */
export function VerseTafsir({ quoteId }: { quoteId: string }) {
  const t = useTranslations('quote');
  const [rows, setRows] = useState<ExplanationRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  function load() {
    if (rows || failed) return;
    void apiGet<ExplanationRow[]>(`/quotes/${quoteId}/explanations`, { params: { lang: 'ar' } })
      .then((result) => setRows(result.data.filter((row) => row.languageCode === 'ar')))
      .catch(() => setFailed(true));
  }

  const sadi = rows?.filter((row) => row.source.nameAr === 'تفسير السعدي') ?? [];
  const ashur = rows?.filter((row) => row.source.nameAr === 'التحرير والتنوير') ?? [];

  return (
    <div className="flex flex-col">
      <Disclosure title="تفسير السعدي" rows={sadi} loaded={rows !== null} failed={failed} emptyLabel={t('tafsirEmpty')} onOpen={load} />
      <Disclosure title="التحرير والتنوير" rows={ashur} loaded={rows !== null} failed={failed} emptyLabel={t('tafsirEmpty')} onOpen={load} />
    </div>
  );
}
