/**
 * Limits (redesign §3, «القليل الدائم خير من الكثير المنقطع»), shared by the website, the app and the extension:
 *
 * - 3 غِراس: habits being built, whatever their rule: live plans that are not established («راسخة»), not paused and
 *   not periodic acts;
 * - 7 أعمال دورية: periodic acts, i.e. live, unpaused plans from a periodic template (the catalog's `kind: periodic`,
 *   passed as {@link LimitOptions.isPeriodicAct}) plus people lists (each circle with at least one person is one act,
 *   however many people it holds);
 * - 1 «تخفَّف» program until it reaches its last stage; then a second may start.
 *
 * Adding past a limit is refused by the clients with the limit sheet («أكمل ما عندي», pause, delete, and «ثبّت …
 * وابدأ الجديدة» when a sapling is ready to graduate). Pure; the store is not changed.
 */
import type { LocalDate } from './dates.js';
import { circleOf, type PeopleCircle } from './kinship.js';
import { graduationReady, isEstablished, isPaused, type Plan } from './plan.js';
import { activePrograms, currentStage, stagesFor } from './sin-program.js';
import type { Store } from './storage.js';

export type LimitKind = 'sapling' | 'periodic' | 'program';

export const LIMITS: Readonly<Record<LimitKind, number>> = { sapling: 3, periodic: 7, program: 1 };

export interface LimitOptions {
  /** True for a plan made from a periodic template (catalog `kind: periodic`). Default: none. */
  isPeriodicAct?: (plan: Plan) => boolean;
}

export interface LimitCount {
  count: number;
  max: number;
  /** `count >= max`: adding one more is refused. */
  full: boolean;
}

export interface Limits {
  sapling: LimitCount;
  periodic: LimitCount;
  program: LimitCount;
  /** The saplings counted (pause / delete choices of the limit sheet). */
  saplings: Plan[];
  /** Saplings ready for «راسخة» ({@link graduationReady}): «ثبّت … وابدأ الجديدة». */
  graduationReady: Plan[];
  /** Periodic-template plans counted. */
  periodicPlans: Plan[];
  /** People lists in use (each one periodic act). */
  circles: PeopleCircle[];
  /** Whether one more of `kind` fits. A person added to a list already in use adds no act. */
  canAdd(kind: LimitKind, opts?: { circle?: PeopleCircle }): boolean;
}

const count = (n: number, max: number): LimitCount => ({ count: n, max, full: n >= max });

/** True for a live plan that counts as a sapling. */
export function isSapling(plan: Plan, opts: LimitOptions = {}): boolean {
  return !isEstablished(plan) && !isPaused(plan) && !(opts.isPeriodicAct?.(plan) ?? false);
}

/** The limit a new plan falls under. */
export function limitKindOfPlan(plan: Plan, opts: LimitOptions = {}): LimitKind {
  return opts.isPeriodicAct?.(plan) ? 'periodic' : 'sapling';
}

export function limits(store: Store, today: LocalDate, opts: LimitOptions = {}): Limits {
  const isPeriodicAct = opts.isPeriodicAct ?? (() => false);
  const saplings = store.plans.filter((p) => isSapling(p, opts));
  const periodicPlans = store.plans.filter((p) => !isPaused(p) && isPeriodicAct(p));
  const circles = [...new Set(store.relatives.map(circleOf))];
  const programs = activePrograms(store.programs).filter((p) => {
    const last = stagesFor(p.category).length - 1;
    return p.startedOn > today || currentStage(p, today).index < last;
  });
  const result: Omit<Limits, 'canAdd'> = {
    sapling: count(saplings.length, LIMITS.sapling),
    periodic: count(periodicPlans.length + circles.length, LIMITS.periodic),
    program: count(programs.length, LIMITS.program),
    saplings,
    graduationReady: saplings.filter((p) => graduationReady(p, today)),
    periodicPlans,
    circles,
  };
  return {
    ...result,
    canAdd(kind, addOpts = {}) {
      if (kind === 'periodic' && addOpts.circle !== undefined && circles.includes(addOpts.circle)) return true;
      return !result[kind].full;
    },
  };
}
