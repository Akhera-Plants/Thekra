/**
 * «ترك المعصية» list changes and the private notebook. LOCAL ONLY (roadmap §0.1): nothing here leaves the device.
 *
 * The app follows one program at a time. Ending one keeps practice-core's end marker only while an encrypted copy
 * may exist in the account (`keepMarker`), so that copy does not bring the program back (`mergePrograms`); without
 * a vault nothing of the ended program is kept, as on the website's «أنهِ هذا البرنامج».
 */

import { endProgram, isActiveProgram, type CheckIn, type IsoTime, type LocalDate, type SinProgram } from '@thekra/practice-core';

/** The notebook shows the newest check-ins of the summary window. */
export const NOTEBOOK_LIMIT = 30;

function closeProgram(program: SinProgram, keepMarker: boolean, now?: IsoTime): SinProgram[] {
  return keepMarker ? [endProgram(program, now)] : [];
}

/** The programs once `next` starts: the active one is ended, an older copy of the same sin is replaced. */
export function withProgramStarted(programs: readonly SinProgram[], next: SinProgram, keepMarker: boolean, now?: IsoTime): SinProgram[] {
  const others = programs
    .filter((p) => p.sinSlug !== next.sinSlug)
    .flatMap((p) => (isActiveProgram(p) ? closeProgram(p, keepMarker, now) : [p]));
  return [...others, next];
}

/** The programs once the program of `sinSlug` ends. */
export function withProgramEnded(programs: readonly SinProgram[], sinSlug: string, keepMarker: boolean, now?: IsoTime): SinProgram[] {
  return programs.flatMap((p) => (p.sinSlug === sinSlug && isActiveProgram(p) ? closeProgram(p, keepMarker, now) : [p]));
}

/** «دفتري الخاص»: past check-ins (today included), newest first. */
export function notebookEntries(program: SinProgram, today: LocalDate, limit: number = NOTEBOOK_LIMIT): CheckIn[] {
  return program.checkIns
    .filter((c) => c.date <= today)
    .slice(-limit)
    .reverse();
}
