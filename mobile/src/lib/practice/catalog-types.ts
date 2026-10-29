/**
 * Shapes served by `GET /v1/practice/catalog` and `GET /v1/calendar/occasions`.
 * The catalog objects are exactly the entries of backend/prisma/taxonomy/deed-schedules.yaml and
 * sin-programs.yaml (reviewed content; the app never writes religious text of its own).
 */

import type { FreshStartKind, MuhasabaQuestion, PlanAnchor, PlanUnit, RakahCount, Rule, SinCategory, Stage, VaultPayload } from '@thekra/practice-core';

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
  /** Suggested prayers to remind after («بعد الفجر»); an organizational suggestion, never a rule. */
  defaultAnchors?: Omit<PlanAnchor, 'slot'>[];
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
  breathe: StageContent & { breaths: number };
  text: StageContent;
  move: StageContent & { moves: GuidanceChoice[] };
  delay: StageContent & { minutes: number };
  companion: StageContent & { shareAr: string; shareEn: string };
  passed: StageContent;
}

/** «أتبِع السيئة الحسنة» (sin-programs.yaml `common.followWithGood`). */
export interface FollowWithGood {
  review: string;
  lines?: number[];
  istighfar: StageContent & { lineAr: string; lineEn: string };
  deeds: StageContent & { choices: GuidanceChoice[] };
  close: StageContent;
}

export interface SinProgramsCommon {
  willQuestionAr: string;
  willQuestionEn: string;
  stageMinDays: number;
  stages: Partial<Record<Stage, StageContent>>;
  afterFall: StageContent;
  /** Absent from an API that predates it: the app then hides «أشعر بضعف الآن». */
  urgeMoment?: UrgeMoment;
  /** Absent from an API that predates it: the app then shows the afterFall text only. */
  followWithGood?: FollowWithGood;
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
  occasions: CatalogOccasion[];
  habits: CatalogHabit[];
  sinPrograms: SinProgramsCatalog;
  /** Optional until every API deploy sends it: without it the tazkiya cards and lines stay hidden. */
  tazkiya?: TazkiyaPrompts;
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
  guidanceEvidenceIds(catalog.common).forEach((id) => ids.add(id));
  for (const p of catalog.programs) p.evidence?.forEach((id) => ids.add(id));
  return [...ids].sort();
}

/** The evidence ids of «لحظة الضعف» and «أتبِع السيئة الحسنة», in reading order. */
function guidanceEvidenceIds({ urgeMoment: u, followWithGood: f }: SinProgramsCommon): string[] {
  const texts: { evidence?: string[] }[] = [];
  if (u) texts.push(u.breathe, u.text, u.move, ...u.move.moves, u.delay, u.companion, u.passed);
  if (f) texts.push(f.istighfar, f.deeds, ...f.deeds.choices, f.close);
  return texts.flatMap((text) => text.evidence ?? []);
}
