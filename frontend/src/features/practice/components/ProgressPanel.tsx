'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Plan } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { MONTH_DAYS, PROGRESS_DAYS, progressDays, type PlanToday } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { usePlanWords } from './PlanCard';

interface ProgressPanelProps {
  entries: { plan: Plan; habit: PracticeHabit | undefined; view: PlanToday }[];
  today: string;
}

/**
 * «وين وصلت»: open it on any day, even one with nothing done («العادات تستوحش»). Days done and a monthly
 * band in kind words; no streaks, no missed-day marks, no failure wording.
 */
export function ProgressPanel({ entries, today }: ProgressPanelProps) {
  const t = useTranslations('practice.progress');
  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-4">
      <h2 id="progress-title" className="text-2xl font-medium">
        {t('title')}
      </h2>
      <p className="text-muted-foreground">{t('lead')}</p>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {entries.map(({ plan, habit, view }) => (
          <ProgressRow key={plan.id} plan={plan} habit={habit} view={view} today={today} />
        ))}
      </ul>
    </section>
  );
}

function ProgressRow({
  plan,
  habit,
  view,
  today,
}: {
  plan: Plan;
  habit: PracticeHabit | undefined;
  view: PlanToday;
  today: string;
}) {
  const t = useTranslations('practice.progress');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const words = usePlanWords(plan, habit);
  const days = progressDays(plan, today);
  const doneCount = days.filter((day) => day.done).length;
  return (
    <li className="flex flex-col gap-2 py-5">
      <h3 className="text-lg font-medium" lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
        {words.title}
      </h3>
      <p className="text-sm leading-7">
        <strong className="font-medium text-primary">{t(`band.${view.band}`)}</strong>
        {' · '}
        {t('doneDays', { count: view.doneDaysInMonth, n: formatDigits(view.doneDaysInMonth), total: formatDigits(MONTH_DAYS) })}
      </p>
      <p className="text-sm leading-7 text-muted-foreground">
        {t('amountNow', { amount: words.amount(plan.amount) })}
        {' · '}
        {view.canIncrease || view.holdUntil <= today
          ? t('holdDone')
          : t('holdUntil', { date: formatGregorian(view.holdUntil, locale) })}
      </p>
      <div
        className="flex flex-wrap gap-1.5"
        role="img"
        aria-label={t('daysLabel', { n: formatDigits(doneCount), total: formatDigits(PROGRESS_DAYS) })}
      >
        {days.map((day) => (
          <span
            key={day.date}
            className={cn(
              'size-3 rounded-full border',
              day.done ? 'border-primary bg-primary' : 'border-border',
              day.beforeStart && 'opacity-30',
            )}
          />
        ))}
      </div>
    </li>
  );
}
