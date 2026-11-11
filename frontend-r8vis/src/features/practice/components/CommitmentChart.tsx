'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Plan } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { weeklyCommitment } from '@/lib/practice/commitment';

const W = 280;
const H = 88;
const GAP = 8;
const LABEL = 18;

const percent = (ratio: number) => Math.round(ratio * 100);

/**
 * The commitment rate of one habit, week by week (owner round 3, item 9): eight bars in the brand green, the latest
 * on the reading end, a faint line at 100%. Weeks before the habit began are an empty outline. Screen readers get the
 * same numbers as a list. Plain SVG: no chart library.
 */
export function CommitmentChart({ plan, today, label }: { plan: Plan; today: string; label: string }) {
  const t = useTranslations('practice.progress.chart');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const bars = weeklyCommitment(plan, today);
  const last = bars[bars.length - 1];
  const barW = (W - GAP * (bars.length - 1)) / bars.length;
  const plot = H - LABEL;
  return (
    <figure className="flex w-full max-w-sm flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-medium">{t('title')}</span>
        {last?.ratio != null ? (
          <span className="text-muted-foreground">{t('thisWeek', { n: formatDigits(percent(last.ratio)) })}</span>
        ) : null}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rtl:-scale-x-100" role="img" aria-label={label}>
        <line x1={0} x2={W} y1={0.5} y2={0.5} className="stroke-border" strokeDasharray="3 4" />
        <line x1={0} x2={W} y1={plot} y2={plot} className="stroke-border" />
        {bars.map((bar, i) => {
          const x = i * (barW + GAP);
          if (bar.ratio === null) {
            return <rect key={bar.to} x={x + 0.5} y={plot - 6} width={barW - 1} height={6} rx={2} className="fill-none stroke-border" strokeDasharray="2 2" />;
          }
          const h = Math.max(2, bar.ratio * (plot - 2));
          return (
            <rect
              key={bar.to}
              x={x}
              y={plot - h}
              width={barW}
              height={h}
              rx={3}
              className={i === bars.length - 1 ? 'fill-primary' : 'fill-primary/55'}
            />
          );
        })}
      </svg>
      <ul className="sr-only">
        {bars.map((bar) => (
          <li key={bar.to}>
            {t('week', { date: formatGregorian(bar.to, locale) })}:{' '}
            {bar.ratio === null ? t('before') : t('percent', { n: formatDigits(percent(bar.ratio)) })}
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>{t('weeksAgo', { n: formatDigits(bars.length) })}</span>
        <span>{t('now')}</span>
      </p>
    </figure>
  );
}
