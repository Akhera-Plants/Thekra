/**
 * «تخفَّف» support (redesign phase 3): «لحظة ضعف», the no-reset counters, «متى تضعف؟», the stage's one weekly task
 * and the «خربانة؟ صلّحها» helpers. Pure functions over a {@link SinProgram}.
 *
 * LOCAL ONLY, like the program itself: every value here is derived on the device and is never synced in clear, sent,
 * logged, put in a URL, a notification or analytics. The vault carries the program; nothing here adds to it.
 */
import { addDays, diffDays, toDayNumber, type IsoTime, type LocalDate } from './dates.js';
import { isPaused, minimumOf, type Plan } from './plan.js';
import {
  activePrograms,
  checkIn,
  currentStage,
  hasTriggers,
  stagesFor,
  TRIGGER_FEELINGS,
  TRIGGER_PLACES,
  TRIGGER_TIMES,
  type CheckIn,
  type GenericLimit,
  type LimitRef,
  type SinProgram,
  type Stage,
  type TriggerFeeling,
  type TriggerPlace,
  type TriggerTime,
} from './sin-program.js';

// ── «لحظة ضعف» ──────────────────────────────────────────────────────────────────────────────────────────────

/** The urge timer: an urge is a wave that passes; ten minutes. */
export const URGE_SECONDS = 600;
/** The rotating text changes every two minutes (five texts at most in one wave). */
export const URGE_TEXT_SECONDS = 120;

/** The one-tap actions, in display order. Each is a checklist tick on the screen only (nothing stored). */
export const URGE_ACTIONS = ['wudu', 'move', 'pray', 'call', 'dhikr'] as const;
export type UrgeAction = (typeof URGE_ACTIONS)[number];

export interface UrgeProgress {
  /** Whole seconds left, 0 at the end. */
  remaining: number;
  /** 0 → 1. */
  fraction: number;
  done: boolean;
}

/** Where the timer stands `nowMs` after `startedMs` (a clock that goes back counts as the start). */
export function urgeProgress(startedMs: number, nowMs: number, totalSeconds: number = URGE_SECONDS): UrgeProgress {
  const elapsed = Math.min(totalSeconds, Math.max(0, (nowMs - startedMs) / 1000));
  const remaining = Math.ceil(totalSeconds - elapsed);
  return { remaining, fraction: totalSeconds > 0 ? elapsed / totalSeconds : 1, done: remaining <= 0 };
}

/** `m:ss` with Western digits (content rule 7). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Which of `count` texts to show: a different starting text each day, then the next one every
 * {@link URGE_TEXT_SECONDS}. -1 when there is none.
 */
export function urgeTextIndex(count: number, today: LocalDate, elapsedSeconds: number): number {
  if (count <= 0) return -1;
  const step = Math.floor(Math.max(0, elapsedSeconds) / URGE_TEXT_SECONDS);
  return (((toDayNumber(today) + step) % count) + count) % count;
}

/**
 * The texts a weak moment may show for a program, in order and without repeats: the program's own evidence, then
 * the common after-fall evidence (and the harms stage's, if it ever has any). Without a program (or an unknown one)
 * only the common texts, so the screen reveals nothing about the user.
 */
export function urgeTextIds(programEvidence: readonly string[] | undefined, commonEvidence: readonly string[]): string[] {
  return [...new Set([...(programEvidence ?? []), ...commonEvidence])];
}

/**
 * The program a weak moment (or ورد اليوم's quiet button) is about: among the active programs, the latest started one
 * still before its last stage; otherwise the latest started. `null` when there is none.
 */
export function focusProgram(programs: readonly SinProgram[], today: LocalDate): SinProgram | null {
  const active = activePrograms(programs);
  if (active.length === 0) return null;
  const byStart = [...active].sort((a, b) => (a.startedOn < b.startedOn ? 1 : a.startedOn > b.startedOn ? -1 : 0));
  const working = byStart.find((p) => currentStage(p, today).index < stagesFor(p.category).length - 1);
  return working ?? byStart[0] ?? null;
}

/**
 * «عبرت الموجة؟ نعم»: records «ثبتّ» for today when the day has no check-in yet. A day already marked (any value) is
 * kept: passing one wave does not erase what the user wrote about the day.
 */
export function recordWavePassed(program: SinProgram, today: LocalDate, now?: IsoTime): SinProgram {
  if (program.checkIns.some((c) => c.date === today)) return program;
  return checkIn(program, today, 'held', undefined, now);
}

// ── No-reset counters ──────────────────────────────────────────────────────────────────────────────────────

/** The window of «ثبتّ X من 30». */
export const HELD_WINDOW_DAYS = 30;

export interface ProgramCounters {
  /** Days marked «ثبتّ» in the last 30 days (today included). Never reset by a fall. */
  held: number;
  window: number;
  /** Days since the last «وقعت ثم تبت», or since the start when there was none (starting is a repentance too). */
  daysSinceRepentance: number;
  /** True when {@link daysSinceRepentance} counts from the start. */
  fromStart: boolean;
}

export function programCounters(program: SinProgram, today: LocalDate): ProgramCounters {
  const from = addDays(today, -(HELD_WINDOW_DAYS - 1));
  let held = 0;
  let lastFall: LocalDate | null = null;
  for (const c of program.checkIns) {
    if (c.date > today) continue;
    if (c.value === 'held' && c.date >= from) held++;
    if (c.value === 'fell_repented' && (lastFall === null || c.date > lastFall)) lastFall = c.date;
  }
  const since = lastFall ?? program.startedOn;
  return { held, window: HELD_WINDOW_DAYS, daysSinceRepentance: Math.max(0, diffDays(since, today)), fromStart: lastFall === null };
}

/**
 * One hope text shown with a «وقعت ثم تبت» day: picks from the ids given (the catalog's after-fall evidence) by date,
 * so the same day shows the same text. `null` when there is none.
 */
export function hopeTextId(ids: readonly string[], date: LocalDate): string | null {
  if (ids.length === 0) return null;
  return ids[((toDayNumber(date) % ids.length) + ids.length) % ids.length] ?? null;
}

// ── «متى تضعف؟» ────────────────────────────────────────────────────────────────────────────────────────────

/** Check-ins with triggers needed before the summary shows. */
export const PATTERN_MIN_CHECKINS = 14;

export interface WeakPattern {
  /** Weak days and falls that carry at least one chip. */
  count: number;
  when: TriggerTime | null;
  where: TriggerPlace | null;
  feeling: TriggerFeeling | null;
}

function mostFrequent<T extends string>(values: readonly (T | undefined)[], order: readonly T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const key of order) {
    const n = counts.get(key) ?? 0;
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  return best;
}

/**
 * «متى تضعف؟»: the most frequent time, place and feeling among weak days and falls, once at least
 * {@link PATTERN_MIN_CHECKINS} of them carry chips; otherwise `null`. A tie goes to the earlier chip in display order.
 */
export function weakPattern(program: SinProgram, min: number = PATTERN_MIN_CHECKINS): WeakPattern | null {
  const tagged = program.checkIns.filter((c): c is CheckIn & { triggers: NonNullable<CheckIn['triggers']> } =>
    c.value !== 'held' && hasTriggers(c.triggers),
  );
  if (tagged.length < min) return null;
  return {
    count: tagged.length,
    when: mostFrequent(tagged.map((c) => c.triggers.when), TRIGGER_TIMES),
    where: mostFrequent(tagged.map((c) => c.triggers.where), TRIGGER_PLACES),
    feeling: mostFrequent(tagged.map((c) => c.triggers.feeling), TRIGGER_FEELINGS),
  };
}

const FEELING_LIMIT: Record<TriggerFeeling, GenericLimit> = {
  boredom: 'plan_free_time',
  tiredness: 'sleep_early',
  anger: 'wudu_when_angry',
  loneliness: 'call_someone_daily',
  stress: 'walk_with_dhikr',
  sadness: 'walk_with_dhikr',
};

const PLACE_LIMIT: Record<TriggerPlace, GenericLimit> = {
  alone: 'stay_near_people',
  with_someone: 'leave_gathering_early',
  outside: 'plan_before_going_out',
};

/**
 * The generic limit for a set of triggers: night (after Isha or late) and alone → the phone out of the room; then the
 * place; then the feeling; a night without a place → the phone out of the room. `null` when no chip points anywhere.
 */
export function genericLimitFor(t: { when?: TriggerTime | null; where?: TriggerPlace | null; feeling?: TriggerFeeling | null }): GenericLimit | null {
  const night = t.when === 'after_isha' || t.when === 'late_night';
  if (night && (t.where === 'alone' || !t.where)) return 'phone_outside_room';
  if (t.where) return PLACE_LIMIT[t.where];
  if (t.feeling) return FEELING_LIMIT[t.feeling];
  return null;
}

/**
 * The one limit «متى تضعف؟» suggests: the generic one the pattern points to, otherwise the program's first practical
 * step (`action:0`), otherwise «الهاتف خارج الغرفة».
 */
export function suggestedLimit(pattern: Pick<WeakPattern, 'when' | 'where' | 'feeling'>, actionCount: number): LimitRef {
  return genericLimitFor(pattern) ?? (actionCount > 0 ? 'action:0' : 'phone_outside_room');
}

/**
 * The limits «حدّ صغير لغد» offers: the program's own practical steps first, then the generic one for today's chips,
 * then the rest of the generic list, without repeats; at most `max`.
 */
export function limitChoices(actionCount: number, triggers: CheckIn['triggers'], max = 5): LimitRef[] {
  const out: LimitRef[] = [];
  for (let i = 0; i < Math.min(actionCount, 99); i++) out.push(`action:${i}`);
  const fit = triggers ? genericLimitFor(triggers) : null;
  if (fit) out.push(fit);
  for (const g of ['phone_outside_room', 'stay_near_people', 'plan_free_time'] as const) if (!out.includes(g)) out.push(g);
  return out.slice(0, max);
}

/** The limit picked yesterday for today («حدّ صغير لغد»), or `null`. */
export function limitForToday(program: SinProgram, today: LocalDate): LimitRef | null {
  const yesterday = addDays(today, -1);
  return program.checkIns.find((c) => c.date === yesterday)?.nextLimit ?? null;
}

// ── Stages as a line ───────────────────────────────────────────────────────────────────────────────────────

/** The one concrete task for the week of each stage (the client translates the key). */
export const STAGE_TASKS: Readonly<Record<Stage, string>> = {
  harms: 'write_three_harms',
  alternatives: 'add_alternative_habit',
  environment: 'change_one_place_or_time',
  limits: 'choose_one_limit',
  restore_rights: 'restore_one_right',
  leave: 'keep_alternative_habits',
};

export type StageState = 'done' | 'current' | 'next';

export interface StageTrackItem {
  stage: Stage;
  state: StageState;
}

/** The stages as a compact line: before the current one done, the current one, after it next. */
export function stageTrack(program: SinProgram, today: LocalDate): StageTrackItem[] {
  const { index } = currentStage(program, today);
  return stagesFor(program.category).map((stage, i) => ({ stage, state: i < index ? 'done' : i === index ? 'current' : 'next' }));
}

// ── «أتبع السيئة الحسنة» ───────────────────────────────────────────────────────────────────────────────────

/**
 * The user's own plan for one of the program's alternative habits (live, not paused), whose minimum can be logged
 * in one tap; `null` when there is none (the client then offers the generic «حسنة الآن» mark).
 */
export function alternativePlan(plans: readonly Plan[], alternatives: readonly string[]): { plan: Plan; minimum: number } | null {
  for (const key of alternatives) {
    const plan = plans.find((p) => p.habitKey === key && !isPaused(p));
    if (plan) return { plan, minimum: minimumOf(plan) };
  }
  return null;
}

// ── Shared by the screens (web and mobile) ─────────────────────────────────────────────────────────────────

/**
 * The program «لحظة ضعف» is about. `undefined` (a direct visit) or `null` (opened from «ورد اليوم» or «تخفَّف»): the
 * program in focus. A slug (opened from a sin page): that sin's active program, or `null` so the screen stays generic
 * and reveals nothing when the user does not follow it.
 */
export function momentProgram(programs: readonly SinProgram[], source: string | null | undefined, today: LocalDate): SinProgram | null {
  if (source === undefined || source === null) return focusProgram(programs, today);
  return activePrograms(programs).find((p) => p.sinSlug === source) ?? null;
}

/** A limit as shown: the program's own step (`action:<n>`) or a generic key the client translates; `null` when unknown. */
export type ResolvedLimit = { kind: 'action'; text: string } | { kind: 'generic'; key: GenericLimit };

export function resolveLimit(ref: LimitRef, actions: readonly string[]): ResolvedLimit | null {
  if (ref.startsWith('action:')) {
    const text = actions[Number(ref.slice('action:'.length))];
    return text ? { kind: 'action', text } : null;
  }
  return { kind: 'generic', key: ref as GenericLimit };
}

/** A fetched text: only what the helpers below read. */
export interface TextRef {
  id: string;
  textAr: string;
}

/** «تب الآن»: the shortest of the after-fall texts that were fetched (a short supplication or verse), or `null`. */
export function shortestTextId(ids: readonly string[], texts: readonly TextRef[]): string | null {
  const byId = new Map(texts.map((q) => [q.id, q]));
  let best: TextRef | null = null;
  for (const id of ids) {
    const q = byId.get(id);
    if (q && (!best || q.textAr.length < best.textAr.length)) best = q;
  }
  return best?.id ?? null;
}

/** One hope text for a «وقعت ثم تبت» day among the fetched after-fall texts, avoiding `exclude` when others remain. */
export function hopeTextFor(ids: readonly string[], texts: readonly TextRef[], date: LocalDate, exclude: string | null): string | null {
  const fetched = new Set(texts.map((q) => q.id));
  const available = ids.filter((id) => fetched.has(id));
  const pool = available.length > 1 && exclude ? available.filter((id) => id !== exclude) : available;
  return hopeTextId(pool, date);
}
