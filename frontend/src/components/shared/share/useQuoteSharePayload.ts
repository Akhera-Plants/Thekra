'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { QuoteDto } from '@/lib/types/api';
import {
  quoteSharePayload,
  type QuoteShareOptions,
  type ShareLabels,
  type SharePayload,
} from '@/lib/share/share-text';

/** Localized labels for the share builder, from the same messages the quote card uses. */
export function useShareLabels(): ShareLabels {
  const tQuote = useTranslations('quote');
  const tShare = useTranslations('share');
  const tApp = useTranslations('app');
  return useMemo(
    () => ({
      siteName: tApp('name'),
      narrator: tQuote('narrator'),
      type: {
        quran: tQuote('type.quran'),
        hadith: tQuote('type.hadith'),
        athar: tQuote('type.athar'),
        scholar: tQuote('type.scholar'),
        book: tQuote('type.book'),
      },
      grade: {
        sahih: tQuote('grade.sahih'),
        hasan: tQuote('grade.hasan'),
        daif: tQuote('grade.daif'),
        mawdu: tQuote('grade.mawdu'),
      },
      weakNotice: tQuote('weakNotice'),
      outsideSahihayn: tQuote('outsideSahihayn'),
      atharNotice: tShare('atharNotice'),
      atharNarrated: (speaker: string) => tShare('atharNarrated', { speaker }),
    }),
    [tApp, tQuote, tShare],
  );
}

/** Share payload for one quote in the page language (text + attribution as displayed). */
export function useQuoteSharePayload(
  quote: QuoteDto,
  display?: QuoteShareOptions['display'],
): SharePayload {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const labels = useShareLabels();
  const displayBody = display?.body;
  const displayLang = display?.bodyLang;
  const displayAttribution = display?.attribution.join('\n');
  return useMemo(
    () =>
      quoteSharePayload(quote, {
        locale,
        labels,
        display:
          displayBody !== undefined && displayLang && displayAttribution !== undefined
            ? {
                body: displayBody,
                bodyLang: displayLang,
                attribution: displayAttribution ? displayAttribution.split('\n') : [],
              }
            : undefined,
      }),
    [quote, locale, labels, displayBody, displayLang, displayAttribution],
  );
}
