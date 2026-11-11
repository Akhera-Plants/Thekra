/**
 * The redesign limits (§3) in the extension, through practice-core `limits`: at most 3 saplings and 8 periodic acts
 * (plans from a catalog template with `kind: periodic`). The extension has no people lists and no «تخفَّف» program,
 * so only plans count here. Pure, for Node tests.
 */
import { createPlan, limits, type LocalDate, type Plan, type Store } from '@thekra/practice-core';
import type { Habit } from './catalog.js';

export type LimitError = 'errorLimitSapling' | 'errorLimitPeriodic';

export function isPeriodicActOf(catalog: readonly Habit[]): (plan: Plan) => boolean {
  return (plan) => catalog.find((h) => h.key === plan.habitKey)?.kind === 'periodic';
}

/**
 * The limit a settings save would break: the store as it would be after the save (catalog plans selected in the
 * draft, plans without a catalog habit kept) compared with the store now. A limit already exceeded (e.g. from
 * another device) blocks only an addition, never a save that does not add.
 */
export function draftLimitError(store: Store, selected: ReadonlySet<string>, catalog: readonly Habit[], today: LocalDate): LimitError | null {
  const known = new Set(catalog.map((h) => h.key));
  const kept = store.plans.filter((p) => p.habitKey === undefined || !known.has(p.habitKey) || selected.has(p.habitKey));
  const added = catalog
    .filter((h) => selected.has(h.key) && !store.plans.some((p) => p.habitKey === h.key))
    .map((h) =>
      createPlan({
        id: `draft-${h.key}`,
        habitKey: h.key,
        deedSlug: h.deed,
        title: h.titleAr,
        unit: h.unit,
        amount: h.start?.near ?? 1,
        activeDaysPerWeek: 2,
        slots: h.defaultSlots,
        createdOn: today,
      }),
    );
  const opts = { isPeriodicAct: isPeriodicActOf(catalog) };
  const before = limits(store, today, opts);
  const after = limits({ ...store, plans: [...kept, ...added] }, today, opts);
  if (after.sapling.count > after.sapling.max && after.sapling.count > before.sapling.count) return 'errorLimitSapling';
  if (after.periodic.count > after.periodic.max && after.periodic.count > before.periodic.count) return 'errorLimitPeriodic';
  return null;
}
