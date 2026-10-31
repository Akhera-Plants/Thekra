'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatDigits } from '@/lib/format/digits';
import { wirdSummary } from '@/lib/practice/wird';
import { useWirdContext } from '../../hooks/useWirdContext';
import { StreakFlame } from './StreakFlame';

/**
 * The home's small «بقي عليك اليوم n · المداومة N» card, linking to «ورد اليوم». Shown only when this device has habit
 * plans (they live on the device; with an account they also sync). Nothing during the server render.
 */
export function HomeWirdCard() {
  const t = useTranslations('home');
  const tWird = useTranslations('practice.wird');
  const context = useWirdContext({ catalogOnlyWithPlans: true });
  const summary = useMemo(
    () => (context ? wirdSummary(context.snapshot.store, context.today, context.planDays) : null),
    [context],
  );
  if (!summary?.hasPlans) return null;

  return (
    <Link
      href="/practice"
      className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span>
        {summary.remaining > 0
          ? t('wirdLeft', { count: summary.remaining, n: formatDigits(summary.remaining) })
          : t('wirdDone')}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className="flex items-center gap-1" aria-label={tWird('streakLabel', { count: summary.streak, n: formatDigits(summary.streak) })}>
        <StreakFlame className="size-4" />
        <span aria-hidden className="tabular-nums">
          {formatDigits(summary.streak)}
        </span>
      </span>
    </Link>
  );
}
