/**
 * Practice API shapes: `GET /v1/practice/catalog`, `GET /v1/calendar/occasions`.
 * The catalog objects mirror backend/prisma/taxonomy/deed-schedules.yaml and sin-programs.yaml field for field.
 */
import type { DeedWindow, HijriDate, PeopleCircle, PlanUnit, RakahCount, Rule, SinCategory, Stage } from '@thekra/practice-core';

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
  /** `periodic`: a template of «أعمال دورية» (counts toward the 7 periodic acts, not the 3 saplings). */
  kind?: 'periodic';
  /** A people list: people are added on the kinship page with this circle; `defaultRule` is each person's rhythm. */
  people?: PeopleCircle;
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
  /** When the deed may be done (prayer times + minutes) and the anchors that suit it; absent = any time. */
  window?: DeedWindow;
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

/** One act of «لحظة مجاهدة» (owner round 5, F-09): a short command tied to public texts (read by id). */
export interface MomentTool {
  key: string;
  titleAr: string;
  titleEn: string;
  evidence: string[];
}

/**
 * «لحظة مجاهدة» per sin: the acts of a sin with texts of its own, the generic acts for every other sin, and aliases (a
 * sin that takes another's acts). Mirrors backend `MomentTools` (backend/src/modules/practice/practice-catalog.ts).
 */
export interface MomentTools {
  generic: MomentTool[];
  sins: Record<string, MomentTool[]>;
  aliases?: Record<string, string>;
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
    /** «لحظة مجاهدة» acts per sin (sin-programs.yaml `moment`). Optional until every API deploy sends it. */
    moment?: MomentTools;
  };
  /** Habit deed → its branches of faith. Optional until every API deploy sends it. */
  deedBranches?: Record<string, number[]>;
  /** Story key → Quote id, or null while not found (the UI hides it). Optional until every API deploy sends it. */
  stories?: Record<string, string | null>;
  /** «لحظة مجاهدة» texts by Quote id (heart-texts.yaml). Optional until every API deploy sends it. */
  mujahada?: MujahadaTexts;
}

/**
 * «لحظة مجاهدة» (was «لحظة ضعف»): every id is a public Quote id, read by id; an empty list or null hides that part.
 * Mirrors backend `MujahadaTexts` (backend/src/modules/practice/heart-texts.ts).
 */
export interface MujahadaTexts {
  /** Quran passages on patience and striving: each passage is 1–3 consecutive verse ids shown together. */
  verses: string[][];
  /** Scholars' sayings on patience (empty while none qualifies). */
  sayings: string[];
  /** A good deed is written ten times up to seven hundred times. */
  multiplierHadith: string | null;
  /** The voluntary prayer sitting has half the reward of standing. */
  sittingPrayerHadith: string | null;
  /** Good-deed topic slugs (`/good-deeds/<slug>`): easy deeds with a great reward («أتبِع السيئةَ الحسنة»). */
  easyHighReward: string[];
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
