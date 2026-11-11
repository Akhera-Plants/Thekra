'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminLabel } from '@/lib/format/admin-labels';
import { splitMatn } from '@/lib/format/isnad';
import type { AdminQuoteDto } from '@/lib/types/admin';
import { usePublicState } from '../../hooks/useAdminReview';
import { buildTrail } from '../../lib/trail';
import { ProvenanceTrail } from '../kit/ProvenanceTrail';
import { useTrailLabels } from '../kit/useTrailLabels';

export interface QuoteFolioProps {
  quote: AdminQuoteDto;
  onEdit: () => void;
}

/** One text, opened: the full text (isnad in pencil, matn in ink) and its «مسار النص». */
export function QuoteFolio({ quote, onEdit }: QuoteFolioProps) {
  const t = useTranslations('admin.quotesDesk');
  const tTrail = useTranslations('admin.trail');
  const locale = useLocale();
  const publicState = usePublicState(quote.id);
  const trailLabels = useTrailLabels();

  const steps = buildTrail(
    {
      type: quote.type,
      source: quote.source,
      chapter: quote.book?.pageOrChapter ?? null,
      volume: quote.citation.volume,
      page: quote.citation.page,
      gradeAuthority: quote.citation.gradeAuthority,
      gradeReference: quote.citation.gradeReference,
      hadithReference: quote.hadith?.reference ?? null,
      surah: quote.quran ? { name: quote.quran.surahNameAr ?? quote.quran.surahName, ayah: quote.quran.ayahNumber } : null,
      grade: quote.hadith?.grade ?? null,
      textSource: quote.textSource ?? null,
      textVerifiedAt: quote.textVerifiedAt ?? null,
    },
    publicState.isLoading ? 'loading' : (publicState.data ?? 'unknown'),
    tTrail,
    locale,
  );

  const { matn, stripped } = splitMatn(quote.textAr);
  const isnad = stripped ? quote.textAr.slice(0, quote.textAr.indexOf(matn)).trim() : '';
  const facts = [
    adminLabel('quoteType', quote.type, locale),
    adminLabel('origin', quote.origin, locale),
    quote.textSource
      ? `${t('textSource')}: ${adminLabel('textSource', quote.textSource, locale)}${quote.textVerifiedAt ? ` · ${t('verified')}` : ''}`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5 pt-3">
      <ProvenanceTrail steps={steps} labels={trailLabels} density="panel" />
      <p dir="rtl" lang="ar" className="max-w-prose font-arabic-text text-lg leading-loose text-pretty">
        {isnad ? <span className="text-muted-foreground">{isnad} </span> : null}
        {quote.type === 'QURAN_VERSE' ? <span className="font-quran">{matn}</span> : matn}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {quote.tags.length > 0 ? (
            <span>
              {t('tags')}: {quote.tags.map((tag) => (locale === 'en' ? tag.name : (tag.nameAr ?? tag.name))).join('، ')}
            </span>
          ) : null}
        </p>
        <Button size="sm" variant="outline" className="desk-press" onClick={onEdit}>
          <Pencil data-icon="inline-start" aria-hidden />
          {t('edit')}
        </Button>
      </div>
    </div>
  );
}
