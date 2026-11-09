'use client';

import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeStore } from '../hooks/usePracticeStore';

/**
 * The action on a good-deed page's title line, opposite its name (owner round 6, C-12): «أضف إلى خطتك» opens the add
 * flow on «عاداتي» with this deed's catalog habit already chosen (`/practice?add=1&habit=<key>`; «ابدأ صغيرًا» now
 * lives in that flow, not here); «مُضاف إلى خطتك» (outlined) when it is already a habit on this device, opening its
 * habit page; a people list (صلة الرحم…) opens «الأعمال الدورية». Hidden when no catalog habit maps to the deed.
 */
export function DeedHabitAction({ habits }: { habits: readonly PracticeHabit[] | undefined }) {
  const t = useTranslations('topic');
  const snapshot = usePracticeStore();
  const habit = habits?.find((h) => !h.people && h.kind !== 'periodic') ?? habits?.[0];
  if (!habit) return null;
  const plan = snapshot?.store.plans.find((p) => (p.habitKey ?? p.id) === habit.key);
  if (plan) {
    return (
      <Button asChild variant="outline" tone="primary" size="md">
        <Link href={`/practice/habits/${plan.id}`}>
          <Check aria-hidden />
          {t('habitAdded')}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="solid" tone="primary" size="md">
      <Link href={habit.people ? { pathname: '/practice/periodic', hash: `circle-${habit.people}` } : { pathname: '/practice', query: { add: '1', habit: habit.key } }}>
        <Plus aria-hidden />
        {t('makeHabit')}
      </Link>
    </Button>
  );
}
