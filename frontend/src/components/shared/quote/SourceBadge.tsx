'use client';

import { useLocale } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { englishProvenance } from '@/lib/format/provenance';
import { collectorReferences } from '@/lib/format/grade-citation';
import type { QuoteDto } from '@/lib/types/api';
import { cn } from '@/lib/utils';

/**
 * A hadith's source as one badge beside its grade (owner round 7, B4): «صحيح البخاري، رقم 2595», or the book's name and
 * the reference when the reference does not already name it. The card and the reader both use it, so the source looks
 * the same everywhere and is said once. Null when there is nothing to show in the page language.
 */
export function SourceBadge({ quote, className }: { quote: Pick<QuoteDto, 'source' | 'hadith'> & Partial<Pick<QuoteDto, 'citation'>>; className?: string }) {
  const arabic = useLocale() === 'ar';
  const sourceName = arabic ? quote.source.nameAr : (quote.source.name || quote.source.nameAr);
  const source = sourceName && !(arabic && /[A-Za-z]/.test(sourceName)) ? sourceName : null;
  const sourceDir = source && /[؀-ۿ]/.test(source) ? 'rtl' : 'ltr';
  const raw = quote.hadith?.reference?.trim() || null;
  const reference =
    raw && !(arabic && /[A-Za-z]/.test(raw)) ? (arabic ? raw : (englishProvenance(raw) ?? raw)) : null;
  const showSource = Boolean(source && !(reference && reference.includes(source)));
  // The original collector, when it is another book than the one named (Riyad as-Salihin → Muslim 206): a second badge of
  // the same make, never a plain «رواه مسلم» line under them (owner round 7, B4).
  const collectors = collectorReferences({
    locale: arabic ? 'ar' : 'en',
    gradeAuthority: quote.citation?.gradeAuthority,
    gradeReference: quote.citation?.gradeReference,
    besideSource: [source, raw].filter(Boolean).join(' '),
  });
  if (!showSource && !reference && collectors.length === 0) return null;

  const pill = cn(
    'inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full',
    'border border-border/70 bg-background/80 px-2.5 py-1 text-[13px] text-foreground md:text-[14px]',
    arabic && 'font-arabic-ui',
  );

  return (
    <span className={cn('flex max-w-full flex-wrap items-center gap-1.5', className)}>
      {showSource || reference ? (
        <span className={pill}>
          {showSource ? (
            <span dir={sourceDir} lang={sourceDir === 'rtl' ? 'ar' : 'en'} className="min-w-0 truncate">
              {source}
            </span>
          ) : null}
          {showSource && reference ? <span aria-hidden className="h-3 w-px shrink-0 bg-border" /> : null}
          {reference ? (
            <FormattedNumber value={reference} className={cn('min-w-0', showSource ? 'tabular-nums text-muted-foreground' : undefined)} />
          ) : null}
        </span>
      ) : null}
      {collectors.map((line) => (
        <span key={line} className={pill}>
          <FormattedNumber value={line} className="tabular-nums" />
        </span>
      ))}
    </span>
  );
}
