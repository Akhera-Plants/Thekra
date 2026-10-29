'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { amountLabel } from './amount-label';

interface DeedHabitsProps {
  /** The catalog habits of this deed (`schedule.habits` of the good-deed response). */
  habits: readonly PracticeHabit[];
}

/**
 * «اجعلها عادة» on a good-deed page: each habit opens the setup with it chosen (`?add=1&habit=<key>`), or its
 * plan when it is already a habit on this device. Without a habit for the deed, a quiet «أعنّي على فعل طاعة».
 */
export function DeedHabits({ habits }: DeedHabitsProps) {
  const t = useTranslations('goodDeedDetail.habit');
  const tHome = useTranslations('home');
  const tStart = useTranslations('practice.hub.start');
  const snapshot = usePracticeStore();

  if (habits.length === 0) {
    return (
      <Link href={{ pathname: '/practice/habits', query: { add: '1' } }} className="text-link self-start">
        {tHome('deedEntryLabel')} <DirectionalArrow />
      </Link>
    );
  }

  // Plan ids are UUIDs; the catalog habit is `habitKey`.
  const planByHabit = new Map((snapshot?.store.plans ?? []).map((plan) => [plan.habitKey ?? plan.id, plan.id]));
  return (
    <section className="next-step" aria-labelledby="deed-habits-title">
      <h2 id="deed-habits-title">
        <strong>{t('title')}</strong>
      </h2>
      <p>{tStart('habitsLine')}</p>
      <ul className="mt-3 flex flex-col">
        {habits.map((habit) => (
          <DeedHabitItem key={habit.key} habit={habit} planId={planByHabit.get(habit.key)} />
        ))}
      </ul>
    </section>
  );
}

function DeedHabitItem({ habit, planId }: { habit: PracticeHabit; planId: string | undefined }) {
  const t = useTranslations('goodDeedDetail.habit');
  const tSetup = useTranslations('practice.setup');
  const english = useLocale() === 'en';
  const timeHint = english ? habit.timeHintEn : habit.timeHintAr;
  const start = tSetup('startWith', {
    amount: amountLabel(habit.start.far, habit.unit, english ? habit.unitLabelEn : habit.unitLabelAr, english, habit.rakah),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-3">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{english ? habit.titleEn : habit.titleAr}</span>
        <span className="text-sm leading-7 text-muted-foreground">{timeHint ? `${timeHint} · ${start}` : start}</span>
      </span>
      {planId ? (
        <Link href={`/practice/habits#plan-${planId}`} className="text-link">
          <Check aria-hidden />
          {t('added')}
        </Link>
      ) : (
        <Link
          href={{ pathname: '/practice/habits', query: { add: '1', habit: habit.key } }}
          className="outline-button button-wrap"
        >
          {t('start')} <DirectionalArrow />
        </Link>
      )}
    </li>
  );
}
