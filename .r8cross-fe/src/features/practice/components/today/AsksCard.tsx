'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { addDays, answerDidIt, answerDidNot, pendingAsks, updatePlan, type Plan } from '@thekra/practice-core';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { WirdContext } from '../../hooks/useWirdContext';
import { usePlanWords } from '../plan-words';

/** Rows shown before «المزيد». */
const SHOWN = 2;

/**
 * «هل فعلتها؟» (round 6, C-01j): a recent asked day of a habit with no log asks one plain question — «فعلتها» logs the
 * day's amount, «لم أفعل» marks it (a corrected 0, synced). No empty entries; after the short window the day is just
 * «لم تتم» in «سجلّي». Newest day first; a toast after each answer.
 */
export function AsksCard({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.asks');
  const { snapshot, today, habits, planDays } = context;
  const { store } = snapshot;
  const [all, setAll] = useState(false);
  const asks = useMemo(
    () => pendingAsks(store, today, { ...planDays, isPeriodicAct: limitOptions(habits).isPeriodicAct }),
    [store, today, planDays, habits],
  );
  if (asks.length === 0) return null;
  const shown = all ? asks : asks.slice(0, SHOWN);
  return (
    <section aria-labelledby="asks-title" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h3 id="asks-title" className="text-base font-medium">
        {t('title')}
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((ask) => {
          const plan = store.plans.find((p) => p.id === ask.planId);
          return plan ? <AskRow key={`${ask.planId}-${ask.date}`} plan={plan} date={ask.date} context={context} /> : null;
        })}
      </ul>
      {asks.length > SHOWN ? (
        <Button variant="ghost" tone="primary" size="sm" className="self-start" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? t('less') : t('more', { n: formatDigits(asks.length - SHOWN) })}
        </Button>
      ) : null}
    </section>
  );
}

function AskRow({ plan, date, context }: { plan: Plan; date: string; context: WirdContext }) {
  const t = useTranslations('practice.asks');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { today, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const when = date === addDays(today, -1) ? t('yesterday') : formatGregorian(date, locale, true);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <p className="min-w-0 text-base leading-7">
        <span className="font-medium" lang={words.titleLang}>
          {words.title}
        </span>
        <span className="text-sm text-muted-foreground"> · {when}</span>
      </p>
      <ActionPair layout="hug">
        <Button
          size="sm"
          onClick={() => {
            updateStore((s) => updatePlan(s, plan.id, (p) => answerDidIt(s, p, date, today)));
            toast.success(t('savedDid'));
          }}
        >
          {t('did')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          onClick={() => {
            updateStore((s) => updatePlan(s, plan.id, (p) => answerDidNot(p, date, today)));
            toast.success(t('savedDidNot'));
          }}
        >
          {t('didNot')}
        </Button>
      </ActionPair>
    </li>
  );
}
