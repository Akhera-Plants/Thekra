/**
 * Limits and «أعمال دورية» templates for the pages, on top of practice-core `limits` (redesign §3): which plans are
 * periodic acts (their catalog habit has `kind: periodic`), the templates «أضف عملًا دوريًا» lists, and a plan made
 * from a template. The rules themselves live in practice-core, shared with the app and the extension.
 */
import { createPlan, isCustomPeriodic, type LimitOptions, type LocalDate, type PeopleCircle, type Plan } from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { newUuid } from './ids';
import { habitOf } from './plans';

/** The lookup practice-core `limits` needs: a plan from a periodic template is a periodic act, not a sapling. */
export function limitOptions(habits: ReadonlyMap<string, PracticeHabit>): LimitOptions {
  // A member's own periodic act (round 6, practice-core `createCustomPeriodic`) is always periodic.
  return { isPeriodicAct: (plan) => isCustomPeriodic(plan) || habitOf(plan, habits)?.kind === 'periodic' };
}

export function isPeriodicTemplate(habit: PracticeHabit | undefined): boolean {
  return habit?.kind === 'periodic';
}

/** «أضف عملًا دوريًا»: the people lists first, then the dated acts, in the catalog's order. */
export function periodicTemplates(habits: readonly PracticeHabit[]): PracticeHabit[] {
  const periodic = habits.filter(isPeriodicTemplate);
  return [...periodic.filter((h) => h.people), ...periodic.filter((h) => !h.people)];
}

/** The people template of a circle (its title and rhythm), if the catalog has one. */
export function templateOfCircle(habits: readonly PracticeHabit[], circle: PeopleCircle): PracticeHabit | undefined {
  return habits.find((h) => h.people === circle);
}

/** Active days a periodic act aims for (the practice-core minimum: the rule decides its days). */
const PERIODIC_ACTIVE_DAYS = 2;

/**
 * A plan from a dated template (not a people list): the catalog's start amount and slots; no rule of its own, so it
 * follows the template's default rule like every catalog plan (the same answer the reminders use).
 */
export function planFromTemplate(habit: PracticeHabit, today: LocalDate, id: string = newUuid()): Plan {
  if (habit.people) throw new RangeError('A people template adds people, not a plan');
  return createPlan({
    id,
    habitKey: habit.key,
    deedSlug: habit.deed,
    title: habit.titleAr,
    unit: habit.unit,
    amount: habit.start.near,
    ceiling: habit.ceiling,
    activeDaysPerWeek: PERIODIC_ACTIVE_DAYS,
    slots: [...new Set(habit.defaultSlots)].sort(),
    createdOn: today,
  });
}
