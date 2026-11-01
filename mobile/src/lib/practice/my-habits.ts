/**
 * «عاداتي» covers doing good and leaving sins (owner, 2026-11-01): each habit row carries one action that fits today,
 * and the running «تخفَّف» programs sit in their own section beside the habits, each with its stage and progress.
 * Pure: the screen feeds it practice-core results.
 *
 * Privacy (roadmap §0.1): a program row never names the sin (no title, no label, no accessibility text): «عاداتي» is
 * not behind the program's lock and is not shielded from screenshots, so it shows only generic words, as «ورد اليوم»
 * does. The name stays inside the locked program screen.
 */

import {
  currentStage,
  programCounters,
  stagesFor,
  type HabitItem,
  type LocalDate,
  type SinProgram,
  type Stage,
} from '@thekra/practice-core';

/**
 * The action at the end of a habit row:
 * - `log`: asked for today and not complete → «سجّل» (solid), logs what is left (the «ورد اليوم» logic);
 * - `done`: complete today → «تمّ» (framed, a tap takes the log back, as the check in «ورد اليوم» does);
 * - `quiet`: not asked for today → a quiet framed «سجّل» (anything done still counts);
 * - `resume`: paused → «استأنف»;
 * - null: nothing to log today (the row still opens the plan).
 */
export type HabitDayAction = 'log' | 'done' | 'quiet' | 'resume';

export function habitDayAction(args: { paused: boolean; due?: HabitItem; offDay?: HabitItem }): HabitDayAction | null {
  if (args.paused) return 'resume';
  const item = args.due ?? args.offDay;
  if (!item) return null;
  if (item.complete) return 'done';
  return args.due ? 'log' : 'quiet';
}

/** One running «تخفَّف» program as «عاداتي» shows it (generic words only). */
export interface ProgramRowModel {
  /** List key: the place in the list, never the sin. */
  key: string;
  /** 1-based stage and the number of stages of its path. */
  stage: number;
  stages: number;
  stageKey: Stage;
  /** Days held in the last `window` days (never reset by a fall). */
  held: number;
  window: number;
  /** Today's check-in is saved. */
  checkedIn: boolean;
  startedOn: LocalDate;
}

/** The running programs, oldest first, as rows (practice-core `currentStage` / `programCounters`). */
export function programRows(programs: readonly SinProgram[], today: LocalDate): ProgramRowModel[] {
  return [...programs]
    .sort((a, b) => (a.startedOn < b.startedOn ? -1 : a.startedOn > b.startedOn ? 1 : 0))
    .map((program, index) => {
      const stage = currentStage(program, today);
      const counters = programCounters(program, today);
      return {
        key: `program-${index}`,
        stage: stage.index + 1,
        stages: stagesFor(program.category).length,
        stageKey: stage.stage,
        held: counters.held,
        window: counters.window,
        checkedIn: program.checkIns.some((c) => c.date === today),
        startedOn: program.startedOn,
      };
    });
}
