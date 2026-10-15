'use client';

import { useLocale } from 'next-intl';
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
 */
export function QuoteBody({ quote, size = 'xl', className, children }: QuoteBodyProps) {
  const locale = useLocale();
  const scripture = quote.type === QuoteType.HADITH || quote.type === QuoteType.QURAN_VERSE;
  const english = locale === 'en' && scripture && quote.translation?.text;

  if (english) {
    return (
      <blockquote
        dir="ltr"
        lang="en"
        className={cn(
          'border-none ps-0 text-foreground',
          size === 'hero' ? 'text-2xl leading-relaxed md:text-3xl' : 'text-xl leading-relaxed md:text-2xl',
          className,
        )}
      >
        {english}
        {children}
      </blockquote>
    );
  }

  return (
    <ArabicText
      as="blockquote"
      size="xl"
      face="display"
      className={cn('border-none ps-0', size === 'hero' && 'text-2xl leading-loose md:text-3xl', className)}
    >
      {quote.textAr}
      {children}
    </ArabicText>
  );
}
