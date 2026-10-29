/**
 * «ترك المعصية» view helpers. LOCAL ONLY: nothing here builds a request that names the user's sin.
 */
import {
  addDays,
  currentStage,
  notebookDays,
  pathFor,
  stagesFor,
  summary,
  toDayNumber,
  urgesPassed,
  type CheckIn,
  type LocalDate,
  type NotebookDay,
  type Path,
  type ProgramSummary,
  type SinProgram,
  type Stage,
} from '@thekra/practice-core';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeCatalog, SinProgramCommon, SinProgramEntry, UrgeMoment } from '@/lib/types/practice';

export const SUMMARY_DAYS = 30;
export const RECENT_CHECKINS = 7;

/**
 * Every evidence id of every program, every stage and the after-fall content, sorted. The page asks
 * `/practice/evidence` for this whole set, so the request is identical for every visitor and never
 * tells the server which program is open (roadmap §0.1).
 */
export function allProgramEvidenceIds(sinPrograms: PracticeCatalog['sinPrograms']): string[] {
  const ids = new Set<string>();
  for (const program of sinPrograms.programs) for (const id of program.evidence) ids.add(id);
  for (const stage of Object.values(sinPrograms.common.stages)) for (const id of stage.evidence ?? []) ids.add(id);
  for (const id of sinPrograms.common.afterFall.evidence ?? []) ids.add(id);
  for (const id of guidanceEvidenceIds(sinPrograms.common)) ids.add(id);
  return [...ids].sort();
}

/** The evidence ids of «لحظة الضعف» and «أتبِع السيئة الحسنة», in reading order. */
function guidanceEvidenceIds({ urgeMoment: u, followWithGood: f }: SinProgramCommon): string[] {
  const texts: { evidence?: string[] }[] = [];
  if (u) texts.push(u.breathe, u.text, u.move, ...u.move.moves, u.delay, u.companion, u.passed);
  if (f) texts.push(f.istighfar, f.deeds, ...f.deeds.choices, f.close);
  return texts.flatMap((text) => text.evidence ?? []);
}

/** Applies `change` to the running program of `sinSlug` only (an ended marker is never touched). */
export function updateProgram(programs: readonly SinProgram[], sinSlug: string, change: (p: SinProgram) => SinProgram): SinProgram[] {
  return programs.map((p) => (p.sinSlug === sinSlug && p.endedAt === undefined ? change(p) : p));
}

/** The candidates for the weak moment's text: the step's own texts first, then the program's. */
export function momentTextIds(urge: UrgeMoment, entry: SinProgramEntry): string[] {
  return [...new Set([...(urge.text.evidence ?? []), ...entry.evidence])];
}

/** One published text for today, turning through the candidates day by day; null when none was published. */
export function pickMomentText(ids: readonly string[], quotes: readonly QuoteDto[], today: LocalDate): QuoteDto | null {
  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  const published = ids.flatMap((id) => byId.get(id) ?? []);
  if (published.length === 0) return null;
  return published[toDayNumber(today) % published.length] ?? null;
}

/**
 * Owner decision D1: gradual only when the catalog allows it for this sin AND the user said leaving at once
 * is very hard. A sin against people's rights is always 'cut' (practice-core enforces it too).
 */
export function chosenPath(entry: SinProgramEntry, veryHard: boolean): Path {
  return pathFor(entry.category, entry.gradualAllowed && veryHard);
}

export interface ProgramView {
  stage: Stage;
  stageIndex: number;
  stageCount: number;
  stageSince: LocalDate;
  stages: readonly Stage[];
  summary: ProgramSummary;
  today: CheckIn | null;
  /** «دفتري الخاص»: the latest days with a check-in or a weak moment passed, newest first. */
  recent: NotebookDay[];
  /** «لحظة ضعف عبرتها» in the summary window. */
  urgesPassed: number;
}

export function programView(program: SinProgram, today: LocalDate): ProgramView {
  const info = currentStage(program, today);
  const stages = stagesFor(program.category);
  return {
    stage: info.stage,
    stageIndex: info.index,
    stageCount: stages.length,
    stageSince: info.since,
    stages,
    summary: summary(program, addDays(today, -(SUMMARY_DAYS - 1)), today),
    today: program.checkIns.find((c) => c.date === today) ?? null,
    recent: notebookDays(program, today, RECENT_CHECKINS),
    urgesPassed: urgesPassed(program, addDays(today, -(SUMMARY_DAYS - 1)), today),
  };
}
