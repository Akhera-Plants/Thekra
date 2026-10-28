/**
 * Practice API shapes: `GET /v1/practice/catalog`, `GET /v1/calendar/occasions`.
 * The catalog objects mirror backend/prisma/taxonomy/deed-schedules.yaml and sin-programs.yaml field for field.
 */
import type { HijriDate, PlanUnit, Rule, SinCategory, Stage } from '@thekra/practice-core';

export type ScheduleBasis = 'text' | 'organizational';

export interface PracticeOccasion {
  key: string;
  titleAr: string;
  titleEn: string;
  /** GoodDeed slug: the occasion links to `/good-deeds/<deed>`. */
  deed: string;
  rule: Rule;
  basis: ScheduleBasis;
  evidence: string[];
}

export interface PracticeHabit {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  unit: PlanUnit;
  unitLabelAr: string;
  unitLabelEn: string;
  start: { far: number; near: number };
  ceiling?: number;
  defaultRule: Rule;
  timeHintAr?: string;
  timeHintEn?: string;
  defaultSlots: string[];
  basis: ScheduleBasis;
  evidence: string[];
}

export interface SinStageContent {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  evidence?: string[];
}

export interface SinProgramCommon {
  willQuestionAr: string;
  willQuestionEn: string;
  stageMinDays: number;
  stages: Record<Stage, SinStageContent>;
  afterFall: SinStageContent;
  helpAr: string;
  helpEn: string;
}

export interface SinProgramEntry {
  sin: string;
  category: SinCategory;
  gradualAllowed: boolean;
  help: boolean;
  gradualStepsAr?: string[];
  gradualStepsEn?: string[];
  actionsAr: string[];
  actionsEn: string[];
  /** Habit keys from `habits`. */
  alternatives: string[];
  evidence: string[];
}

export interface PracticeCatalog {
  occasions: PracticeOccasion[];
  habits: PracticeHabit[];
  sinPrograms: {
    review: string;
    common: SinProgramCommon;
    programs: SinProgramEntry[];
  };
}

/** One dated occurrence, as `GET /v1/calendar/occasions` returns it (or as computed on the device). */
export interface OccasionDate {
  key: string;
  /** Local `YYYY-MM-DD`. */
  date: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  basis: ScheduleBasis;
  hijri: HijriDate | null;
}

export interface OccasionsQuery {
  from: string;
  to: string;
  hijriOffset: number;
}
