'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { QuoteBody } from '@/components/shared/quote/QuoteBody';
import { QuoteType } from '@/lib/types/enums';
import { useToggleFavorite } from '@/features/favorites/hooks/useToggleFavorite';
import { formatDigits } from '@/lib/format/digits';
import { formatGradeCitation } from '@/lib/format/grade-citation';
import type { QuoteDto } from '@/lib/types/api';

export function TodayReminder({ quote }: { quote: QuoteDto }) {
  const t = useTranslations('home');
  const tFav = useTranslations('favorites');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const gradeLine = formatGradeCitation({
    locale: locale === 'en' ? 'en' : 'ar',
    gradeAuthority: quote.citation?.gradeAuthority,
    gradeReference: quote.citation?.gradeReference,
    grade: quote.hadith?.grade,
  });
  const sourceLine = quote.hadith?.reference ?? null;
  const { toggle, isPending } = useToggleFavorite({
    labels: {
      added: tFav('added'),
      removed: tFav('removed'),
      error: tFav('error'),
      authRequired: tFav('authRequired'),
    },
  });

  const english =
    locale === 'en' &&
    quote.translation &&
    (quote.type === QuoteType.HADITH || quote.type === QuoteType.QURAN_VERSE)
      ? quote.translation.text
      : null;

  async function share() {
    const text = [english ?? quote.textAr, formatDigits(gradeLine ?? sourceLine ?? '')]
      .filter(Boolean)
      .join('\n');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Closing the share sheet should still leave a copy available.
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <section className="flex max-w-prose flex-col gap-6">
      <h2 className="font-arabic-display text-3xl leading-tight md:text-4xl">{t('todayHeading')}</h2>
      <QuoteBody quote={quote} size="hero" />
      {gradeLine ? (
        <p className="text-sm text-muted-foreground">
          <FormattedNumber value={gradeLine} />
        </p>
      ) : null}
      {sourceLine && sourceLine !== gradeLine ? (
        <p className="text-sm text-muted-foreground">
          <FormattedNumber value={sourceLine} />
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={isPending}
          onClick={() => toggle(quote.id, quote.isFavorite ?? false)}
          className="home-press inline-flex min-h-11 items-center text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {quote.isFavorite ? tFav('remove') : t('save')}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="home-press inline-flex min-h-11 items-center text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? t('shared') : t('share')}
        </button>
      </div>
    </section>
  );
}
