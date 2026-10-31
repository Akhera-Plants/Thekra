import { useMemo } from 'react';
import type { PlanDayOptions } from '@thekra/practice-core';
import type { PracticeSnapshot } from '@/lib/practice/local-store';
import { planDayOptions } from '@/lib/practice/plans';
import type { PracticeHabit, PracticeOccasion, ScheduleBasis } from '@/lib/types/practice';
import { useEndedSeasons } from './useEndedSeasons';
import { usePracticeCatalog } from './usePracticeCatalog';
import { usePracticeStore } from './usePracticeStore';
import { useToday } from './useToday';

export interface WirdContext {
  snapshot: PracticeSnapshot;
  today: string;
  /** The local time now, `HH:MM` (follows the clock, every minute). */
  time: string;
  /** Catalog habits by key (titles, units, default rules). Empty until the catalog arrives. */
  habits: ReadonlyMap<string, PracticeHabit>;
  occasions: readonly PracticeOccasion[] | undefined;
  occasionBasis: ReadonlyMap<string, ScheduleBasis>;
  /** Which days each plan asks for (its rule, else the catalog's, else daily): the same answer the reminders use. */
  planDays: PlanDayOptions;
  catalog: ReturnType<typeof usePracticeCatalog>;
}

/**
 * What «ورد اليوم», «سجلّي», «أعمال دورية» and the home card read: the device store, today (following the clock) and
 * the catalog lookups. Null until the device store and clock are read (they do not exist during the server render).
 */
export function useWirdContext({ catalogOnlyWithPlans = false }: { catalogOnlyWithPlans?: boolean } = {}): WirdContext | null {
  const snapshot = usePracticeStore();
  const clock = useToday();
  // The home card needs the catalog (default rules) only on a device with plans: no request for other visitors.
  const catalog = usePracticeCatalog(!catalogOnlyWithPlans || (snapshot?.store.plans.length ?? 0) > 0);
  const today = clock?.today ?? null;
  const minutes = clock?.minutes ?? 0;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  useEndedSeasons(snapshot?.store.plans, today);
  const hijriOffset = snapshot?.store.settings.hijriOffset ?? 0;
  const occasions = catalog.data?.occasions;

  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );
  const occasionBasis = useMemo(
    () => new Map<string, ScheduleBasis>((occasions ?? []).map((o) => [o.key, o.basis])),
    [occasions],
  );
  const planDays = useMemo(() => planDayOptions(habits, hijriOffset), [habits, hijriOffset]);

  return useMemo(
    () => (snapshot && today ? { snapshot, today, time, habits, occasions, occasionBasis, planDays, catalog } : null),
    [snapshot, today, time, habits, occasions, occasionBasis, planDays, catalog],
  );
}
