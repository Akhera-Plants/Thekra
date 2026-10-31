'use client';

import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { limits, periodicActs, upsertPlan, type LimitKind } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { limitOptions, periodicTemplates, planFromTemplate } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import type { PracticeHabit } from '@/lib/types/practice';
import { useWirdContext } from '../../hooks/useWirdContext';
import { LimitSheet } from '../LimitSheet';
import { PracticeLoading } from '../PracticeLoading';
import { PeriodicRows } from './PeriodicRows';

/**
 * «أعمال دورية» (mirrors the app's screen): every act that does not repeat each day, soonest first: people (each list
 * one act; added and edited on its people page) and the dated acts (each opens its plan). Below, «أضف عملًا دوريًا»
 * lists the catalog templates; adding past the 7 acts opens the limit sheet. Reached from «ورد اليوم» and «سجلّي».
 */
export function PeriodicView() {
  const t = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const [limitOpen, setLimitOpen] = useState<LimitKind | null>(null);
  const acts = useMemo(
    () => (context ? periodicActs(context.snapshot.store, context.today, context.planDays) : []),
    [context],
  );
  const planLimits = useMemo(
    () => (context ? limits(context.snapshot.store, context.today, limitOptions(context.habits)) : null),
    [context],
  );
  if (!context || !planLimits) return <PracticeLoading />;
  const { snapshot, today, habits, catalog } = context;
  const relatives = acts.filter((act) => act.kind === 'relative');
  const plans = acts.filter((act) => act.kind === 'habit');
  const templates = periodicTemplates(catalog.data?.habits ?? []);
  const added = new Set(snapshot.store.plans.map((p) => p.habitKey));

  function addTemplate(habit: PracticeHabit) {
    if (!planLimits?.canAdd('periodic')) {
      setLimitOpen('periodic');
      return;
    }
    updateStore((store) => upsertPlan(store, planFromTemplate(habit, today)));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {acts.length === 0 ? <p className="text-muted-foreground">{t('empty')}</p> : null}

      {relatives.length > 0 ? (
        <section aria-labelledby="periodic-kinship" className="flex flex-col gap-3">
          <h2 id="periodic-kinship" className="text-xl font-medium">
            {t('kinship')}
          </h2>
          <PeriodicRows acts={relatives} store={snapshot.store} today={today} habits={habits} />
        </section>
      ) : null}

      {plans.length > 0 ? (
        <section aria-labelledby="periodic-habits" className="flex flex-col gap-3">
          <h2 id="periodic-habits" className="text-xl font-medium">
            {t('habitsTitle')}
          </h2>
          <PeriodicRows acts={plans} store={snapshot.store} today={today} habits={habits} />
        </section>
      ) : null}

      <section aria-labelledby="periodic-add" className="flex flex-col gap-3">
        <h2 id="periodic-add" className="text-xl font-medium">
          {t('add')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('count', { n: planLimits.periodic.count, max: planLimits.periodic.max })}
        </p>
        {catalog.isError ? <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} className="py-4" /> : null}
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {templates.map((habit) => {
            const title = locale === 'en' ? habit.titleEn : habit.titleAr;
            return (
              <li key={habit.key} className="flex min-h-14 items-center gap-3 px-2 py-2">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-[1.125rem]">
                  {habit.people ? <Users /> : <Plus />}
                </span>
                <span className="flex-1 text-base leading-7 font-medium">{title}</span>
                {habit.people ? (
                  <Link href={{ pathname: '/practice/kinship', query: { circle: habit.people } }} className="text-link">
                    {t('openList')} <DirectionalArrow />
                  </Link>
                ) : added.has(habit.key) ? (
                  <span className="text-sm text-muted-foreground">{t('added')}</span>
                ) : (
                  <button type="button" className="outline-button button-wrap !mt-0" onClick={() => addTemplate(habit)}>
                    {t('addOne')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <LimitSheet
        kind={limitOpen ?? 'periodic'}
        open={limitOpen !== null}
        onOpenChange={(open) => (open ? undefined : setLimitOpen(null))}
        limits={planLimits}
        habits={habits}
        today={today}
      />
    </div>
  );
}
