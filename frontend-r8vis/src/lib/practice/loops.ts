/**
 * «ابنِ حلقة عادتك الخاصة» and «حلقة المعصية» (owner round 3, item 17) on the store, on top of practice-core
 * (`addHabitLoop` / `updateHabitLoop` / `removeHabitLoop`, `addSinLoop` / `updateSinLoop` / `removeSinLoop`).
 *
 * Habit loops ride on the plan and travel with the practice sync. Sin loops live inside the program, which leaves the
 * device only sealed in the encrypted vault (the autosave seals every change). Pure.
 */
import {
  addHabitLoop,
  addSinLoop,
  MAX_HABIT_LOOPS,
  MAX_SIN_LOOPS,
  activeSinLoops,
  removeHabitLoop,
  removeSinLoop,
  updateHabitLoop,
  updatePlan,
  updateSinLoop,
  type HabitLoopInput,
  type Plan,
  type SinLoopInput,
  type SinProgram,
  type Store,
} from '@thekra/practice-core';
import { newUuid } from './ids';

/** The habit-loop template, in the order of the stepper. `obstacle` and `ifThen` are optional. */
export const HABIT_LOOP_STEPS = ['cue', 'craving', 'routine', 'reward', 'obstacle', 'ifThen'] as const;
export type HabitLoopStep = (typeof HABIT_LOOP_STEPS)[number];
/** The sin-loop template, in the order of the stepper. */
export const SIN_LOOP_STEPS = ['trigger', 'feeling', 'craving', 'act', 'after', 'alternative'] as const;
export type SinLoopStep = (typeof SIN_LOOP_STEPS)[number];

/** Answers trimmed; empty optional answers dropped. */
export function cleanHabitLoopInput(input: Record<HabitLoopStep, string>): HabitLoopInput {
  const out: HabitLoopInput = {
    cue: input.cue.trim(),
    craving: input.craving.trim(),
    routine: input.routine.trim(),
    reward: input.reward.trim(),
  };
  const obstacle = input.obstacle.trim();
  const ifThen = input.ifThen.trim();
  if (obstacle) out.obstacle = obstacle;
  if (ifThen) out.ifThen = ifThen;
  return out;
}

export function canAddHabitLoop(plan: Plan): boolean {
  return (plan.loops?.length ?? 0) < MAX_HABIT_LOOPS;
}

/** Adds (`loopId` null) or edits one loop of a habit. An empty optional answer clears it. */
export function saveHabitLoop(store: Store, planId: string, loopId: string | null, input: HabitLoopInput, id: string = newUuid()): Store {
  return updatePlan(store, planId, (plan) =>
    loopId === null
      ? addHabitLoop(plan, id, input)
      : updateHabitLoop(plan, loopId, { obstacle: '', ifThen: '', ...input }),
  );
}

export function deleteHabitLoop(store: Store, planId: string, loopId: string): Store {
  return updatePlan(store, planId, (plan) => removeHabitLoop(plan, loopId));
}

export function cleanSinLoopInput(input: Record<SinLoopStep, string>): SinLoopInput {
  return {
    trigger: input.trigger.trim(),
    feeling: input.feeling.trim(),
    craving: input.craving.trim(),
    act: input.act.trim(),
    after: input.after.trim(),
    alternative: input.alternative.trim(),
  };
}

export function canAddSinLoop(program: SinProgram): boolean {
  return activeSinLoops(program).length < MAX_SIN_LOOPS;
}

function mapProgram(store: Store, slug: string, change: (p: SinProgram) => SinProgram): Store {
  return { ...store, programs: store.programs.map((p) => (p.sinSlug === slug && p.endedAt === undefined ? change(p) : p)) };
}

/** Adds (`loopId` null) or edits one «حلقة المعصية» of a running program. */
export function saveSinLoop(store: Store, slug: string, loopId: string | null, input: SinLoopInput, id: string = newUuid()): Store {
  return mapProgram(store, slug, (p) => (loopId === null ? addSinLoop(p, id, input) : updateSinLoop(p, loopId, input)));
}

export function deleteSinLoop(store: Store, slug: string, loopId: string): Store {
  return mapProgram(store, slug, (p) => removeSinLoop(p, loopId));
}
