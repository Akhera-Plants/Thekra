'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bell, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  commitmentRates,
  FARD_LABELS,
  FARD_PRAYERS,
  FARD_STATS_DAYS,
  fardEnabled,
  fardStats,
  type Plan,
} from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { formatDigits } from '@/lib/format/digits';
import { limitOptions } from '@/lib/practice/limits';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit, PracticeOccasion } from '@/lib/types/practice';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { HabitPrograms } from '../HabitPrograms';
import { HijriOffsetDialog } from '../HijriOffsetSelect';
import { MonthPanel, StreakLine } from '../hub/HabitStats';
import { PracticeLoading } from '../PracticeLoading';
import { usePlanWords } from '../plan-words';

/**
 * «عاداتي › سجلّي» (round 5; it absorbs the old «مواسم الخير» calendar, F-17): the streak, the month with the marks of
 * the occasions that do not come every week (the weekly ones are one row under it), «ضبط الهجري» on the title line,
 * a link to the calendar subscription (now in «التنبيهات»), each habit's commitment, «الفرائض» counts when they are on,
 * and the member's «تخفَّف» programs by name. A tapped day opens its list (loggable for the last 7 days).
 */
export function RecordView() {
  const context = useWirdContext();
  const params = useSearchParams();
  const router = useRouter();
  // An old «أضف» link (`/practice/habits?add=1`) lands here through the redirect: «أضف» lives on «ورد اليوم».
  const add = params.get('add') === '1';
  const habit = params.get('habit');
  useEffect(() => {
    if (add) router.replace({ pathname: '/practice', query: habit ? { add: '1', habit } : { add: '1' } });
  }, [add, habit, router]);
  if (!context || add) return <PracticeLoading />;
  return <RecordBody context={context} />;
}

function isWeekly(occasion: PracticeOccasion): boolean {
  return occasion.rule.kind === 'weekdays';
}

function RecordBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.recordTab');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, habits, occasions, catalog } = context;
  const { store } = snapshot;
  const weekly = useMemo(() => (occasions ?? []).filter(isWeekly), [occasions]);
  // The month marks only the occasions that do not come every week (F-17).
  const monthContext = useMemo<WirdContext>(
    () => ({ ...context, occasions: occasions?.filter((o) => !isWeekly(o)) }),
    [context, occasions],
  );
  const rates = useMemo(() => commitmentRates(store, today, limitOptions(habits)), [store, today, habits]);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {store.plans.length > 0 ? <StreakLine context={context} /> : null}

      <section aria-label={t('monthTitle')} className="flex flex-col gap-4">
        <MonthPanel context={monthContext} action={<HijriOffsetDialog />} />
        {weekly.length > 0 ? (
          <p className="flex items-start gap-2 text-sm leading-7">
            <Repeat aria-hidden className="mt-1.5 size-4 shrink-0 text-intent-good-deed" />
            <span>
              <span className="text-muted-foreground">{t('weekly')} </span>
              {weekly.map((o, i) => (
                <span key={o.key}>
                  {i > 0 ? (locale === 'ar' ? '، ' : ', ') : null}
                  <Link href={`/good-deeds/${o.deed}`} className="text-link">
                    {locale === 'en' ? o.titleEn : o.titleAr}
                  </Link>
                </span>
              ))}
            </span>
          </p>
        ) : null}
        <Link href="/settings/notifications" className="text-link inline-flex items-center gap-2 self-start text-sm">
          <Bell aria-hidden className="size-4" />
          {t('subscribe')} <DirectionalArrow className="size-4" />
        </Link>
      </section>

      {rates.length > 0 ? (
        <>
          <SectionDivider />
          <section aria-labelledby="record-commitment" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="record-commitment" className="text-xl font-medium">
                {t('commitmentTitle')}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">{t('commitmentLead')}</p>
            </div>
            <ul className="flex flex-col divide-y divide-border border-b border-border">
              {rates.map((rate) => {
                const plan = store.plans.find((p) => p.id === rate.planId);
                return plan ? <CommitmentRow key={plan.id} plan={plan} percent={rate.percent} habit={habitOf(plan, habits)} /> : null;
              })}
            </ul>
          </section>
        </>
      ) : null}

      {fardEnabled(store) ? (
        <>
          <SectionDivider />
          <FardStats context={context} />
        </>
      ) : null}

      <SectionDivider />
      <HabitPrograms store={store} today={today} catalog={catalog.data} />
    </div>
  );
}

function CommitmentRow({ plan, percent, habit }: { plan: Plan; percent: number; habit: PracticeHabit | undefined }) {
  const words = usePlanWords(plan, habit);
  return (
    <li>
      <Link
        href={`/practice/habits/${plan.id}`}
        className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-base font-medium break-words" lang={words.titleLang}>
            {words.title}
          </span>
          <span aria-hidden className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ inlineSize: `${percent}%` }} />
          </span>
        </span>
        <span className="shrink-0 text-base tabular-nums">{formatDigits(percent)}%</span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

/** «الفرائض» in «سجلّي»: counts over the last 30 days only (no streak, no «missed» wording). */
function FardStats({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.recordTab');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const stats = fardStats(context.snapshot.store, context.today);
  const labels = FARD_LABELS[lang];
  return (
    <section aria-labelledby="record-fard" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="record-fard" className="text-xl font-medium">
          {labels.title}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {t('fardLead', { days: formatDigits(FARD_STATS_DAYS), onTime: formatDigits(stats.onTime), qada: formatDigits(stats.qada) })}
        </p>
      </div>
      <ul className="grid grid-cols-5 gap-2 text-center">
        {FARD_PRAYERS.map((prayer) => (
          <li key={prayer} className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-1 py-2.5">
            <span className="text-sm">{labels.prayers[prayer]}</span>
            <span className="text-lg font-medium tabular-nums">{formatDigits(stats.perPrayer[prayer].onTime)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('fardCountNote')}</p>
    </section>
  );
}
