'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/shared/kit/button';
import { renderExplanationText } from '../lib/quranic-spans';
import { LONG_PREVIEW_CHARS, type ExplanationRow } from '../lib/tabs';

export function StudyReading({ rows }: { rows: ExplanationRow[] }) {
  const t = useTranslations('studyPanel');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {rows.map((row) => {
        const arabic = row.languageCode === 'ar' || /[\u0600-\u06FF]/.test(row.text);
        const long = row.text.length > LONG_PREVIEW_CHARS;
        const shown =
          long && !expanded ? `${row.text.slice(0, LONG_PREVIEW_CHARS).trimEnd()}…` : row.text;
        const caption =
          arabic
            ? (row.reference ?? row.source.nameAr ?? row.source.name)
            : (row.source.name || row.reference || '');

        return (
          <figure key={row.id} className="flex flex-col gap-3">
            <blockquote
              dir={arabic ? 'rtl' : 'ltr'}
              lang={arabic ? 'ar' : 'en'}
              className={
                arabic
                  ? 'max-w-[68ch] font-arabic-ui text-base leading-[1.9]'
                  : 'max-w-[68ch] font-english text-[16.5px] leading-[1.75] md:text-[17px]'
              }
            >
              {renderExplanationText(shown)}
            </blockquote>
            {long ? (
              <Button
                type="button"
                variant="ghost"
                tone="neutral"
                size="sm"
                className="self-start"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? t('readLess') : t('readMore')}
              </Button>
            ) : null}
            {caption ? (
              <figcaption
                dir={/[\u0600-\u06FF]/.test(caption) ? 'rtl' : 'ltr'}
                lang={/[\u0600-\u06FF]/.test(caption) ? 'ar' : locale}
                className="text-sm text-muted-foreground"
              >
                {caption}
              </figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}
