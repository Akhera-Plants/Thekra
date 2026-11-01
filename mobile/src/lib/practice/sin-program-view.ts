/**
 * «ترك المعصية» list changes and the private notebook. LOCAL ONLY (roadmap §0.1): nothing here leaves the device.
 *
 * Several programs can run side by side, as on the website. Ending one keeps practice-core's end marker only while an
 * encrypted copy may exist in the account (`keepMarker`), so that copy does not bring the program back
 * (`mergePrograms`); without a vault nothing of the ended program is kept, as on the website's «أنهِ هذا البرنامج».
 */

import {
  endProgram,
  isActiveProgram,
  programEntryFor,
  type CheckIn,
  type IsoTime,
  type LocalDate,
  type SinCategory,
  type SinProgram,
} from '@thekra/practice-core';
import type { CatalogSinProgram } from './catalog-types';

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

/** «دفتري الخاص»: past check-ins (today included), newest first. */
export function notebookEntries(program: SinProgram, today: LocalDate, limit: number = NOTEBOOK_LIMIT): CheckIn[] {
  return program.checkIns
    .filter((c) => c.date <= today)
    .slice(-limit)
    .reverse();
}

/**
 * The program entry of a sin (owner, 2026-11-01: every sin can start «تخفَّف»): its written program, else practice-core's
 * common five-stage entry once the category is known, else null (ask «هل فيها حقٌّ لأحد من الناس؟» first). The
 * catalog leaves empty lists out, so they are filled before practice-core's `programEntryFor` reads them.
 */
export function programEntry(entries: readonly CatalogSinProgram[], sin: string, category: SinCategory | null): CatalogSinProgram | null {
  const full = entries.map((e) => ({
    ...e,
    actionsAr: e.actionsAr ?? [],
    actionsEn: e.actionsEn ?? [],
    alternatives: e.alternatives ?? [],
    evidence: e.evidence ?? [],
  }));
  return programEntryFor(full, sin, category);
}

/** The category from the one question: a right of other people → `haqq_ibad`, else `haqq_allah`. */
export function categoryFromAnswer(othersHaveARight: boolean): SinCategory {
  return othersHaveARight ? 'haqq_ibad' : 'haqq_allah';
}

export interface SinChoice {
  slug: string;
  name: string;
  /** The catalog has a written program for it (its category is known; no question is asked). */
  written: CatalogSinProgram | null;
}

/** Arabic search folding: no diacritics or tatweel, one alef, ta marbuta as ha, alef maqsura as ya; Latin lower-cased. */
export function foldSearch(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .toLowerCase()
    .trim();
}

/**
 * The chooser's list: every public sin not already followed, those with a written program first (list order kept
 * inside each part), filtered by the search text on the shown name.
 */
export function sinChoices(
  sins: readonly { slug: string; name: string }[],
  entries: readonly CatalogSinProgram[],
  following: ReadonlySet<string>,
  query = '',
): SinChoice[] {
  const q = foldSearch(query);
  const choices = sins
    .filter((s) => !following.has(s.slug))
    .filter((s) => q === '' || foldSearch(s.name).includes(q))
    .map((s) => ({ slug: s.slug, name: s.name, written: entries.find((e) => e.sin === s.slug) ?? null }));
  return [...choices.filter((c) => c.written), ...choices.filter((c) => !c.written)];
}
