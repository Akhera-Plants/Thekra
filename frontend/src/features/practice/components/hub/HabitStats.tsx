'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { establishPlan, graduationReady, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { formatDigits } from '@/lib/format/digits';
import { updateStore } from '@/lib/practice/local-store';
import { wirdSummary } from '@/lib/practice/wird';
import type { WirdContext } from '../../hooks/useWirdContext';
import { usePlanWords } from '../plan-words';
import { StreakFlame } from './StreakFlame';

/**
 * The statistics of «عاداتي» (owner, 2026-11-01: «السجل» and the habit page became one page). The streak line sits
 * above the tabs; the month is a tab of its own.
 */
export function StreakLine({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.record');
  const tWird = useTranslations('practice.wird');
  const { snapshot, today, planDays } = context;
  const summary = useMemo(() => wirdSummary(snapshot.store, today, planDays), [snapshot.store, today, planDays]);
  if (summary.display.kind === 'fresh') {
    return (
      <p className="flex items-center gap-2 text-lg">
        <StreakFlame className="size-6" />
        {tWird('streakFresh', { n: formatDigits(summary.display.longest) })}
      </p>
    );
  }
  return (
    <section aria-label={t('current')} className="flex flex-wrap items-end gap-x-4 gap-y-1">
      <p className="flex items-center gap-2">
        <StreakFlame className="size-8" />
        <span className="text-4xl leading-none font-medium tabular-nums">{formatDigits(summary.streak)}</span>
        <span className="text-lg">{t('current')}</span>
      </p>
      <p className="text-sm text-muted-foreground">{t('longest', { count: summary.longest, n: formatDigits(summary.longest) })}</p>
    </section>
  );
}

/** «رسخت هذه العادة بفضل الله. انقلها إلى الراسخة؟»: offered, never automatic. */
export function GraduationOffers({ context }: { context: WirdContext }) {
  const { snapshot, today, habits } = context;
  const ready = useMemo(() => snapshot.store.plans.filter((plan) => graduationReady(plan, today)), [snapshot.store, today]);
  return ready.map((plan) => <GraduationOffer key={plan.id} plan={plan} habits={habits} today={today} />);
}

function GraduationOffer({ plan, habits, today }: { plan: Plan; habits: ReadonlyMap<string, PracticeHabit>; today: string }) {
  const t = useTranslations('practice.today');
  const words = usePlanWords(plan, habitOf(plan, habits));
  return (
    <div className="next-step !mt-0 flex flex-col items-start gap-2">
      <p className="text-base font-medium" lang={words.titleLang}>
        {words.title}
      </p>
      <p>{t('graduateOffer')}</p>
      <Button
        className="h-auto whitespace-normal py-2 text-start"
        variant="outline"
        tone="primary"
        size="sm"
        onClick={() => updateStore((s) => updatePlan(s, plan.id, (p) => establishPlan(p, today)))}
      >
        {t('graduate')}
      </Button>
    </div>
  );
}
