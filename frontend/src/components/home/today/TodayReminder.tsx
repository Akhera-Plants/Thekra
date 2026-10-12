'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { useToggleFavorite } from '@/features/favorites/hooks/useToggleFavorite';
import { formatDigits } from '@/lib/format/digits';
import type { QuoteDto } from '@/lib/types/api';

export function TodayReminder({ quote }: { quote: QuoteDto }) {
  const t = useTranslations('home');
  const tFav = useTranslations('favorites');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const citation = quote.hadith?.reference ?? null;
  const { toggle, isPending } = useToggleFavorite({
    labels: {
      added: tFav('added'),
      removed: tFav('removed'),
      error: tFav('error'),
      authRequired: tFav('authRequired'),
    },
  });

  async function share() {
    const text = [quote.textAr, formatDigits(citation ?? '', locale === 'ar')].filter(Boolean).join('\n');
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
      <blockquote dir="rtl" lang="ar" className="font-arabic-text text-2xl leading-loose text-foreground md:text-3xl">
        {quote.textAr}
      </blockquote>
      {citation ? (
        <p className="text-sm text-muted-foreground">
          <FormattedNumber value={citation} />
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
