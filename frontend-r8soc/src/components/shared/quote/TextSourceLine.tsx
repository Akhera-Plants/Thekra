'use client';

import { useLocale } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import type { QuoteDto } from '@/lib/types/api';
import { cn } from '@/lib/utils';

/**
 * A text's source as one small line (W-06): «هود · 11:114» for a verse (the cards' surah + surah:ayah pattern), the book
 * and number for a hadith. Numbers are isolated so they never stick to the name (W-28). Null when nothing is known.
 */
export function TextSourceLine({ quote, className }: { quote: QuoteDto; className?: string }) {
  const arabic = useLocale() !== 'en';
  if (quote.quran?.surahNumber && quote.quran.ayahNumber) {
    const name = arabic ? quote.quran.surahNameAr : (quote.quran.surahName || null);
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {name ? (
          <>
            <span lang={arabic ? 'ar' : 'en'}>{name}</span>
            <span aria-hidden> · </span>
          </>
        ) : null}
        {/* Deliberate dir="ltr": surah:ayah reads left to right in both locales. */}
        <bdi dir="ltr" className="tabular-nums">
          <FormattedNumber value={quote.quran.surahNumber} />:<FormattedNumber value={quote.quran.ayahNumber} />
        </bdi>
      </p>
    );
  }
  const reference = quote.hadith?.reference?.trim();
  const book = arabic ? quote.source?.nameAr : quote.source?.name || null;
  const line = reference || book;
  if (!line || (arabic && /[A-Za-z]/.test(line))) return null;
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      <bdi>
        <FormattedNumber value={line} />
      </bdi>
    </p>
  );
}
