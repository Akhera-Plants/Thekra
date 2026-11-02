/**
 * «ابنِ حلقة عادتك الخاصة» and «حلقة المعصية» (owner round 3, item 17): the questions of the loop builder, one per step,
 * and the checks that decide whether a step may go on and what is saved. Pure; the screens own the words
 * (`loops.habit.*` and `loops.sin.*` in the i18n files) and save through practice-core (`addHabitLoop`,
 * `updateHabitLoop`, `removeHabitLoop` on the plan, which syncs; `addSinLoop`, `updateSinLoop`, `removeSinLoop` on the
 * program, which travels only inside the encrypted vault).
 */

import {
  MAX_HABIT_LOOPS,
  MAX_LOOP_TEXT,
  MAX_SIN_LOOPS,
  MAX_SIN_LOOP_TEXT,
  SIN_LOOP_FIELDS,
  activeSinLoops,
  type HabitLoop,
  type HabitLoopInput,
  type Plan,
  type SinLoop,
  type SinLoopInput,
  type SinProgram,
} from '@thekra/practice-core';

export type LoopKind = 'habit' | 'sin';

export const HABIT_LOOP_FIELDS = ['cue', 'craving', 'routine', 'reward', 'obstacle', 'ifThen'] as const;
export type HabitLoopField = (typeof HABIT_LOOP_FIELDS)[number];
export type SinLoopField = (typeof SIN_LOOP_FIELDS)[number];
export type LoopField = HabitLoopField | SinLoopField;

export interface LoopStep {
  field: LoopField;
  /** The step may be left empty («تخطَّ»). */
  optional: boolean;
}

/** Six questions: الإشارة، النية، الفعل (required), المكافأة، العائق، «إن… فإني…». */
export const HABIT_LOOP_STEPS: readonly LoopStep[] = HABIT_LOOP_FIELDS.map((field) => ({
  field,
  optional: field !== 'routine',
}));

/** Six questions: المثير/الموقف، الشعور، الرغبة، الفعل، ما يحصل بعده، البديل. Any may be skipped, but one answer is needed. */
export const SIN_LOOP_STEPS: readonly LoopStep[] = SIN_LOOP_FIELDS.map((field) => ({ field, optional: true }));

export function loopSteps(kind: LoopKind): readonly LoopStep[] {
  return kind === 'habit' ? HABIT_LOOP_STEPS : SIN_LOOP_STEPS;
}

/** Characters per answer (practice-core's limit, the same for both kinds). */
export function loopTextMax(kind: LoopKind): number {
  return kind === 'habit' ? MAX_LOOP_TEXT : MAX_SIN_LOOP_TEXT;
}

/** Loops per habit or per program. */
export function loopsMax(kind: LoopKind): number {
  return kind === 'habit' ? MAX_HABIT_LOOPS : MAX_SIN_LOOPS;
}

export type LoopDraft = Partial<Record<LoopField, string>>;

/** Why the builder cannot save yet, or null. `routine`: the habit's routine is empty; `empty`: no answer at all. */
export type LoopProblem = 'routine' | 'empty' | 'tooLong' | null;

/** May the member leave this step with this answer? A required step needs words; no answer may pass the limit. */
export function canLeaveStep(kind: LoopKind, step: LoopStep, value: string | undefined): boolean {
  const text = value ?? '';
  if (text.length > loopTextMax(kind)) return false;
  return step.optional || text.trim().length > 0;
}

/** The problem of a whole draft, checked again before saving. */
export function loopProblem(kind: LoopKind, draft: LoopDraft): LoopProblem {
  const max = loopTextMax(kind);
  const fields: readonly LoopField[] = kind === 'habit' ? HABIT_LOOP_FIELDS : SIN_LOOP_FIELDS;
  if (fields.some((f) => (draft[f] ?? '').length > max)) return 'tooLong';
  if (kind === 'habit') return (draft.routine ?? '').trim() === '' ? 'routine' : null;
  return fields.every((f) => (draft[f] ?? '').trim() === '') ? 'empty' : null;
}

const clean = (value: string | undefined): string => (value ?? '').trim();

/** The answers as practice-core takes them: trimmed; an empty «العائق» / «إن… فإني…» is left out. */
export function habitLoopInput(draft: LoopDraft): HabitLoopInput {
  const input: HabitLoopInput = {
    cue: clean(draft.cue),
    craving: clean(draft.craving),
    routine: clean(draft.routine),
    reward: clean(draft.reward),
  };
  const obstacle = clean(draft.obstacle);
  const ifThen = clean(draft.ifThen);
  // `updateHabitLoop` clears a field given as '' and keeps one left out, so an edit passes both explicitly.
  input.obstacle = obstacle;
  input.ifThen = ifThen;
  return input;
}

export function sinLoopInput(draft: LoopDraft): SinLoopInput {
  return {
    trigger: clean(draft.trigger),
    feeling: clean(draft.feeling),
    craving: clean(draft.craving),
    act: clean(draft.act),
    after: clean(draft.after),
    alternative: clean(draft.alternative),
  };
}

/** A saved loop back into the builder's draft (editing). */
export function draftOf(loop: HabitLoop | SinLoop): LoopDraft {
  const draft: LoopDraft = {};
  for (const [k, v] of Object.entries(loop)) {
    if (typeof v === 'string' && k !== 'id' && k !== 'updatedAt' && k !== 'removedAt') draft[k as LoopField] = v;
  }
  return draft;
}

/** The answered steps of a loop in the builder's order, for the loop card. */
export function loopLines(kind: LoopKind, loop: HabitLoop | SinLoop): { field: LoopField; text: string }[] {
  const draft = draftOf(loop);
  return loopSteps(kind)
    .map((s) => ({ field: s.field, text: (draft[s.field] ?? '').trim() }))
    .filter((line) => line.text !== '');
}

/** The habit's loops (none when absent). */
export function habitLoops(plan: Plan): HabitLoop[] {
  return plan.loops ?? [];
}

/** The program's loops still shown (practice-core keeps removal markers). */
export function sinLoops(program: SinProgram): SinLoop[] {
  return activeSinLoops(program);
}

/** One more loop fits. */
export function canAddLoop(kind: LoopKind, count: number): boolean {
  return count < loopsMax(kind);
}
