'use client';

/**
 * QuoteDetailAdminView — quote edit page: metadata editor + translation editor.
 * Shown at /admin/quotes/[id].
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAdminQuote } from '../hooks/useAdminQuotes';
import { QuoteForm } from './QuoteForm';
import { TranslationEditor } from './TranslationEditor';
import { ArabicText } from '@/components/shared/ArabicText';
import { GradeBadge } from '@/components/shared/quote/GradeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import type { QuoteDetailDto } from '@/lib/types/api';

interface QuoteDetailAdminViewProps {
  quoteId: string;
}

export function QuoteDetailAdminView({ quoteId }: QuoteDetailAdminViewProps) {
  const t = useTranslations('admin');
  const { data, isLoading, isError, refetch } = useAdminQuote(quoteId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState message={t('quotes.loadError')} onRetry={() => void refetch()} />;
  }

  const quote = data.data as QuoteDetailDto;

  return (
    <div className="flex flex-col gap-8">
      {/* Back link */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/admin/quotes">
            <ArrowLeft className="me-1 h-4 w-4 rtl:hidden" aria-hidden />
            <ArrowRight className="me-1 h-4 w-4 hidden rtl:block" aria-hidden />
            {t('common.back')}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{quote.type}</Badge>
          <Badge variant={quote.origin === 'LOCAL' ? 'default' : 'secondary'}>{quote.origin}</Badge>
          {quote.hadith?.grade && <GradeBadge grade={quote.hadith.grade} label={quote.hadith.grade} />}
        </div>
        <ArabicText as="h1" size="xl" className="font-semibold leading-loose">
          {quote.textAr}
        </ArabicText>
        <p className="text-sm text-muted-foreground">{quote.source.name}</p>
      </div>

      <Separator />

      {/* Edit form */}
      <section aria-label={t('quotes.editSection')}>
        <h2 className="mb-4 text-xl font-semibold">{t('quotes.editSection')}</h2>
        <QuoteForm existing={quote} />
      </section>

      <Separator />

      {/* Translation editor */}
      <TranslationEditor
        quoteId={quoteId}
        allTranslations={quote.allTranslations}
      />
    </div>
  );
}
