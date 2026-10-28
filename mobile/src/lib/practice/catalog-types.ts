/**
 * Shapes served by `GET /v1/practice/catalog` and `GET /v1/calendar/occasions`.
 * The catalog objects are exactly the entries of backend/prisma/taxonomy/deed-schedules.yaml and
 * sin-programs.yaml (reviewed content; the app never writes religious text of its own).
 */

import type { PlanUnit, Rule, SinCategory, Stage, VaultPayload } from '@thekra/practice-core';

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
  start: { far: number; near: number };
  ceiling?: number;
  defaultRule: Rule;
  timeHintAr?: string;
  timeHintEn?: string;
  defaultSlots: string[];
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
