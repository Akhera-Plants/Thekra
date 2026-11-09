/**
 * «قضاء الفوائت» (owner round 6, C-01a; docs/plan/2026-11-09-owner-round-6.md §5): a member who owes prayers enters how
 * many (per prayer, or one total), chooses a pace (prayers a day), and logs what he makes up; a circular chart shows
 * how much is done. Kind wording only (the clients' strings): never «فاتتك», never a count of failures.
 *
 * Data, synced with the account (sync contract «Round 6»):
 * - the plan is `settings.qada` (part of the settings record, last writer wins): {@link QadaPlan};
 * - the make-ups are `Store.qadaLogs`: one {@link QadaLog} per (date, prayer) holding that day's count, last writer
 *   wins by `updatedAt` (ties: the larger count), like «الفرائض» marks. A count of 0 is a cleared day (kept so the
 *   clearing syncs).
 *
 * Not a habit: outside the limit of 3, the streak and the habit reminders. Separate from «الفرائض» marks (a mark
 * `qada` there is today's prayer prayed late; this is old prayers owed). Pure; inputs are never mutated.
 */
import { addDays, diffDays, isIsoTime, isValidDate, isoMillis, nowIso, type IsoTime, type LocalDate } from './dates.js';
import { FARD_PRAYERS, type FardPrayer } from './fard.js';
import { updateSettings, type Store } from './storage.js';

/** The five prayers, then `any` (a make-up counted against the total only). */
export type QadaKey = FardPrayer | 'any';
export const QADA_KEYS: readonly QadaKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'any'];

/** Most prayers owed per key (≈ 27 years of one prayer). */
export const QADA_OWED_MAX = 10_000;
/** Pace: prayers a day, 1…{@link QADA_PER_DAY_MAX}. */
export const QADA_PER_DAY_MAX = 50;
/** Most make-ups logged on one day for one key. */
export const QADA_DAY_MAX = 100;

export interface QadaPlan {
  /** Owed per prayer; a member who knows only a total puts it in `any` (the five stay 0). */
  owed: Record<QadaKey, number>;
  /** The pace the member chose: prayers made up per day. */
  perDay: number;
  /** The day the plan started (the pace is measured from it). */
  startedOn: LocalDate;
}

export interface QadaLog {
  date: LocalDate;
  prayer: QadaKey;
  /** Prayers made up that day for that key, 0…{@link QADA_DAY_MAX}. */
  count: number;
  /** ISO time of the edit: the last-writer-wins version. */
  updatedAt: IsoTime;
}

export function isQadaKey(value: unknown): value is QadaKey {
  return typeof value === 'string' && (QADA_KEYS as readonly string[]).includes(value);
}

const isCount = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** The first problem of a plan (server and client check), or null. Unknown fields are ignored. */
export function validateQadaPlan(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'qada must be an object';
  const r = raw as Record<string, unknown>;
  const owed = r.owed;
  if (typeof owed !== 'object' || owed === null || Array.isArray(owed)) return 'qada.owed must be an object';
  let total = 0;
  for (const k of QADA_KEYS) {
    const v = (owed as Record<string, unknown>)[k] ?? 0;
    if (!isCount(v, QADA_OWED_MAX)) return `qada.owed.${k} must be an integer 0…${QADA_OWED_MAX}`;
    total += v;
  }
  if (total === 0) return 'qada.owed must hold at least one prayer';
  if (typeof r.perDay !== 'number' || !Number.isInteger(r.perDay) || r.perDay < 1 || r.perDay > QADA_PER_DAY_MAX) {
    return `qada.perDay must be an integer 1…${QADA_PER_DAY_MAX}`;
  }
  if (!isValidDate(r.startedOn)) return 'qada.startedOn must be YYYY-MM-DD';
  return null;
}

/** A valid plan in the canonical order (every key present), or null. Never throws. */
export function parseQadaPlan(raw: unknown): QadaPlan | null {
  if (validateQadaPlan(raw) !== null) return null;
  const r = raw as { owed: Record<string, number | undefined>; perDay: number; startedOn: LocalDate };
  return cloneQadaPlan({ owed: Object.fromEntries(QADA_KEYS.map((k) => [k, r.owed[k] ?? 0])) as Record<QadaKey, number>, perDay: r.perDay, startedOn: r.startedOn });
}

/** A copy in the canonical field order (Postgres `jsonb` reorders object keys). */
export function cloneQadaPlan(plan: QadaPlan): QadaPlan {
  const owed = {} as Record<QadaKey, number>;
  for (const k of QADA_KEYS) owed[k] = plan.owed[k] ?? 0;
  return { owed, perDay: plan.perDay, startedOn: plan.startedOn };
}

/** Orders two versions of one day's log: > 0 when `a` wins. Later `updatedAt`; then the larger count. */
export function compareQadaLogs(a: Pick<QadaLog, 'count' | 'updatedAt'>, b: Pick<QadaLog, 'count' | 'updatedAt'>): number {
  const ta = isoMillis(a.updatedAt);
  const tb = isoMillis(b.updatedAt);
  if (ta !== tb) return ta > tb ? 1 : -1;
  return a.count === b.count ? 0 : a.count > b.count ? 1 : -1;
}

export function qadaLogKey(date: LocalDate, prayer: QadaKey): string {
  return `${date}|${prayer}`;
}

function byDayThenKey(a: QadaLog, b: QadaLog): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return QADA_KEYS.indexOf(a.prayer) - QADA_KEYS.indexOf(b.prayer);
}

/** Valid logs, one per (date, prayer) (the winning version), sorted. Never throws. */
export function parseQadaLogs(raw: unknown): QadaLog[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, QadaLog>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (!isValidDate(r.date) || !isQadaKey(r.prayer) || !isCount(r.count, QADA_DAY_MAX) || !isIsoTime(r.updatedAt)) continue;
    const log: QadaLog = { date: r.date, prayer: r.prayer, count: r.count, updatedAt: r.updatedAt };
    const key = qadaLogKey(log.date, log.prayer);
    const prev = byKey.get(key);
    if (!prev || compareQadaLogs(log, prev) > 0) byKey.set(key, log);
  }
  return [...byKey.values()].sort(byDayThenKey);
}

/** Starts, changes or (with `null`) removes the plan. The logs stay. Throws on an invalid plan. */
export function setQadaPlan(store: Store, plan: QadaPlan | null, now: IsoTime = nowIso()): Store {
  if (plan !== null && validateQadaPlan(plan) !== null) throw new RangeError(`Invalid qada: ${validateQadaPlan(plan)}`);
  return updateSettings(store, { qada: plan === null ? undefined : cloneQadaPlan(plan) }, now);
}

/** The count logged on a day for a key (0 when none). */
export function qadaCountOn(store: Pick<Store, 'qadaLogs'>, date: LocalDate, prayer: QadaKey): number {
  return store.qadaLogs?.find((l) => l.date === date && l.prayer === prayer)?.count ?? 0;
}

/**
 * Sets the count of one day and key (0 clears it) and stamps `updatedAt = now` (never older than the stored version).
 * The day may be today or earlier. Writing the same count changes nothing. Throws on invalid input.
 */
export function setQadaCount(
  store: Store,
  input: { date: LocalDate; prayer: QadaKey; count: number; today: LocalDate },
  now: IsoTime = nowIso(),
): Store {
  if (!isValidDate(input.date) || !isValidDate(input.today) || input.date > input.today) throw new RangeError('This day cannot be logged');
  if (!isQadaKey(input.prayer)) throw new RangeError('Invalid prayer');
  if (!isCount(input.count, QADA_DAY_MAX)) throw new RangeError(`count must be an integer 0…${QADA_DAY_MAX}`);
  const logs = store.qadaLogs ?? [];
  const existing = logs.find((l) => l.date === input.date && l.prayer === input.prayer);
  if (existing ? existing.count === input.count : input.count === 0) return store;
  const at = existing && isoMillis(existing.updatedAt) >= isoMillis(now) ? new Date(isoMillis(existing.updatedAt) + 1).toISOString() : now;
  const rest = logs.filter((l) => !(l.date === input.date && l.prayer === input.prayer));
  return { ...store, qadaLogs: [...rest, { date: input.date, prayer: input.prayer, count: input.count, updatedAt: at }].sort(byDayThenKey) };
}

/** «قضيت»: adds `add` (negative to take back) to the day's count, clamped to 0…{@link QADA_DAY_MAX}. */
export function logQada(
  store: Store,
  input: { date: LocalDate; prayer: QadaKey; add: number; today: LocalDate },
  now: IsoTime = nowIso(),
): Store {
  if (!Number.isInteger(input.add)) throw new RangeError('add must be an integer');
  const count = Math.max(0, Math.min(QADA_DAY_MAX, qadaCountOn(store, input.date, input.prayer) + input.add));
  return setQadaCount(store, { date: input.date, prayer: input.prayer, count, today: input.today }, now);
}

export interface QadaProgress {
  /** All prayers owed. */
  owedTotal: number;
  /** Made up so far, never above `owedTotal` (the circle's filled part). */
  doneTotal: number;
  remaining: number;
  /** Whole percent 0…100 (Western digits on screen). */
  percent: number;
  /** Per key: owed and made up (a key's done never above its owed, except `any`, which counts toward the total). */
  perKey: Record<QadaKey, { owed: number; done: number }>;
  perDay: number;
  /** Made up today. */
  today: number;
  /** Days left at the chosen pace (0 when done). */
  daysLeft: number;
  /** The day the last prayer is made up at the pace, or null when done. */
  finishOn: LocalDate | null;
  /** What the pace would have made up by today since `startedOn` (capped at the total): for a kind «on your way» line. */
  expectedByToday: number;
}

/** The circle and the numbers of «قضاء الفوائت», or null without a plan. */
export function qadaProgress(store: Pick<Store, 'settings' | 'qadaLogs'>, today: LocalDate): QadaProgress | null {
  const plan = store.settings.qada;
  if (!plan) return null;
  const raw = Object.fromEntries(QADA_KEYS.map((k) => [k, 0])) as Record<QadaKey, number>;
  let todayCount = 0;
  for (const l of store.qadaLogs ?? []) {
    if (l.date > today) continue;
    raw[l.prayer] += l.count;
    if (l.date === today) todayCount += l.count;
  }
  const owedTotal = QADA_KEYS.reduce((s, k) => s + plan.owed[k], 0);
  const perKey = {} as QadaProgress['perKey'];
  let counted = 0;
  for (const k of QADA_KEYS) {
    const done = k === 'any' ? raw.any : Math.min(plan.owed[k], raw[k]);
    perKey[k] = { owed: plan.owed[k], done };
    counted += done;
  }
  const doneTotal = Math.min(owedTotal, counted);
  const remaining = owedTotal - doneTotal;
  const daysLeft = Math.ceil(remaining / plan.perDay);
  const elapsed = Math.max(0, diffDays(plan.startedOn, today) + 1);
  return {
    owedTotal,
    doneTotal,
    remaining,
    percent: owedTotal === 0 ? 100 : Math.floor((doneTotal / owedTotal) * 100),
    perKey,
    perDay: plan.perDay,
    today: todayCount,
    daysLeft,
    finishOn: remaining === 0 ? null : addDays(today, daysLeft - (todayCount >= plan.perDay ? 0 : 1)),
    expectedByToday: Math.min(owedTotal, elapsed * plan.perDay),
  };
}
