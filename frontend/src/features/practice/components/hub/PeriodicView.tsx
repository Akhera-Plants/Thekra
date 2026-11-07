'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { limits, upsertPlan, type LimitKind } from '@thekra/practice-core';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { limitOptions, periodicTemplates, planFromTemplate } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { periodicActsOnly } from '@/lib/practice/wird';
import { formatDigits } from '@/lib/format/digits';
import type { PracticeHabit } from '@/lib/types/practice';
import { useWirdContext } from '../../hooks/useWirdContext';
import { LimitSheet } from '../LimitSheet';
import { PracticeLoading } from '../PracticeLoading';
import { PeriodicRows } from './PeriodicRows';

/**
 * «أعمال دورية» (mirrors the app's screen): every act that does not repeat each day, soonest first: people (each list
 * one act; added and edited on its people page) and the dated acts (each opens its plan). Below, «أضف عملًا دوريًا»
 * lists the catalog templates; adding past the 7 acts opens the limit sheet. The «عاداتي › الدورية» tab (round 5, F-14 a:
 * the one home of periodic acts), with the entry to «أهلي وناسي» first (F-15 a).
 */
export function PeriodicView() {
  const t = useTranslations('practice.periodic');
  const tNav = useTranslations('nav.menuItems');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const [limitOpen, setLimitOpen] = useState<LimitKind | null>(null);
  const acts = useMemo(
    () => (context ? periodicActsOnly(context.snapshot.store, context.today, context.planDays, context.habits) : []),
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
    toast.success(t('addedToast', { title: locale === 'en' ? habit.titleEn : habit.titleAr }));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <Link
        href="/practice/people"
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary-text">
          <Users className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-medium">{tNav('people')}</span>
          <span className="text-sm leading-6 text-muted-foreground">{t('peopleHint')}</span>
        </span>
        <DirectionalArrow className="size-5 text-primary-text" />
      </Link>
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

      {acts.length > 0 ? <SectionDivider /> : null}

      <section aria-labelledby="periodic-add" className="flex flex-col gap-3">
        <h2 id="periodic-add" className="text-xl font-medium">
          {t('add')}
        </h2>
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-7">{t('remindersOnly')}</p>
        <p className="text-sm text-muted-foreground">
          {t('count', { n: formatDigits(planLimits.periodic.count), max: formatDigits(planLimits.periodic.max) })}
        </p>
        {catalog.isError ? <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} className="py-4" /> : null}
        <ul className="flex flex-col divide-y divide-border border-b border-border">
          {templates.map((habit) => {
            const title = locale === 'en' ? habit.titleEn : habit.titleAr;
            return (
              <li key={habit.key} className="flex min-h-14 items-center gap-3 px-2 py-2">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary-text [&_svg]:size-[1.125rem]">
                  {habit.people ? <Users /> : <Plus />}
                </span>
                <span className="flex-1 text-base leading-7 font-medium">{title}</span>
                {/* One row shape (W-15): every action is the compact 44px outline button; «مضاف» is a state, so a badge. */}
                {habit.people ? (
                  <Button asChild variant="outline" tone="primary" size="sm">
                    <Link href={{ pathname: '/practice/people', hash: `circle-${habit.people}` }}>
                      {t('openList')} <DirectionalArrow />
                    </Link>
                  </Button>
                ) : added.has(habit.key) ? (
                  <span className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-medium text-primary-text">
                    <Check aria-hidden className="size-4" />
                    {t('added')}
                  </span>
                ) : (
                  <Button variant="outline" tone="primary" size="sm" icon={<Plus aria-hidden />} onClick={() => addTemplate(habit)}>
                    {t('addOne')}
                  </Button>
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
        store={snapshot.store}
        habits={habits}
        today={today}
      />
    </div>
  );
}
