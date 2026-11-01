'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { establishPlan, graduationReady, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { monthOf, type YearMonth } from '@/lib/practice/hub';
import { updatePrefs, updateStore } from '@/lib/practice/local-store';
import { wirdDay, wirdSummary } from '@/lib/practice/wird';
import type { WirdContext } from '../../hooks/useWirdContext';
import { usePlanWords } from '../PlanCard';
import { ExcuseToggle } from './ExcuseToggle';
import { HubMonth } from './HubMonth';
import { StreakFlame } from './StreakFlame';
import { TodayList } from './TodayList';

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

/** One calendar month; a tapped day opens its list under it (loggable for the last 7 days). */
export function MonthPanel({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.record');
  const tWird = useTranslations('practice.wird');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, habits, occasions, occasionBasis, planDays } = context;
  const { store, prefs } = snapshot;
  const showHijri = prefs.showHijri === true;
  const [picked, setPicked] = useState<string | null>(null);
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const pickedDay = useMemo(
    () => (picked ? wirdDay(store, picked, { occasions, ...planDays }) : null),
    [store, picked, occasions, planDays],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <HubMonth
          store={store}
          today={today}
          selected={picked}
          month={month}
          occasions={occasions}
          planDays={planDays}
          showHijri={showHijri}
          onSelect={(date) => setPicked((current) => (current === date ? null : date))}
          onMonthChange={setMonth}
        />
        <label className="flex min-h-11 items-center gap-3 self-start text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showHijri}
            onChange={(event) => updatePrefs((p) => ({ ...p, showHijri: event.target.checked }))}
          />
          {t('showHijri')}
        </label>
      </div>
      {picked && pickedDay ? (
        <TodayList
          title={picked === today ? tWird('today') : formatGregorian(picked, locale, true)}
          store={store}
          date={picked}
          today={today}
          day={pickedDay}
          habits={habits}
          occasionBasis={occasionBasis}
          footer={store.plans.length > 0 ? <ExcuseToggle store={store} today={today} date={picked} /> : null}
        />
      ) : null}
    </div>
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
      <p>
        <strong lang={words.titleLang}>{words.title}</strong> · {t('graduateOffer')}
      </p>
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
