/**
 * «بستاني»: one plant per habit plan (and one for صلة الرحم when relatives exist), grown by presence.
 *
 * Method (docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md §8, roadmap §0): a plant grows with the number of
 * days anything at all was logged for it («أي قدر يُحسب»), counted over its whole history, never a run of days. Nothing
 * wilts, dies or resets: a missed day adds nothing and takes nothing away, and «يومي ثقيل» (ebb) only marks the plant
 * as resting. The sin program never gets a plant (privacy, roadmap §0.2). Pure: the store is only read.
 *
 * The one way a count can go down is the user's own correction of a log (undo of a stray «تمّ», practice-core
 * `correctLog` to 0): that day was never tended, so it is not counted. Time and missed days never lower it.
 */

import { isValidDate, type LocalDate, type Plan, type Relative, type Store } from '@thekra/practice-core';

/**
 * Days tended a plant needs for each growth stage: 0 seed, 1 sprout, 2 seedling, 3 in leaf, 4 in bud, 5 in bloom.
 * The first day already shows a sprout, so any start is seen at once; after that each stage asks for more days than
 * the last, the later ones about a month or more of presence each, like the lecture's «hold a month or two» before a
 * habit grows (practice-core plan.ts `HOLD_DAYS`). Days need not follow each other.
 */
export const GROWTH_THRESHOLDS = [0, 1, 7, 21, 40, 80] as const;

export type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

/** The highest stage whose threshold `tendedDays` has reached. Never lower for more days. */
export function growthStage(tendedDays: number): GrowthStage {
  let stage = 0;
  GROWTH_THRESHOLDS.forEach((min, i) => {
    if (tendedDays >= min) stage = i;
  });
  return stage as GrowthStage;
}

/** Days up to `today` with any amount logged for a plan. */
export function planTendedDays(plan: Pick<Plan, 'log'>, today: LocalDate): number {
  let days = 0;
  for (const [date, amount] of Object.entries(plan.log)) {
    if (amount > 0 && isValidDate(date) && date <= today) days++;
  }
  return days;
}

/** Days up to `today` with a contact to any relative (one day counts once, however many were reached). */
export function kinshipTendedDays(relatives: readonly Pick<Relative, 'history'>[], today: LocalDate): number {
  const days = new Set<LocalDate>();
  for (const rel of relatives) for (const date of rel.history) if (date <= today) days.add(date);
  return days.size;
}

/** «يومي ثقيل» is on for the plan: the plant rests, exactly as grown. */
export function isResting(plan: Pick<Plan, 'ebb'>, today: LocalDate): boolean {
  return plan.ebb !== undefined && plan.ebb.since <= today;
}

export interface GardenPlant {
  key: string;
  kind: 'habit' | 'kinship';
  /** The plan the plant opens (habit plants only). */
  planId?: string;
  title: string;
  tendedDays: number;
  stage: GrowthStage;
  resting: boolean;
}

export const KINSHIP_PLANT_KEY = 'kinship';

/**
 * The garden in store order: one plant per plan, then صلة الرحم when there are relatives. `titleOf` names a plan
 * (the catalog habit title); `kinshipTitle` names the kinship plant. Nothing is read from `store.programs`.
 */
export function gardenPlants(
  store: Pick<Store, 'plans' | 'relatives'>,
  today: LocalDate,
  titleOf: (plan: Plan) => string,
  kinshipTitle: string,
): GardenPlant[] {
  const plants: GardenPlant[] = store.plans.map((plan) => {
    const tendedDays = planTendedDays(plan, today);
    return {
      key: plan.id,
      kind: 'habit',
      planId: plan.id,
      title: titleOf(plan),
      tendedDays,
      stage: growthStage(tendedDays),
      resting: isResting(plan, today),
    };
  });
  if (store.relatives.length > 0) {
    const tendedDays = kinshipTendedDays(store.relatives, today);
    plants.push({
      key: KINSHIP_PLANT_KEY,
      kind: 'kinship',
      title: kinshipTitle,
      tendedDays,
      stage: growthStage(tendedDays),
      resting: false,
    });
  }
  return plants;
}
