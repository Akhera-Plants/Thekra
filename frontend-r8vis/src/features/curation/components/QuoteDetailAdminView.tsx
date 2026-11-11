'use client';

/**
 * QuoteDetailAdminView — one text: its «مسار النص», the metadata editor and translations.
 * Shown at /admin/quotes/[id]. Data comes from useAdminQuote (seeded from the table row;
 * falls back to the public detail route because GET /admin/quotes/:id does not exist).
 */

import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Link } from '@/i18n/navigation';
import { adminLabel, sourceName } from '@/lib/format/admin-labels';
import { splitMatn } from '@/lib/format/isnad';
import type { AdminQuoteDto } from '@/lib/types/admin';
import type { QuoteDetailDto } from '@/lib/types/api';
import { usePublicState } from '../hooks/useAdminReview';
import { useAdminQuote } from '../hooks/useAdminQuotes';
import { buildTrail } from '../lib/trail';
import { PageHeader } from './kit/PageHeader';
import { ProvenanceTrail } from './kit/ProvenanceTrail';
import { GRADE_TONE, StatusBadge } from './kit/StatusBadge';
import { useTrailLabels } from './kit/useTrailLabels';
import { QuoteForm } from './QuoteForm';
import { TranslationEditor } from './TranslationEditor';

interface QuoteDetailAdminViewProps {
  quoteId: string;
}

export function QuoteDetailAdminView({ quoteId }: QuoteDetailAdminViewProps) {
  const t = useTranslations('admin');
  const tTrail = useTranslations('admin.trail');
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useAdminQuote(quoteId);
  const publicState = usePublicState(quoteId);
  const trailLabels = useTrailLabels();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-prose" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState message={t('quotes.loadError')} retryLabel={t('table.retry')} onRetry={() => void refetch()} />;
  }

  const quote = data.data as QuoteDetailDto & AdminQuoteDto;
  const { matn, stripped } = splitMatn(quote.textAr);
  const isnad = stripped ? quote.textAr.slice(0, quote.textAr.indexOf(matn)).trim() : '';
  const steps = buildTrail(
    {
      type: quote.type,
      source: quote.source,
      chapter: quote.book?.pageOrChapter ?? null,
      volume: quote.citation?.volume,
      page: quote.citation?.page,
      gradeAuthority: quote.citation?.gradeAuthority,
      gradeReference: quote.citation?.gradeReference,
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="-ms-2 self-start text-muted-foreground">
          <Link href="/admin/quotes">
            <ArrowRight data-icon="inline-start" aria-hidden className="ltr:hidden" />
            <ArrowLeft data-icon="inline-start" aria-hidden className="rtl:hidden" />
            {t('common.back')}
          </Link>
        </Button>
        <PageHeader
          title={sourceName(quote.source, locale)}
          meta={
            <span className="flex items-center gap-3">
              <span>{adminLabel('quoteType', quote.type, locale)}</span>
              <span>{adminLabel('origin', quote.origin, locale)}</span>
              {quote.type === 'HADITH' && quote.hadith?.grade ? (
                <StatusBadge tone={GRADE_TONE[quote.hadith.grade]} label={adminLabel('grade', quote.hadith.grade, locale)} size="md" />
              ) : null}
            </span>
          }
        />
        <ProvenanceTrail steps={steps} labels={trailLabels} density="panel" />
        <p dir="rtl" lang="ar" className="max-w-prose font-arabic-text text-xl leading-loose text-pretty">
          {isnad ? <span className="text-muted-foreground">{isnad} </span> : null}
          {quote.type === 'QURAN_VERSE' ? <span className="font-quran">{matn}</span> : matn}
        </p>
      </div>

      <Separator />

      <section aria-labelledby="quote-edit" className="flex flex-col gap-4">
        <h2 id="quote-edit" className="text-lg font-semibold">{t('quotes.editSection')}</h2>
        <QuoteForm existing={quote} />
      </section>

      <Separator />

      <TranslationEditor quoteId={quoteId} allTranslations={quote.allTranslations} />
    </div>
  );
}
