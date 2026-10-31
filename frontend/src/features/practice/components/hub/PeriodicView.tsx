'use client';

import { useMemo } from 'react';
import { HeartHandshake, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { periodicActs } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { useWirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { PeriodicRows } from './PeriodicRows';

/**
 * «أعمال دورية» (mirrors the app's screen): every act that does not repeat each day, soonest first: relatives (صلة
 * الرحم; added and edited on the kinship page) and the habits whose rule is not daily (each opens its plan, where its
 * days are set). Reached from «ورد اليوم» («الكل») and from «سجلّي».
 */
export function PeriodicView() {
  const t = useTranslations('practice.periodic');
  const context = useWirdContext();
  const acts = useMemo(
    () => (context ? periodicActs(context.snapshot.store, context.today, context.planDays) : []),
    [context],
  );
  if (!context) return <PracticeLoading />;
  const { snapshot, today, habits } = context;
  const relatives = acts.filter((act) => act.kind === 'relative');
  const plans = acts.filter((act) => act.kind === 'habit');

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {acts.length === 0 ? <p className="text-muted-foreground">{t('empty')}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Link href="/practice/kinship" className="outline-button button-wrap !mt-0">
          <HeartHandshake aria-hidden />
          {t('addRelative')}
        </Link>
        <Link href={{ pathname: '/practice/habits', query: { add: '1' } }} className="outline-button button-wrap !mt-0">
          <Plus aria-hidden />
          {t('addHabit')}
        </Link>
      </div>

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
    </div>
  );
}
