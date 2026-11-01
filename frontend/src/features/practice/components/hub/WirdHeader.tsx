'use client';

import { useTranslations } from 'next-intl';
import { formatDigits } from '@/lib/format/digits';
import { AddMenu } from './AddMenu';
import { StreakFlame } from './StreakFlame';

interface WirdHeaderProps {
  /** The current streak; null hides the chip (no habit yet). */
  streak: number | null;
  /** The longest run: with a current streak of 0 the chip says «ابدأ مداومة جديدة اليوم» instead of a 0. */
  longest?: number;
  /** Opens «أضف» at once (`?add=1`, from the home page's «ابدأ بغرسٍ صغير»). */
  addOpen?: boolean;
}

/**
 * The title block of «ورد اليوم»: the title (no date line, owner 2026-11-01: the calendar holds the date), and on the
 * other side the streak chip (a gold flame and the number, never red) and «أضف», the page's one solid control.
 */
export function WirdHeader({ streak, longest = 0, addOpen = false }: WirdHeaderProps) {
  const t = useTranslations('practice.wird');

  return (
    <header className="page-heading flex !max-w-none flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <h1 id="page-title" tabIndex={-1} className="min-w-0">
        {t('title')}
      </h1>
      <div className="flex items-center gap-2">
        {streak === 0 && longest > 0 ? (
          <p className="flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-medium">
            <StreakFlame />
            {t('streakFresh', { n: formatDigits(longest) })}
          </p>
        ) : streak !== null ? (
          <p
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-base font-medium"
            aria-label={t('streakLabel', { count: streak, n: formatDigits(streak) })}
          >
            <StreakFlame />
            <span aria-hidden className="tabular-nums">
              {formatDigits(streak)}
            </span>
          </p>
        ) : null}
        <AddMenu defaultOpen={addOpen} />
      </div>
    </header>
  );
}
