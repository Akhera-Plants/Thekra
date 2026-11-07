/**
 * «الفرائض» (owner round 5, F-05 a; docs/plan/2026-11-07-owner-round-5.md §3): opt-in rows for the five obligatory
 * prayers at the top of «ورد اليوم». Per day and prayer the member marks «صلّيتها في وقتها» (`onTime`) or «قضاء»
 * (`qada`), or leaves it empty.
 *
 * - Not a habit: the marks are not plans, so they are outside the limit of 3 young habits (`limits.ts`), the streak
 *   (`streak.ts`), adherence, the weekly review and the habit reminders. Only {@link fardStats} reads them.
 * - The switch is `Store.settings.fardTracking` (synced; off by default). Turning it off keeps the marks.
 * - The marks are `Store.fard` and sync item by item (sync contract «Round 5»): last writer wins per (date, prayer) by
 *   `updatedAt`; clearing a mark is a write of `status: null`, so it reaches the other devices too.
 * - No wording of blame anywhere: an empty prayer is just empty («لم تسجَّل»), never «فاتتك».
 *
 * Pure; inputs are never mutated.
 */
import { isIsoTime, isValidDate, isoMillis, nowIso, addDays, type IsoTime, type LocalDate } from './dates.js';
import { PRAYERS, type Prayer } from './prayer.js';
import type { Store } from './storage.js';

/** The five prayers in their order (the same keys as prayer times). */
export const FARD_PRAYERS: readonly Prayer[] = PRAYERS;
export type FardPrayer = Prayer;

/** «صلّيتها في وقتها» / «قضاء». */
export const FARD_STATUSES = ['onTime', 'qada'] as const;
export type FardStatus = (typeof FARD_STATUSES)[number];

/** Days {@link fardStats} looks back over by default. */
export const FARD_STATS_DAYS = 30;

/**
 * Evidence for «الفرائض» (round 5, F-05 a): public Quote ids checked on production 2026-11-07, read through the API.
 * On time: Bukhari 527 «الصلاة على وقتها», an-Nisa 4:103. Making up: Anas «من نسي صلاة فليصلها إذا ذكرها»
 * (HadeethEnc), Muslim 684. For the sheikh's review.
 */
export const FARD_EVIDENCE: readonly string[] = [
  '5671bf91-6335-49b4-9011-61c74dd1c460',
  'a48122ef-ad7a-430e-86ab-d1691ec94ead',
  'c26d3591-d64b-4c90-88be-f35fe1597904',
  '017fb373-6442-4411-b0f7-48da23684841',
];

/** One prayer of one day. `status: null` is a cleared mark (kept so the clearing syncs). */
export interface FardMark {
  date: LocalDate;
  prayer: FardPrayer;
  status: FardStatus | null;
  /** ISO time of the edit: the last-writer-wins version. */
  updatedAt: IsoTime;
}

/** Labels shared by both clients. */
export const FARD_LABELS = {
  ar: {
    title: 'الفرائض',
    onTime: 'صلّيتها في وقتها',
    qada: 'قضاء',
    prayers: { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' } as Record<FardPrayer, string>,
  },
  en: {
    title: 'Obligatory prayers',
    onTime: 'Prayed on time',
    qada: 'Made up (qaḍāʾ)',
    prayers: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' } as Record<FardPrayer, string>,
  },
} as const;

export function isFardPrayer(value: unknown): value is FardPrayer {
  return typeof value === 'string' && (FARD_PRAYERS as readonly string[]).includes(value);
}

export function isFardStatus(value: unknown): value is FardStatus {
  return typeof value === 'string' && (FARD_STATUSES as readonly string[]).includes(value);
}

/** The id of a mark in sync bookkeeping: `${date}|${prayer}`. */
export function fardKey(date: LocalDate, prayer: FardPrayer): string {
  return `${date}|${prayer}`;
}

/** Orders two versions of one mark: > 0 when `a` wins. Later `updatedAt`; then a cleared mark; then `qada` > `onTime`. */
export function compareFardMarks(a: Pick<FardMark, 'status' | 'updatedAt'>, b: Pick<FardMark, 'status' | 'updatedAt'>): number {
  const ta = isoMillis(a.updatedAt);
  const tb = isoMillis(b.updatedAt);
  if (ta !== tb) return ta > tb ? 1 : -1;
  if ((a.status === null) !== (b.status === null)) return a.status === null ? 1 : -1;
  const ca = a.status ?? '';
  const cb = b.status ?? '';
  return ca === cb ? 0 : ca > cb ? 1 : -1;
}

function byDayThenPrayer(a: FardMark, b: FardMark): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return FARD_PRAYERS.indexOf(a.prayer) - FARD_PRAYERS.indexOf(b.prayer);
}

/** Valid marks from untrusted input, one per (date, prayer) (the winning version), sorted by day then prayer. Never throws. */
export function parseFardMarks(raw: unknown): FardMark[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, FardMark>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (!isValidDate(r.date) || !isFardPrayer(r.prayer) || !isIsoTime(r.updatedAt)) continue;
    if (r.status !== null && !isFardStatus(r.status)) continue;
    const mark: FardMark = { date: r.date, prayer: r.prayer, status: r.status as FardStatus | null, updatedAt: r.updatedAt };
    const key = fardKey(mark.date, mark.prayer);
    const prev = byKey.get(key);
    if (!prev || compareFardMarks(mark, prev) > 0) byKey.set(key, mark);
  }
  return [...byKey.values()].sort(byDayThenPrayer);
}

/** True when «الفرائض» is switched on for this member. */
export function fardEnabled(store: Pick<Store, 'settings'>): boolean {
  return store.settings.fardTracking === true;
}

/** The marks of one day: every prayer, `null` when empty or cleared. */
export function fardOn(store: Pick<Store, 'fard'>, date: LocalDate): Record<FardPrayer, FardStatus | null> {
  const out = { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null } as Record<FardPrayer, FardStatus | null>;
  for (const m of store.fard ?? []) if (m.date === date) out[m.prayer] = m.status;
  return out;
}

/** A mark may be set for today or any earlier day (never a future day). */
export function canMarkFard(date: LocalDate, today: LocalDate): boolean {
  return isValidDate(date) && isValidDate(today) && date <= today;
}

/**
 * Sets (or clears, with `null`) one prayer of one day and stamps `updatedAt = now`. Writing the same status again
 * changes nothing (no new version to sync). Throws on an invalid date, prayer or status, or a future day.
 */
export function setFard(
  store: Store,
  input: { date: LocalDate; prayer: FardPrayer; status: FardStatus | null; today: LocalDate },
  now: IsoTime = nowIso(),
): Store {
  if (!canMarkFard(input.date, input.today)) throw new RangeError('This day cannot be marked');
  if (!isFardPrayer(input.prayer)) throw new RangeError('Invalid prayer');
  if (input.status !== null && !isFardStatus(input.status)) throw new RangeError('Invalid status');
  const marks = store.fard ?? [];
  const existing = marks.find((m) => m.date === input.date && m.prayer === input.prayer);
  if (existing ? existing.status === input.status : input.status === null) return store;
  // Never older than the stored version (a device whose clock is behind still wins over its own last edit).
  const at = existing && isoMillis(existing.updatedAt) >= isoMillis(now) ? new Date(isoMillis(existing.updatedAt) + 1).toISOString() : now;
  const next: FardMark = { date: input.date, prayer: input.prayer, status: input.status, updatedAt: at };
  const rest = marks.filter((m) => !(m.date === input.date && m.prayer === input.prayer));
  return { ...store, fard: [...rest, next].sort(byDayThenPrayer) };
}

export interface FardStats {
  /** Days in the window (`today` included). */
  days: number;
  /** Days with at least one prayer marked. */
  markedDays: number;
  /** Days with all five prayers marked «في وقتها». */
  allOnTimeDays: number;
  /** Prayers marked «في وقتها». */
  onTime: number;
  /** Prayers marked «قضاء». */
  qada: number;
  /** Per prayer: how often each was marked. */
  perPrayer: Record<FardPrayer, { onTime: number; qada: number }>;
}

/**
 * «الفرائض» in «سجلّي»: counts over the `days` days ending on `today` (today included: a mark made today is final).
 * Counts only, no streak and no percentage of «missed» prayers.
 */
export function fardStats(store: Pick<Store, 'fard'>, today: LocalDate, days: number = FARD_STATS_DAYS): FardStats {
  const from = addDays(today, -(Math.max(1, Math.trunc(days)) - 1));
  const perPrayer = Object.fromEntries(FARD_PRAYERS.map((p) => [p, { onTime: 0, qada: 0 }])) as FardStats['perPrayer'];
  const byDay = new Map<LocalDate, FardMark[]>();
  let onTime = 0;
  let qada = 0;
  for (const m of store.fard ?? []) {
    if (m.date < from || m.date > today || m.status === null) continue;
    if (m.status === 'onTime') {
      onTime++;
      perPrayer[m.prayer].onTime++;
    } else {
      qada++;
      perPrayer[m.prayer].qada++;
    }
    byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]);
  }
  let allOnTimeDays = 0;
  for (const list of byDay.values()) if (list.length === FARD_PRAYERS.length && list.every((m) => m.status === 'onTime')) allOnTimeDays++;
  return { days: Math.max(1, Math.trunc(days)), markedDays: byDay.size, allOnTimeDays, onTime, qada, perPrayer };
}
