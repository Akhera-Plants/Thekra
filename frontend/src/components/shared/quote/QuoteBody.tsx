'use client';

import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { QuoteType } from '@/lib/types/enums';
import { ArabicText } from '../ArabicText';

interface QuoteBodyProps {
  quote: {
    type: string;
    textAr: string;
    translation: { text: string } | null;
  };
  /** Home reminder is larger than a card. */
  size?: 'xl' | 'hero';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Confirmed hadiths and verses switch with the interface language.
 * The Arabic stays in the response; English replaces it on screen when a
 * translation from the confirming source is present. Scholar text stays Arabic.
 * No machine translation — missing English keeps Arabic with a short note.
 *
 * Quran uses Amiri Quran (`font-quran`); hadith and other Arabic use Thmanyah reading.
 */
export function QuoteBody({ quote, size = 'xl', className, children }: QuoteBodyProps) {
  const locale = useLocale();
  const t = useTranslations('quote');
  const scripture = quote.type === QuoteType.HADITH || quote.type === QuoteType.QURAN_VERSE;
  const english = locale === 'en' && scripture && quote.translation?.text;
  const isQuran = quote.type === QuoteType.QURAN_VERSE;

  if (english) {
    return (
      <blockquote
        dir="ltr"
        lang="en"
        className={cn(
          'border-none ps-0 text-foreground',
          size === 'hero'
            ? 'text-2xl leading-relaxed md:text-3xl'
            : 'text-xl leading-relaxed md:text-2xl',
          className,
        )}
      >
        {english}
        {children}
      </blockquote>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ArabicText
        as="blockquote"
        size="xl"
        face={isQuran ? 'quran' : 'text'}
        className={cn(
          'border-none ps-0 overflow-visible py-0.5 text-start',
          size === 'hero' &&
            (isQuran
              ? 'text-2xl leading-[2.15] md:text-3xl'
              : 'text-2xl leading-loose md:text-3xl'),
          className,
        )}
      >
        {quote.textAr}
        {children}
      </ArabicText>
      {locale === 'en' && scripture ? (
        <p dir="ltr" lang="en" className="text-sm text-muted-foreground">
          {t('noVerifiedTranslation')}
        </p>
      ) : null}
    </div>
  );
}
