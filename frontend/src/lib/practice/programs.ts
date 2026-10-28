/**
 * «ترك المعصية» view helpers. LOCAL ONLY: nothing here builds a request that names the user's sin.
 */
import {
  addDays,
  currentStage,
  pathFor,
  stagesFor,
  summary,
  type CheckIn,
  type LocalDate,
  type Path,
  type ProgramSummary,
  type SinProgram,
  type Stage,
} from '@thekra/practice-core';
import type { PracticeCatalog, SinProgramEntry } from '@/lib/types/practice';

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
  return [...ids].sort();
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
  recent: CheckIn[];
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
    recent: program.checkIns
      .filter((c) => c.date <= today)
      .slice(-RECENT_CHECKINS)
      .reverse(),
  };
}
