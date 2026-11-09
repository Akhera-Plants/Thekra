'use client';

import { useMemo, useState } from 'react';
import { limits, type LimitKind } from '@thekra/practice-core';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { isPeriodicTemplate, limitOptions } from '@/lib/practice/limits';
import type { WirdContext } from '../../hooks/useWirdContext';
import { HabitLimitSheet } from '../habits/HabitActions';
import { LimitSheet } from '../LimitSheet';
import { PlanSetup } from '../PlanSetup';
import { PracticeLoading } from '../PracticeLoading';

interface AddHabitFlowProps {
  context: WirdContext;
  /** A catalog habit key to start with (a good-deed page's «ابدأ بها»). */
  habitKey: string | null;
  /** Closes the flow (back to where it started: «اليوم» or «العادات»). */
  onClose: () => void;
}

/**
 * «أضف عادة» (`/practice?add=1` or `/practice/habits?add=1`, with `&habit=<key>` from a good-deed page). With 3 habits
 * the sheet says so first (round 6, C-01d: archive one or delete one, with the 3-day note); a place freed there goes on
 * with the steps. A periodic template past its limit shows the periodic limit sheet.
 */
export function AddHabitFlow({ context, habitKey, onClose }: AddHabitFlowProps) {
  const { snapshot, today, habits, catalog } = context;
  const plans = snapshot.store.plans;
  // The first habit's setup stays open after the plan is saved, for its last screen (the two switches).
  const [finishingFirst, setFinishingFirst] = useState(false);
  const [freed, setFreed] = useState(false);
  const planLimits = useMemo(() => limits(snapshot.store, today, limitOptions(habits)), [snapshot.store, today, habits]);
  const preselected = habitKey ? habits.get(habitKey) : undefined;
  const kind: LimitKind = isPeriodicTemplate(preselected) ? 'periodic' : 'sapling';

  if (catalog.isPending) return <PracticeLoading />;
  if (catalog.isError) return <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const limitReached = !finishingFirst && !freed && plans.length > 0 && !planLimits.canAdd(kind);
  if (limitReached && kind === 'sapling') {
    return (
      <HabitLimitSheet
        open
        onOpenChange={(open) => (open ? undefined : onClose())}
        store={snapshot.store}
        today={today}
        habits={habits}
        onFreed={() => setFreed(true)}
      />
    );
  }
  if (limitReached) {
    return (
      <LimitSheet
        kind={kind}
        open
        onOpenChange={(open) => (open ? undefined : onClose())}
        limits={planLimits}
        store={snapshot.store}
        habits={habits}
        today={today}
        onFreed={() => setFreed(true)}
      />
    );
  }

  return (
    <PlanSetup
      habits={catalog.data.habits.filter((h) => !isPeriodicTemplate(h) || h.key === habitKey)}
      existing={plans}
      preselected={habitKey}
      freeMinutes={snapshot.store.settings.freeMinutesPerDay}
      today={today}
      onDone={onClose}
      onCancel={onClose}
      onFirstPlan={() => setFinishingFirst(true)}
    />
  );
}
