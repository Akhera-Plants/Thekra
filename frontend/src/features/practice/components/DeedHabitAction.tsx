'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeStore } from '../hooks/usePracticeStore';

/**
 * The ONE action of a good-deed page (redesign §4.5; round 5, F-10 a, as in the app): «ابدأ عادة» opens the add flow on
 * «ورد اليوم» with this deed's catalog habit already chosen (`/practice?add=1&habit=<key>`); «في عاداتك» (outlined) when
 * it is already a habit on this device, opening its habit page; a people list (صلة الرحم…) opens «أهلي وناسي».
 * Hidden when no catalog habit maps to the deed.
 */
export function DeedHabitAction({ habits }: { habits: readonly PracticeHabit[] | undefined }) {
  const t = useTranslations('topic');
  const snapshot = usePracticeStore();
  const habit = habits?.find((h) => !h.people && h.kind !== 'periodic') ?? habits?.[0];
  if (!habit) return null;
  const plan = snapshot?.store.plans.find((p) => (p.habitKey ?? p.id) === habit.key);
  return (
    <div className="mt-5 flex flex-col items-start gap-2">
      {habit.people ? (
        <Button asChild variant="solid" tone="primary" size="md">
          <Link href={{ pathname: '/practice/people', hash: `circle-${habit.people}` }}>
            {t('makeHabit')} <DirectionalArrow />
          </Link>
        </Button>
      ) : plan ? (
        <Button asChild variant="outline" tone="primary" size="md">
          <Link href={`/practice/habits/${plan.id}`}>
            <Check aria-hidden />
            {t('habitAdded')}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="solid" tone="primary" size="md">
          <Link href={{ pathname: '/practice', query: { add: '1', habit: habit.key } }}>
            {t('makeHabit')} <DirectionalArrow />
          </Link>
        </Button>
      )}
      <p className="text-sm leading-7 text-muted-foreground">{t('makeHabitHint')}</p>
    </div>
  );
}
