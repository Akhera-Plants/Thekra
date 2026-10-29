import { useEffect } from 'react';
import { normalize, type Plan } from '@thekra/practice-core';
import { updateStore } from '@/lib/practice/local-store';

/**
 * A season that has ended returns the plan to its everyday amount, with no penalty (practice-core `normalize`).
 * Deliberately not through `updatePlan`: the end is derived from the date, so it is not a new edit (no `updatedAt`).
 */
export function useEndedSeasons(plans: readonly Plan[] | undefined, today: string | null): void {
  useEffect(() => {
    if (!today || !plans?.some((plan) => plan.season && today > plan.season.until)) return;
    updateStore((store) => ({ ...store, plans: store.plans.map((plan) => normalize(plan, today)) }));
  }, [plans, today]);
}
