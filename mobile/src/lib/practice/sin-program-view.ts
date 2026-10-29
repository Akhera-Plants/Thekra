/**
 * «ترك المعصية» list changes and the private notebook. LOCAL ONLY (roadmap §0.1): nothing here leaves the device.
 *
 * Several programs can run side by side, as on the website. Ending one keeps practice-core's end marker only while an
 * encrypted copy may exist in the account (`keepMarker`), so that copy does not bring the program back
 * (`mergePrograms`); without a vault nothing of the ended program is kept, as on the website's «أنهِ هذا البرنامج».
 */

import {
  checkIn,
  endProgram,
  isActiveProgram,
  notebookDays,
  recordDeedAfterFall,
  recordUrgePassed,
  type IsoTime,
  type LocalDate,
  type NotebookDay,
  type SinProgram,
} from '@thekra/practice-core';

/** The notebook shows the newest check-ins of the summary window. */
export const NOTEBOOK_LIMIT = 30;

function closeProgram(program: SinProgram, keepMarker: boolean, now?: IsoTime): SinProgram[] {
  return keepMarker ? [endProgram(program, now)] : [];
}

/** The programs once `next` starts: the others keep running; an older copy of the same sin is replaced. */
export function withProgramStarted(programs: readonly SinProgram[], next: SinProgram): SinProgram[] {
  return [...programs.filter((p) => p.sinSlug !== next.sinSlug), next];
}

/** The programs once the program of `sinSlug` ends. */
export function withProgramEnded(programs: readonly SinProgram[], sinSlug: string, keepMarker: boolean, now?: IsoTime): SinProgram[] {
  return programs.flatMap((p) => (p.sinSlug === sinSlug && isActiveProgram(p) ? closeProgram(p, keepMarker, now) : [p]));
}

/** «دفتري الخاص»: past days (today included) with a check-in or a weak moment passed, newest first. */
export function notebookEntries(program: SinProgram, today: LocalDate, limit: number = NOTEBOOK_LIMIT): NotebookDay[] {
  return notebookDays(program, today, limit);
}

/** Applies `change` to the running program of `sinSlug` only. */
function updateProgram(programs: readonly SinProgram[], sinSlug: string, change: (p: SinProgram) => SinProgram): SinProgram[] {
  return programs.map((p) => (p.sinSlug === sinSlug && isActiveProgram(p) ? change(p) : p));
}

/** «تجاوزتها، الحمد لله»: one more weak moment passed today (a private mark, never a check-in). */
export function withUrgePassed(programs: readonly SinProgram[], sinSlug: string, date: LocalDate, now?: IsoTime): SinProgram[] {
  return updateProgram(programs, sinSlug, (p) => recordUrgePassed(p, date, now));
}

/** «وقعت» from the weak moment: the day's check-in becomes «وقعت ثم تبت», its note kept. */
export function withFall(programs: readonly SinProgram[], sinSlug: string, date: LocalDate, now?: IsoTime): SinProgram[] {
  return updateProgram(programs, sinSlug, (p) => checkIn(p, date, 'fell_repented', undefined, now));
}

/** «فعلتها»: the small good deed after the day's fall, kept with that check-in. */
export function withDeedAfterFall(programs: readonly SinProgram[], sinSlug: string, date: LocalDate, deed: string, now?: IsoTime): SinProgram[] {
  return updateProgram(programs, sinSlug, (p) => recordDeedAfterFall(p, date, deed, now));
}
