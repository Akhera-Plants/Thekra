/**
 * «حال يومي» (owner round 6, C-01r; docs/plan/2026-11-09-owner-round-6.md §2): one list instead of the round-5 toggles
 * «يومي ثقيل» / «عذر (مرض أو سفر)». The member picks how the day is:
 *
 * | State | Arabic | Excused (no streak break, no reminders) | Asks the habit's «القدر الأدنى» |
 * | --- | --- | --- | --- |
 * | `normal` | يوم عادي | no | no |
 * | `sick` | مرض شديد | yes | yes |
 * | `busy` | انشغالات طارئة | no (anything logged completes the day, like «يومي ثقيل») | yes |
 * | `travel` | سفر | yes | yes |
 *
 * Data (synced with the settings record, sync contract «Round 6»):
 * - `settings.dayStates`: the hard days and their state, ascending, at most {@link MAX_EXCUSED_DAYS}.
 * - `settings.excusedDays` keeps its meaning: `sick` and `travel` days are in it too, so older clients still skip them.
 * - `busy` on today also starts the plans' one-day ebb («يومي ثقيل», `Plan.ebb`), so older clients ask the minimum.
 *
 * Old data stays readable: an excused day without a state reads as `sick` with `legacy: true` (the old «عذر (مرض أو
 * سفر)»: the client may say «مرض أو سفر»); a day with a plan ebb and no state reads as `busy` with `legacy: true`.
 *
 * Wording is the clients' (calm: «سامح نفسك اليوم…» for habits; firm and kind for «تخفّف», never «سامح نفسك» on a slip).
 * Pure; the store is never changed.
 */
import { addDays, isValidDate, nowIso, type IsoTime, type LocalDate } from './dates.js';
import { endEbb, isEbbOn, isPaused, minimumOf, requiredOn, startEbb, type Plan } from './plan.js';
import {
  canExcuse,
  cleanExcusedDays,
  EXCUSE_WINDOW_DAYS,
  isExcused,
  MAX_EXCUSED_DAYS,
  updatePlan,
  updateSettings,
  type Store,
} from './storage.js';

export const DAY_STATES = ['normal', 'sick', 'busy', 'travel'] as const;
export type DayState = (typeof DAY_STATES)[number];
/** A state that is stored (every state but `normal`). */
export type HardDayState = Exclude<DayState, 'normal'>;
export const HARD_DAY_STATES: readonly HardDayState[] = ['sick', 'busy', 'travel'];

export interface DayStateEntry {
  date: LocalDate;
  state: HardDayState;
}

/** What each state implies (see the table at the top). */
export const DAY_STATE_INFO: Readonly<Record<DayState, { excused: boolean; minimum: boolean }>> = {
  normal: { excused: false, minimum: false },
  sick: { excused: true, minimum: true },
  busy: { excused: false, minimum: true },
  travel: { excused: true, minimum: true },
};

export function isDayState(value: unknown): value is DayState {
  return typeof value === 'string' && (DAY_STATES as readonly string[]).includes(value);
}

export function isHardDayState(value: unknown): value is HardDayState {
  return typeof value === 'string' && (HARD_DAY_STATES as readonly string[]).includes(value);
}

/** Valid entries, one per date (the later one in the list wins), ascending, the newest {@link MAX_EXCUSED_DAYS}. Never throws. */
export function parseDayStates(raw: unknown): DayStateEntry[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<LocalDate, HardDayState>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    if (!isValidDate(r.date) || !isHardDayState(r.state)) continue;
    byDate.set(r.date, r.state);
  }
  const out = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, state]) => ({ date, state }));
  return out.slice(Math.max(0, out.length - MAX_EXCUSED_DAYS));
}

/** The server's check of a sent list: at most {@link MAX_EXCUSED_DAYS} `{date, state}`, ascending and unique. */
export function validateDayStates(raw: unknown): string | null {
  if (!Array.isArray(raw)) return 'dayStates must be an array';
  if (raw.length > MAX_EXCUSED_DAYS) return `dayStates must hold at most ${MAX_EXCUSED_DAYS} days`;
  let last = '';
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return 'dayStates entries must be {date, state}';
    const r = item as Record<string, unknown>;
    if (!isValidDate(r.date)) return 'dayStates date must be YYYY-MM-DD';
    if (!isHardDayState(r.state)) return `dayStates state must be one of ${HARD_DAY_STATES.join(', ')}`;
    if (r.date <= last) return 'dayStates dates must be ascending and unique';
    last = r.date;
  }
  return null;
}

/** Copies in the canonical field order (Postgres `jsonb` reorders object keys). */
export function cloneDayStates(list: readonly DayStateEntry[]): DayStateEntry[] {
  return list.map((e) => ({ date: e.date, state: e.state }));
}

export interface DayStateView {
  state: DayState;
  /** No streak break, no reminders (`sick`, `travel`). */
  excused: boolean;
  /** The habits ask their «القدر الأدنى». */
  minimum: boolean;
  /** Read from round-5 data: an «عذر» day (`sick`) or a «يومي ثقيل» ebb (`busy`) without a stored state. */
  legacy: boolean;
}

/** How `date` stands. */
export function dayStateOn(store: Pick<Store, 'settings' | 'plans'>, date: LocalDate): DayStateView {
  const entry = store.settings.dayStates?.find((e) => e.date === date);
  if (entry) return { state: entry.state, ...DAY_STATE_INFO[entry.state], legacy: false };
  if (isExcused(store, date)) return { state: 'sick', ...DAY_STATE_INFO.sick, legacy: true };
  if (store.plans.some((p) => isEbbOn(p, date))) return { state: 'busy', ...DAY_STATE_INFO.busy, legacy: true };
  return { state: 'normal', ...DAY_STATE_INFO.normal, legacy: false };
}

/** True when `date` asks only the minimum of each habit (a hard state, or an old «يومي ثقيل»). */
export function isHardDay(store: Pick<Store, 'settings' | 'plans'>, date: LocalDate): boolean {
  return dayStateOn(store, date).minimum;
}

/**
 * The amount a plan asks on `date` with the day's state: on a hard day its «القدر الأدنى» (`minimumOf`, never more
 * than the day's own amount), else `requiredOn`.
 */
export function requiredOnDay(store: Pick<Store, 'settings' | 'plans'>, plan: Plan, date: LocalDate): number {
  const required = requiredOn(plan, date);
  return isHardDay(store, date) ? Math.min(required, minimumOf(plan)) : required;
}

/**
 * Sets the state of `date` (today or up to {@link EXCUSE_WINDOW_DAYS} days back; throws otherwise). Keeps
 * `excusedDays` in step (`sick` / `travel` in, others out) and, for today, the plans' one-day ebb (`busy` starts it on
 * every unpaused plan; any other state ends an ebb of that day).
 */
export function setDayState(store: Store, date: LocalDate, state: DayState, today: LocalDate, now: IsoTime = nowIso()): Store {
  if (!canExcuse(date, today)) throw new RangeError('This day cannot be set');
  if (!isDayState(state)) throw new RangeError('Invalid day state');
  const floor = addDays(today, -EXCUSE_WINDOW_DAYS);
  const entries = (store.settings.dayStates ?? []).filter((e) => e.date !== date && e.date > floor);
  if (state !== 'normal') entries.push({ date, state });
  const excused = (store.settings.excusedDays ?? []).filter((d) => d !== date && d > floor);
  if (DAY_STATE_INFO[state].excused) excused.push(date);
  let next = updateSettings(store, { dayStates: parseDayStates(entries), excusedDays: cleanExcusedDays(excused) }, now);
  for (const plan of next.plans) {
    if (state === 'busy' && date === today && !isPaused(plan) && !isEbbOn(plan, date)) {
      next = updatePlan(next, plan.id, (p) => startEbb(p, date, now), now);
    } else if (state !== 'busy' && isEbbOn(plan, date)) {
      next = updatePlan(next, plan.id, (p) => endEbb(p, now), now);
    }
  }
  return next;
}
