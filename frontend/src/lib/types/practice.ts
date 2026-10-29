/**
 * Practice API shapes: `GET /v1/practice/catalog`, `GET /v1/calendar/occasions`.
 * The catalog objects mirror backend/prisma/taxonomy/deed-schedules.yaml and sin-programs.yaml field for field.
 */
import type {
  FreshStartKind,
  HijriDate,
  MuhasabaQuestion,
  PlanAnchor,
  PlanUnit,
  RakahCount,
  Rule,
  SinCategory,
  Stage,
} from '@thekra/practice-core';

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
  /** Prayer habits: the amount is said in rak'ahs (`pairs`: 2, 4, 6…; `odd`: 1, 3, 5…). */
  rakah?: RakahCount;
  start: { far: number; near: number };
  ceiling?: number;
  defaultRule: Rule;
  timeHintAr?: string;
  timeHintEn?: string;
  defaultSlots: string[];
  /** Suggested prayers to remind after (an organizational suggestion; the phone app offers them). */
  defaultAnchors?: Omit<PlanAnchor, 'slot'>[];
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

/** One pick in a guidance step: a practical move, or a small good deed after a fall. */
export interface GuidanceChoice {
  key: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  evidence?: string[];
}

/** «لحظة الضعف»: the guided steps of a weak moment (sin-programs.yaml `common.urgeMoment`). */
export interface UrgeMoment {
  review: string;
  breathe: SinStageContent & { breaths: number };
  text: SinStageContent;
  move: SinStageContent & { moves: GuidanceChoice[] };
  delay: SinStageContent & { minutes: number };
  companion: SinStageContent & { shareAr: string; shareEn: string };
  passed: SinStageContent;
}

/** «أتبِع السيئة الحسنة» (sin-programs.yaml `common.followWithGood`). */
export interface FollowWithGood {
  review: string;
  istighfar: SinStageContent & { lineAr: string; lineEn: string };
  deeds: SinStageContent & { choices: GuidanceChoice[] };
  close: SinStageContent;
}

export interface SinProgramCommon {
  willQuestionAr: string;
  willQuestionEn: string;
  stageMinDays: number;
  stages: Record<Stage, SinStageContent>;
  afterFall: SinStageContent;
  /** Optional until every API deploy sends it: without it «أشعر بضعف الآن» stays hidden. */
  urgeMoment?: UrgeMoment;
  /** Optional until every API deploy sends it: without it a fall shows the afterFall text only. */
  followWithGood?: FollowWithGood;
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

/** backend/prisma/taxonomy/tazkiya-prompts.yaml: the intention, the evening questions, fresh starts, supplications. */
export interface TazkiyaPrompts {
  review: string;
  niyyah: { introAr: string; introEn: string };
  muhasaba: {
    introAr: string;
    introEn: string;
    questions: { key: MuhasabaQuestion; textAr: string; textEn: string }[];
    thanksAr: string;
    thanksEn: string;
  };
  freshStarts: {
    renewAr: string;
    renewEn: string;
    increaseAr: string;
    increaseEn: string;
    startAr: string;
    startEn: string;
    occasions: { kind: FreshStartKind; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; evidence?: string[] }[];
  };
  celebrations: { linesAr: string[]; linesEn: string[] };
}

export interface PracticeCatalog {
  occasions: PracticeOccasion[];
  habits: PracticeHabit[];
  sinPrograms: {
    review: string;
    common: SinProgramCommon;
    programs: SinProgramEntry[];
  };
  /** Optional until every API deploy sends it: without it the tazkiya cards and lines stay hidden. */
  tazkiya?: TazkiyaPrompts;
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
