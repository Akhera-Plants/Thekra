/**
 * The habit catalog (good deeds only). Source of truth: backend/prisma/taxonomy/deed-schedules.yaml, served by
 * GET https://thekra.vercel.app/v1/practice/catalog and bundled at build time (scripts/gen-catalog.mjs) as the
 * offline fallback. Every entry is validated here; an invalid entry is dropped, never "repaired".
 */
import { isValidTime, validateRule, type PlanUnit, type Rule } from '@thekra/practice-core';

export interface Habit {
  key: string;
  titleAr: string;
  titleEn: string;
  /** GoodDeed slug: the site page the reminder opens. */
  deed: string;
  unit: PlanUnit;
  unitLabelAr: string;
  unitLabelEn: string;
  /** Suggested small start for someone far from / near to the habit. */
  start?: { far: number; near: number };
  ceiling?: number;
  defaultRule: Rule;
  timeHintAr?: string;
  timeHintEn?: string;
  defaultSlots: string[];
  /** `organizational`: a suggested rhythm, not a religious timing (the UI says so). */
  basis: 'text' | 'organizational';
  /** Quote ids published on the site. Texts are always fetched from the API, never stored in the catalog. */
  evidence: string[];
}

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** One habit from untrusted JSON, or `null` when anything required is missing or malformed. */
export function parseHabit(raw: unknown): Habit | null {
  if (!isRecord(raw)) return null;
  const { key, titleAr, titleEn, deed, unit, unitLabelAr, unitLabelEn, start, ceiling, defaultRule, defaultSlots, basis, evidence } = raw;
  if (typeof key !== 'string' || !SLUG.test(key)) return null;
  if (typeof deed !== 'string' || !SLUG.test(deed)) return null;
  if (!isText(titleAr) || !isText(titleEn)) return null;
  if (unit !== 'minutes' && unit !== 'count' && unit !== 'times') return null;
  if (basis !== 'text' && basis !== 'organizational') return null;
  if (validateRule(defaultRule) !== null) return null;
  if (!Array.isArray(defaultSlots) || defaultSlots.length === 0 || !defaultSlots.every(isValidTime)) return null;
  if (!Array.isArray(evidence) || !evidence.every((id) => typeof id === 'string' && UUID.test(id))) return null;
  const habit: Habit = {
    key,
    titleAr: titleAr.trim(),
    titleEn: titleEn.trim(),
    deed,
    unit,
    unitLabelAr: isText(unitLabelAr) ? unitLabelAr.trim() : '',
    unitLabelEn: isText(unitLabelEn) ? unitLabelEn.trim() : '',
    defaultRule: JSON.parse(JSON.stringify(defaultRule)) as Rule,
    defaultSlots: [...new Set(defaultSlots as string[])].sort(),
    basis,
    evidence: [...(evidence as string[])],
  };
  if (isRecord(start) && isPositive(start.far) && isPositive(start.near)) habit.start = { far: start.far, near: start.near };
  if (isPositive(ceiling)) habit.ceiling = ceiling;
  if (isText(raw.timeHintAr)) habit.timeHintAr = raw.timeHintAr.trim();
  if (isText(raw.timeHintEn)) habit.timeHintEn = raw.timeHintEn.trim();
  return habit;
}

/**
 * Habits from the bundled JSON (`{habits}`) or the API body (`{data: {habits, occasions, sinPrograms}}`).
 * `sinPrograms` and `occasions` are ignored: the extension carries good deeds only.
 */
export function parseCatalog(raw: unknown): Habit[] {
  const body = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(body) || !Array.isArray(body.habits)) return [];
  const seen = new Set<string>();
  const out: Habit[] = [];
  for (const item of body.habits) {
    const h = parseHabit(item);
    if (h && !seen.has(h.key)) {
      seen.add(h.key);
      out.push(h);
    }
  }
  return out;
}

export function habitTitle(h: Habit, lang: 'ar' | 'en'): string {
  return lang === 'en' ? h.titleEn : h.titleAr;
}

export function unitLabel(h: Pick<Habit, 'unitLabelAr' | 'unitLabelEn'>, lang: 'ar' | 'en'): string {
  return lang === 'en' ? h.unitLabelEn : h.unitLabelAr;
}

/**
 * «2 دقيقة», «33 مرة», «ركعتان» (amount 1 of a `times` unit whose label already names the unit), «2 × ركعتان».
 * Western digits always.
 */
export function formatAmount(amount: number, unit: PlanUnit, label: string): string {
  const n = String(amount);
  if (!label) return n;
  if (unit === 'times') return amount === 1 ? label : `${n} × ${label}`;
  return `${n} ${label}`;
}

/** The deed page on the site: Arabic has no locale prefix, English is under /en. */
export function deedUrl(deed: string, lang: 'ar' | 'en'): string {
  if (!SLUG.test(deed)) throw new RangeError('Invalid deed slug');
  return `https://thekra-web.vercel.app${lang === 'en' ? '/en' : ''}/good-deeds/${deed}`;
}
