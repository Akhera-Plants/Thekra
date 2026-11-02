/**
 * Shapes served by `GET /v1/practice/catalog` and `GET /v1/calendar/occasions`.
 * The catalog objects are exactly the entries of backend/prisma/taxonomy/deed-schedules.yaml and
 * sin-programs.yaml (reviewed content; the app never writes religious text of its own).
 */

import type { DeedWindow, PeopleCircle, PlanUnit, RakahCount, Rule, SinCategory, Stage, VaultPayload } from '@thekra/practice-core';

export type Basis = 'text' | 'organizational';

export interface CatalogOccasion {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  rule: Rule;
  basis: Basis;
  evidence: string[];
}

export interface CatalogHabit {
  key: string;
  /** `periodic`: a template of «أعمال دورية» (7 periodic acts, not the 3 saplings). */
  kind?: 'periodic';
  /** A people list: people are added on the kinship screen with this circle. */
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
  /**
   * When the deed may be done (owner, 2026-11-01): only its anchors and fixed times inside it are offered
   * (`src/lib/practice/deed-window.ts`). Absent: any time and any anchor.
   */
  window?: DeedWindow;
  basis: Basis;
  evidence: string[];
}

export interface StageContent {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  lines?: number[];
  evidence?: string[];
}

export interface SinProgramsCommon {
  willQuestionAr: string;
  willQuestionEn: string;
  stageMinDays: number;
  stages: Partial<Record<Stage, StageContent>>;
  afterFall: StageContent;
  helpAr: string;
  helpEn: string;
}

export interface CatalogSinProgram {
  sin: string;
  category: SinCategory;
  gradualAllowed: boolean;
  help: boolean;
  gradualStepsAr?: string[];
  gradualStepsEn?: string[];
  actionsAr?: string[];
  actionsEn?: string[];
  alternatives?: string[];
  evidence?: string[];
  lines?: number[];
}

export interface SinProgramsCatalog {
  review: string;
  common: SinProgramsCommon;
  programs: CatalogSinProgram[];
}

export interface PracticeCatalog {
  occasions: CatalogOccasion[];
  habits: CatalogHabit[];
  sinPrograms: SinProgramsCatalog;
  /** Habit deed → its branches of faith. Optional until every API deploy sends it. */
  deedBranches?: Record<string, number[]>;
  /** Story key → Quote id, or null while not found (the UI hides it). Optional until every API deploy sends it. */
  stories?: Record<string, string | null>;
  /** «لحظة مجاهدة» ids (owner round 3). Optional until every API deploy sends it; the screen hides what is missing. */
  mujahada?: MujahadaCatalog;
}

/** «لحظة مجاهدة» ids in the practice catalog (backend heart-texts.yaml); every text is read by id. */
export interface MujahadaCatalog {
  /** Verse passages on patience and striving: each passage is 1–3 verse ids read together. */
  verses: string[][];
  /** Scholars' sayings (empty while none is published). */
  sayings: string[];
  /** A good deed is written ten times up to seven hundred times (al-Bukhari 6491). */
  multiplierHadith: string | null;
  /** The voluntary prayer sitting has half the reward (al-Bukhari 1115). */
  sittingPrayerHadith: string | null;
  /** Good-deed topic slugs for «أتبِع السيئةَ الحسنة». */
  easyHighReward: string[];
}

export interface CalendarOccasionDto {
  key: string;
  /** Local Gregorian date, YYYY-MM-DD. */
  date: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  basis: Basis;
  hijri: { year: number; month: number; day: number };
}

/** `GET /v1/me/sin-vault` → `vault` (contract §3): ciphertext only, never readable by the server. */
export type RemoteVault = Omit<VaultPayload, 'kdf'> & { kdf: string; updatedAt?: string };

/**
 * `GET /v1/auth/me/export`: user, favorites, settings, plans, logs, relatives, contacts and the vault ciphertext.
 * The app only re-shares it as JSON, so the shape is kept open.
 */
export type AccountExport = Record<string, unknown>;

export type UiLocale = 'ar' | 'en';

/** Picks the Arabic or English field of a catalog entry; falls back to Arabic when English is missing. */
export function pick<K extends string>(
  entry: Partial<Record<`${K}Ar` | `${K}En`, string | undefined>>,
  key: K,
  locale: UiLocale,
): string {
  const ar = entry[`${key}Ar` as `${K}Ar`] ?? '';
  if (locale === 'en') return entry[`${key}En` as `${K}En`] || ar;
  return ar;
}

/** Same for list fields (`actionsAr` / `actionsEn`, …). */
export function pickList(
  ar: string[] | undefined,
  en: string[] | undefined,
  locale: UiLocale,
): string[] {
  if (locale === 'en' && en && en.length > 0) return en;
  return ar ?? [];
}

/** Every evidence id used by the sin programs, sorted and unique. */
export function allSinProgramEvidenceIds(catalog: SinProgramsCatalog): string[] {
  const ids = new Set<string>();
  for (const stage of Object.values(catalog.common.stages)) stage?.evidence?.forEach((id) => ids.add(id));
  catalog.common.afterFall.evidence?.forEach((id) => ids.add(id));
  for (const p of catalog.programs) p.evidence?.forEach((id) => ids.add(id));
  return [...ids].sort();
}
