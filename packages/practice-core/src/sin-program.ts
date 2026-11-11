/**
 * «ترك المعصية»: a staged program for leaving a sin.
 *
 * NEVER IN CLEAR OFF THE DEVICE. Everything in a `SinProgram` (the sin slug, check-ins, free-text notes, «حلقة المعصية»
 * loops) leaves the device only sealed in the encrypted sin vault (`vault.ts`; owner decision 2026-11-01: always
 * encrypted and kept in the account, docs/plan/2026-11-01-sin-vault-always-on.md). Never send it in clear, never put it
 * in the practice sync body, analytics, logs or a notification/calendar title (roadmap §0.1–0.2). `exportForSync` in
 * `storage.ts` drops programs for this reason.
 *
 * Owner decision (2026-10-28, roadmap §4.1): a gradual path is allowed only for a sin against the right of Allah
 * when leaving at once is very hard for the user. A sin against people's rights is always 'cut' (leave it, or
 * lighten it with strong effort) and adds a 'restore_rights' stage (رد الحقوق والاستحلال).
 *
 * Wording rule: no streaks, no counters of falls, no failure words. A fall leads to the «خربانة؟ صلّحها» content.
 *
 * Phase 3 (2026-10-31): a check-in after «ضعفت» / «وقعت ثم تبت» may carry optional triggers (when / where / feeling,
 * chips only), a «حسنة الآن» mark and one small limit for the next day. They live on the check-in, so they travel
 * only inside the encrypted vault with the rest of the program and merge with it by date. Stored programs from before
 * simply have none ({@link sanitizeCheckIn} drops anything unknown instead of losing the check-in).
 */
import { diffDays, isIsoTime, isValidDate, isoMillis, nowIso, toDayNumber, fromDayNumber, type IsoTime, type LocalDate } from './dates.js';

export type SinCategory = 'haqq_allah' | 'haqq_ibad';
export type Path = 'cut' | 'gradual';
export type Stage = 'harms' | 'alternatives' | 'environment' | 'limits' | 'restore_rights' | 'leave';
export type CheckInValue = 'held' | 'weak' | 'fell_repented';

/** «متى؟»: the part of the day. */
export type TriggerTime = 'fajr_morning' | 'dhuhr_asr' | 'maghrib_isha' | 'after_isha' | 'late_night';
/** «أين؟» */
export type TriggerPlace = 'alone' | 'with_someone' | 'outside';
/** «بماذا شعرت؟» */
export type TriggerFeeling = 'boredom' | 'tiredness' | 'anger' | 'loneliness' | 'stress' | 'sadness';

export const TRIGGER_TIMES: readonly TriggerTime[] = ['fajr_morning', 'dhuhr_asr', 'maghrib_isha', 'after_isha', 'late_night'];
export const TRIGGER_PLACES: readonly TriggerPlace[] = ['alone', 'with_someone', 'outside'];
export const TRIGGER_FEELINGS: readonly TriggerFeeling[] = ['boredom', 'tiredness', 'anger', 'loneliness', 'stress', 'sadness'];

/** Optional chips after «ضعفت» / «وقعت ثم تبت». Every part is optional; an empty object is not stored. */
export interface Triggers {
  when?: TriggerTime;
  where?: TriggerPlace;
  feeling?: TriggerFeeling;
}

/**
 * Generic small limits, chosen by trigger when the program has none that fits (the client translates the key).
 * A program's own practical steps are referred to as `action:<index>` (index into the catalog's `actions`).
 */
export const GENERIC_LIMITS = [
  'phone_outside_room',
  'stay_near_people',
  'plan_before_going_out',
  'leave_gathering_early',
  'plan_free_time',
  'sleep_early',
  'wudu_when_angry',
  'call_someone_daily',
  'walk_with_dhikr',
] as const;
export type GenericLimit = (typeof GENERIC_LIMITS)[number];
/** A generic limit key or `action:<n>`. */
export type LimitRef = GenericLimit | `action:${number}`;

export function isLimitRef(value: unknown): value is LimitRef {
  if (typeof value !== 'string') return false;
  if ((GENERIC_LIMITS as readonly string[]).includes(value)) return true;
  return /^action:(0|[1-9][0-9]?)$/.test(value);
}

export interface CheckIn {
  date: LocalDate;
  value: CheckInValue;
  /** Free text kept on the device only. */
  note?: string;
  /** Only with 'weak' or 'fell_repented'. */
  triggers?: Triggers;
  /** «أتبع السيئة الحسنة»: a good deed marked right after the fall (when no matching habit was logged instead). */
  goodDeed?: true;
  /** «حدّ صغير لغد»: shown on the next day's page. */
  nextLimit?: LimitRef;
  /**
   * Round 6 (C-27): «ما الذي أعانك على تجنّبها؟» — the member's own short answer (≤ {@link CHECK_IN_ANSWER_MAX}). Like
   * the note, it lives only inside the encrypted vault.
   */
  helped?: string;
  /** Round 6 (C-27): «ما الذي صعّب عليك تركها؟» (≤ {@link CHECK_IN_ANSWER_MAX}), vault only. */
  hard?: string;
  /** When this check-in was last written. Merging two devices keeps the later one ({@link mergePrograms}). */
  updatedAt?: IsoTime;
}

export interface SinProgram {
  sinSlug: string;
  category: SinCategory;
  path: Path;
  startedOn: LocalDate;
  /** One entry per date, ascending. */
  checkIns: CheckIn[];
  /** When the program was started or ended. */
  updatedAt?: IsoTime;
  /**
   * «حلقة المعصية» (2026-11-01): the member's own loops for this sin. Removed loops stay as markers
   * ({@link SinLoop.removedAt}) so a merge does not bring them back. Absent when none. Only inside the vault.
   */
  loops?: SinLoop[];
  /**
   * Set by {@link endProgram}: the program is over and its check-ins and notes are gone. It stays in the list as a
   * marker, so the copy in the vault or on another device does not bring it back ({@link mergePrograms}).
   */
  endedAt?: IsoTime;
}

/**
 * «حلقة المعصية»: the member's answers to the sin-loop template. Free text, private: it travels only inside the
 * encrypted vault with the program.
 */
export interface SinLoop {
  /** Client id, unique within the program: 1–64 characters of `A–Z a–z 0–9 _ -`. */
  id: string;
  /** «المثير / الموقف»: what sets it off, the situation. */
  trigger: string;
  /** «الشعور»: what the member feels then. */
  feeling: string;
  /** «الرغبة»: what the soul asks for. */
  craving: string;
  /** «الفعل»: what the member then does. */
  act: string;
  /** «ما يحصل بعده»: what follows (the regret, the cost). */
  after: string;
  /** «البديل»: the alternative chosen for next time. */
  alternative: string;
  /** When this loop was last edited (ISO time). The later edit wins in {@link mergePrograms}. */
  updatedAt: IsoTime;
  /** Set when the loop was removed: its texts are empty and it is not shown ({@link activeSinLoops}). */
  removedAt?: IsoTime;
}

/** At most this many loops shown per program. */
export const MAX_SIN_LOOPS = 5;
/** Loops kept per program, removal markers included (the oldest markers are dropped first). */
export const MAX_SIN_LOOP_ENTRIES = 20;
/** Characters per answer. */
export const MAX_SIN_LOOP_TEXT = 300;
const SIN_LOOP_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const SIN_LOOP_FIELDS = ['trigger', 'feeling', 'craving', 'act', 'after', 'alternative'] as const;
export type SinLoopInput = Pick<SinLoop, (typeof SIN_LOOP_FIELDS)[number]>;

/** Returns an English error message for one loop, or `null`. A removed loop must have empty texts. */
export function validateSinLoop(loop: unknown): string | null {
  if (typeof loop !== 'object' || loop === null || Array.isArray(loop)) return 'loop must be an object';
  const l = loop as Record<string, unknown>;
  if (typeof l.id !== 'string' || !SIN_LOOP_ID.test(l.id)) return 'loop id must be 1–64 characters of A–Z a–z 0–9 _ -';
  for (const k of SIN_LOOP_FIELDS) {
    if (typeof l[k] !== 'string' || (l[k] as string).length > MAX_SIN_LOOP_TEXT) return `loop ${k} must be a string of at most ${MAX_SIN_LOOP_TEXT} characters`;
  }
  if (!isIsoTime(l.updatedAt)) return 'loop updatedAt must be an ISO time';
  if (l.removedAt !== undefined) {
    if (!isIsoTime(l.removedAt)) return 'loop removedAt must be an ISO time';
    if (SIN_LOOP_FIELDS.some((k) => l[k] !== '')) return 'a removed loop keeps no text';
  } else if (SIN_LOOP_FIELDS.every((k) => (l[k] as string).trim() === '')) {
    return 'a loop needs at least one answer';
  }
  return null;
}

/** Returns an English error message for a program's `loops`, or `null`. */
export function validateSinLoops(loops: unknown): string | null {
  if (!Array.isArray(loops)) return 'loops must be an array';
  if (loops.length > MAX_SIN_LOOP_ENTRIES) return `loops must hold at most ${MAX_SIN_LOOP_ENTRIES} entries`;
  const ids = new Set<string>();
  let live = 0;
  for (const loop of loops) {
    const e = validateSinLoop(loop);
    if (e) return e;
    const l = loop as SinLoop;
    if (ids.has(l.id)) return 'loop ids must be unique';
    ids.add(l.id);
    if (l.removedAt === undefined) live++;
  }
  if (live > MAX_SIN_LOOPS) return `at most ${MAX_SIN_LOOPS} loops`;
  return null;
}

/** A copy with known fields only, in a fixed order. */
export function cloneSinLoop(loop: SinLoop): SinLoop {
  const out: SinLoop = {
    id: loop.id,
    trigger: loop.trigger,
    feeling: loop.feeling,
    craving: loop.craving,
    act: loop.act,
    after: loop.after,
    alternative: loop.alternative,
    updatedAt: loop.updatedAt,
  };
  if (loop.removedAt !== undefined) out.removedAt = loop.removedAt;
  return out;
}

/** The loops to show (not removed), in their order. */
export function activeSinLoops(program: SinProgram): SinLoop[] {
  return (program.loops ?? []).filter((l) => l.removedAt === undefined);
}

/** Keeps the live loops and the newest removal markers, within {@link MAX_SIN_LOOP_ENTRIES}. */
function boundLoops(loops: SinLoop[]): SinLoop[] {
  const markers = loops.filter((l) => l.removedAt !== undefined);
  const room = MAX_SIN_LOOP_ENTRIES - (loops.length - markers.length);
  if (markers.length <= room) return loops;
  const keep = new Set(
    [...markers].sort((a, b) => isoMillis(b.removedAt) - isoMillis(a.removedAt)).slice(0, Math.max(0, room)).map((l) => l.id),
  );
  return loops.filter((l) => l.removedAt === undefined || keep.has(l.id));
}

function withSinLoops(program: SinProgram, loops: SinLoop[]): SinProgram {
  const bounded = boundLoops(loops);
  const err = validateSinLoops(bounded);
  if (err) throw new RangeError(err);
  const copy: SinProgram = { ...program };
  if (bounded.length > 0) copy.loops = bounded;
  else delete copy.loops;
  return copy;
}

const sinLoopText = (input: Partial<SinLoopInput>, base?: SinLoop): SinLoopInput => ({
  trigger: input.trigger ?? base?.trigger ?? '',
  feeling: input.feeling ?? base?.feeling ?? '',
  craving: input.craving ?? base?.craving ?? '',
  act: input.act ?? base?.act ?? '',
  after: input.after ?? base?.after ?? '',
  alternative: input.alternative ?? base?.alternative ?? '',
});

/** Adds a «حلقة المعصية». Throws on an ended program, a used id, more than {@link MAX_SIN_LOOPS} or an invalid loop. */
export function addSinLoop(program: SinProgram, id: string, input: Partial<SinLoopInput>, now: IsoTime = nowIso()): SinProgram {
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  if ((program.loops ?? []).some((l) => l.id === id)) throw new RangeError('A loop with this id exists');
  return withSinLoops(program, [...(program.loops ?? []), { id, ...sinLoopText(input), updatedAt: now }]);
}

/** Changes the given answers of one live loop. */
export function updateSinLoop(program: SinProgram, id: string, patch: Partial<SinLoopInput>, now: IsoTime = nowIso()): SinProgram {
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  const base = (program.loops ?? []).find((l) => l.id === id && l.removedAt === undefined);
  if (!base) throw new RangeError('No loop with this id');
  return withSinLoops(program, (program.loops ?? []).map((l) => (l.id === id ? { id, ...sinLoopText(patch, base), updatedAt: now } : l)));
}

/** Removes one loop: its texts are dropped and a marker stays, so another device's copy does not bring it back. */
export function removeSinLoop(program: SinProgram, id: string, now: IsoTime = nowIso()): SinProgram {
  const loops = program.loops ?? [];
  if (!loops.some((l) => l.id === id && l.removedAt === undefined)) return program;
  const blank = { trigger: '', feeling: '', craving: '', act: '', after: '', alternative: '' };
  return withSinLoops(program, loops.map((l) => (l.id === id ? { id, ...blank, updatedAt: now, removedAt: now } : l)));
}

/** Loops of two copies united by id; the later `updatedAt` wins (a tie keeps `mine`). Order: mine, then theirs only. */
function mergeSinLoops(mine: readonly SinLoop[], theirs: readonly SinLoop[]): SinLoop[] {
  const byId = new Map(mine.map((l) => [l.id, l]));
  for (const l of theirs) {
    const kept = byId.get(l.id);
    if (!kept || isoMillis(l.updatedAt) > isoMillis(kept.updatedAt)) byId.set(l.id, l);
  }
  const merged = [...byId.values()];
  // Two devices may each have added loops: keep the newest live ones within the limit.
  const live = merged.filter((l) => l.removedAt === undefined);
  if (live.length > MAX_SIN_LOOPS) {
    const keep = new Set([...live].sort((a, b) => isoMillis(b.updatedAt) - isoMillis(a.updatedAt)).slice(0, MAX_SIN_LOOPS).map((l) => l.id));
    return boundLoops(merged.filter((l) => l.removedAt !== undefined || keep.has(l.id)));
  }
  return boundLoops(merged);
}

const STAGES_ALLAH: readonly Stage[] = ['harms', 'alternatives', 'environment', 'limits', 'leave'];
const STAGES_IBAD: readonly Stage[] = ['harms', 'alternatives', 'environment', 'limits', 'restore_rights', 'leave'];
export const CHECK_IN_VALUES: readonly CheckInValue[] = ['held', 'weak', 'fell_repented'];
/** Minimum days in a stage. */
export const STAGE_MIN_DAYS = 7;
/** Check-ins needed in the stage's last 7 days to move on. */
export const STAGE_MIN_CHECKINS = 4;

/** The ordered stages for a category. */
export function stagesFor(category: SinCategory): readonly Stage[] {
  return category === 'haqq_ibad' ? STAGES_IBAD : STAGES_ALLAH;
}

/** 'gradual' only for haqq_allah when leaving at once is very hard; otherwise 'cut'. */
export function pathFor(category: SinCategory, hardToLeaveAtOnce: boolean): Path {
  return category === 'haqq_allah' && hardToLeaveAtOnce ? 'gradual' : 'cut';
}

export interface StartProgramInput {
  sinSlug: string;
  category: SinCategory;
  hardToLeaveAtOnce: boolean;
  startedOn: LocalDate;
}

export function startProgram(input: StartProgramInput, now: IsoTime = nowIso()): SinProgram {
  if (!input.sinSlug) throw new RangeError('sinSlug is required');
  if (input.category !== 'haqq_allah' && input.category !== 'haqq_ibad') throw new RangeError('Invalid category');
  if (!isValidDate(input.startedOn)) throw new RangeError('Invalid startedOn');
  return {
    sinSlug: input.sinSlug,
    category: input.category,
    path: pathFor(input.category, input.hardToLeaveAtOnce),
    startedOn: input.startedOn,
    checkIns: [],
    updatedAt: now,
  };
}

/** Ends one program: its check-ins and notes are dropped, and only an end marker is kept ({@link SinProgram.endedAt}). */
export function endProgram(program: SinProgram, now: IsoTime = nowIso()): SinProgram {
  return { sinSlug: program.sinSlug, category: program.category, path: program.path, startedOn: program.startedOn, checkIns: [], updatedAt: now, endedAt: now };
}

/** A program the user is following (not ended). */
export function isActiveProgram(program: SinProgram): boolean {
  return program.endedAt === undefined;
}

/** The programs the user is following, without end markers. */
export function activePrograms(programs: readonly SinProgram[]): SinProgram[] {
  return programs.filter(isActiveProgram);
}

const byDate = (a: CheckIn, b: CheckIn) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * Merges this device's programs with another copy (the vault), one program per sin; the same result on every device
 * that holds both copies. For a sin in both copies:
 * - an end wins over a copy last started before it, so an ended program does not come back; a program started
 *   again after the end wins over the end;
 * - otherwise check-ins are united by date, and on the same date the later written one wins (`updatedAt`, absent
 *   counts as the oldest; a tie keeps this device's), with its note. «حلقة المعصية» loops are united by id the same
 *   way (a removal is a marker with its own `updatedAt`, so it wins over an older edit). The program's own fields come from the copy
 *   started later (a tie keeps this device's).
 * The order is this device's, then programs only in the other copy.
 */
export function mergePrograms(local: readonly SinProgram[], remote: readonly SinProgram[]): SinProgram[] {
  const remoteBySlug = new Map(remote.map((p) => [p.sinSlug, p]));
  const merged = local.map((mine) => {
    const theirs = remoteBySlug.get(mine.sinSlug);
    return theirs ? mergeProgram(mine, theirs) : mine;
  });
  const localSlugs = new Set(local.map((p) => p.sinSlug));
  return [...merged, ...remote.filter((p) => !localSlugs.has(p.sinSlug))];
}

function mergeProgram(mine: SinProgram, theirs: SinProgram): SinProgram {
  const started = (p: SinProgram) => isoMillis(p.updatedAt);
  if (mine.endedAt !== undefined || theirs.endedAt !== undefined) {
    if (mine.endedAt !== undefined && theirs.endedAt !== undefined) return started(theirs) > started(mine) ? theirs : mine;
    const [ended, live] = mine.endedAt !== undefined ? [mine, theirs] : [theirs, mine];
    return started(live) > isoMillis(ended.endedAt) ? live : ended;
  }
  const dates = new Map<string, CheckIn>(mine.checkIns.map((c) => [c.date, c]));
  for (const c of theirs.checkIns) {
    const kept = dates.get(c.date);
    if (!kept || isoMillis(c.updatedAt) > isoMillis(kept.updatedAt)) dates.set(c.date, c);
  }
  const fields = started(theirs) > started(mine) ? theirs : mine;
  const out: SinProgram = { ...fields, checkIns: [...dates.values()].sort(byDate) };
  const loops = mergeSinLoops(mine.loops ?? [], theirs.loops ?? []);
  if (loops.length > 0) out.loops = loops;
  else delete out.loops;
  return out;
}

/** Returns an English error message, or `null` when well-formed (including the haqq_ibad ⇒ cut rule). */
export function validateProgram(program: unknown): string | null {
  if (typeof program !== 'object' || program === null) return 'program must be an object';
  const p = program as Record<string, unknown>;
  if (typeof p.sinSlug !== 'string' || p.sinSlug.length === 0) return 'sinSlug must be a non-empty string';
  if (p.category !== 'haqq_allah' && p.category !== 'haqq_ibad') return 'category must be haqq_allah|haqq_ibad';
  if (p.path !== 'cut' && p.path !== 'gradual') return 'path must be cut|gradual';
  if (p.category === 'haqq_ibad' && p.path === 'gradual') return 'haqq_ibad programs cannot be gradual';
  if (!isValidDate(p.startedOn)) return 'startedOn must be YYYY-MM-DD';
  if (!Array.isArray(p.checkIns)) return 'checkIns must be an array';
  if (p.updatedAt !== undefined && !isIsoTime(p.updatedAt)) return 'updatedAt must be an ISO time';
  if (p.endedAt !== undefined && !isIsoTime(p.endedAt)) return 'endedAt must be an ISO time';
  if (p.loops !== undefined) {
    const e = validateSinLoops(p.loops);
    if (e) return e;
  }
  for (const c of p.checkIns as unknown[]) {
    const e = validateCheckIn(c);
    if (e) return e;
  }
  return null;
}

/** Returns an English error message for one check-in, or `null`. */
export function validateCheckIn(c: unknown): string | null {
  if (typeof c !== 'object' || c === null) return 'check-in must be an object';
  const r = c as Record<string, unknown>;
  if (!isValidDate(r.date)) return 'check-in date must be YYYY-MM-DD';
  if (!CHECK_IN_VALUES.includes(r.value as CheckInValue)) return 'check-in value must be held|weak|fell_repented';
  if (r.note !== undefined && typeof r.note !== 'string') return 'check-in note must be a string';
  if (r.updatedAt !== undefined && !isIsoTime(r.updatedAt)) return 'check-in updatedAt must be an ISO time';
  if (r.triggers !== undefined) {
    const e = validateTriggers(r.triggers);
    if (e) return e;
    if (r.value === 'held') return 'triggers only follow weak|fell_repented';
  }
  if (r.goodDeed !== undefined && r.goodDeed !== true) return 'check-in goodDeed must be true when present';
  if (r.nextLimit !== undefined && !isLimitRef(r.nextLimit)) return 'check-in nextLimit must be a limit key or action:<n>';
  for (const k of ['helped', 'hard'] as const) {
    if (r[k] !== undefined && (typeof r[k] !== 'string' || (r[k] as string).length > CHECK_IN_ANSWER_MAX)) {
      return `check-in ${k} must be a string of at most ${CHECK_IN_ANSWER_MAX} characters`;
    }
  }
  return null;
}

/** Characters of a check-in's «ما الذي أعانك / صعّب» answer (round 6). */
export const CHECK_IN_ANSWER_MAX = 300;

/** Returns an English error message for the trigger chips, or `null`. */
export function validateTriggers(t: unknown): string | null {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return 'triggers must be an object';
  const r = t as Record<string, unknown>;
  for (const key of Object.keys(r)) if (key !== 'when' && key !== 'where' && key !== 'feeling') return `unknown trigger ${key}`;
  if (r.when !== undefined && !TRIGGER_TIMES.includes(r.when as TriggerTime)) return 'trigger when is not known';
  if (r.where !== undefined && !TRIGGER_PLACES.includes(r.where as TriggerPlace)) return 'trigger where is not known';
  if (r.feeling !== undefined && !TRIGGER_FEELINGS.includes(r.feeling as TriggerFeeling)) return 'trigger feeling is not known';
  return null;
}

/** True when at least one chip is chosen. */
export function hasTriggers(t: Triggers | undefined): t is Triggers {
  return t !== undefined && (t.when !== undefined || t.where !== undefined || t.feeling !== undefined);
}

/**
 * Stored-data migration for one check-in: keeps the known, valid parts and drops the rest (an unknown chip, a
 * trigger on a 'held' day, a bad limit), so an older or damaged copy never loses the day itself. Missing = none.
 * Returns the input unchanged when it is not a check-in-shaped object (the validator then rejects it).
 */
export function sanitizeCheckIn(c: unknown): unknown {
  if (typeof c !== 'object' || c === null) return c;
  const r = { ...(c as Record<string, unknown>) };
  if (r.triggers !== undefined) {
    const t = r.triggers;
    const kept: Triggers = {};
    if (typeof t === 'object' && t !== null && r.value !== 'held') {
      const tr = t as Record<string, unknown>;
      if (TRIGGER_TIMES.includes(tr.when as TriggerTime)) kept.when = tr.when as TriggerTime;
      if (TRIGGER_PLACES.includes(tr.where as TriggerPlace)) kept.where = tr.where as TriggerPlace;
      if (TRIGGER_FEELINGS.includes(tr.feeling as TriggerFeeling)) kept.feeling = tr.feeling as TriggerFeeling;
    }
    if (hasTriggers(kept)) r.triggers = kept;
    else delete r.triggers;
  }
  if (r.goodDeed !== undefined && r.goodDeed !== true) delete r.goodDeed;
  if (r.nextLimit !== undefined && !isLimitRef(r.nextLimit)) delete r.nextLimit;
  for (const k of ['helped', 'hard'] as const) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'string' || (r[k] as string).trim().length === 0) delete r[k];
    else r[k] = (r[k] as string).slice(0, CHECK_IN_ANSWER_MAX);
  }
  return r;
}

/**
 * Records the day's check-in. One per date: a second check-in the same day replaces the value; its note
 * replaces the earlier note when given, otherwise the earlier note is kept.
 */
export function checkIn(
  program: SinProgram,
  date: LocalDate,
  value: CheckInValue,
  note?: string,
  now: IsoTime = nowIso(),
): SinProgram {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  if (!CHECK_IN_VALUES.includes(value)) throw new RangeError('Invalid check-in value');
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  const previous = program.checkIns.find((c) => c.date === date);
  const entry: CheckIn = { date, value };
  const keptNote = note ?? previous?.note;
  if (keptNote !== undefined) entry.note = keptNote;
  // The chips describe a weak day or a fall: a day changed to «ثبتّ» drops them (and the limit that came with a fall).
  if (value !== 'held' && previous?.triggers) entry.triggers = { ...previous.triggers };
  if (value !== 'held' && previous?.nextLimit) entry.nextLimit = previous.nextLimit;
  if (previous?.goodDeed) entry.goodDeed = true;
  if (previous?.helped !== undefined) entry.helped = previous.helped;
  if (previous?.hard !== undefined) entry.hard = previous.hard;
  entry.updatedAt = now;
  const checkIns = program.checkIns.filter((c) => c.date !== date).concat(entry);
  checkIns.sort(byDate);
  return { ...program, checkIns };
}

/** What {@link annotateCheckIn} may change. `null` clears a part. */
export interface CheckInDetails {
  triggers?: Triggers | null;
  goodDeed?: boolean;
  nextLimit?: LimitRef | null;
  /** Round 6: «ما الذي أعانك على تجنّبها؟»; `null` or empty clears it. */
  helped?: string | null;
  /** Round 6: «ما الذي صعّب عليك تركها؟»; `null` or empty clears it. */
  hard?: string | null;
}

/**
 * Adds or changes the optional details of the day's check-in (it must exist). Triggers are kept only on a weak day
 * or a fall; an empty set of chips clears them.
 */
export function annotateCheckIn(program: SinProgram, date: LocalDate, details: CheckInDetails, now: IsoTime = nowIso()): SinProgram {
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  const previous = program.checkIns.find((c) => c.date === date);
  if (!previous) throw new RangeError('No check-in on this date');
  const entry: CheckIn = { ...previous };
  if (details.triggers !== undefined) {
    if (details.triggers === null || !hasTriggers(details.triggers)) delete entry.triggers;
    else {
      const e = validateTriggers(details.triggers);
      if (e) throw new RangeError(e);
      if (previous.value === 'held') throw new RangeError('Triggers only follow a weak day or a fall');
      const t: Triggers = {};
      if (details.triggers.when) t.when = details.triggers.when;
      if (details.triggers.where) t.where = details.triggers.where;
      if (details.triggers.feeling) t.feeling = details.triggers.feeling;
      entry.triggers = t;
    }
  }
  if (details.goodDeed !== undefined) {
    if (details.goodDeed) entry.goodDeed = true;
    else delete entry.goodDeed;
  }
  if (details.nextLimit !== undefined) {
    if (details.nextLimit === null) delete entry.nextLimit;
    else if (!isLimitRef(details.nextLimit)) throw new RangeError('Invalid limit');
    else entry.nextLimit = details.nextLimit;
  }
  for (const k of ['helped', 'hard'] as const) {
    const v = details[k];
    if (v === undefined) continue;
    const text = typeof v === 'string' ? v.trim().slice(0, CHECK_IN_ANSWER_MAX).trim() : '';
    if (text.length === 0) delete entry[k];
    else entry[k] = text;
  }
  entry.updatedAt = now;
  return { ...program, checkIns: program.checkIns.map((c) => (c.date === date ? entry : c)) };
}

export interface StageInfo {
  stage: Stage;
  /** 0-based position in {@link stagesFor}. */
  index: number;
  /** First day of the current stage. */
  since: LocalDate;
}

/**
 * The stage on `today`. A stage lasts at least 7 days; on any later day it advances when the 7 days before
 * that day hold ≥ 4 check-ins (any value counts: the program rewards showing up, not perfection). Otherwise
 * the user stays, with no penalty. The last stage ('leave') is kept.
 */
export function currentStage(program: SinProgram, today: LocalDate): StageInfo {
  const stages = stagesFor(program.category);
  const days = new Set(program.checkIns.map((c) => toDayNumber(c.date)));
  const end = toDayNumber(today);
  let index = 0;
  let start = toDayNumber(program.startedOn);
  let d = start + STAGE_MIN_DAYS;
  while (index < stages.length - 1 && d <= end) {
    let count = 0;
    for (let n = d - STAGE_MIN_DAYS; n < d; n++) if (days.has(n)) count++;
    if (count >= STAGE_MIN_CHECKINS) {
      index++;
      start = d;
      d = start + STAGE_MIN_DAYS;
    } else {
      d++;
    }
  }
  return { stage: stages[index] as Stage, index, since: fromDayNumber(start) };
}

export interface ProgramSummary {
  held: number;
  weak: number;
  fell_repented: number;
  /** Days with any check-in. */
  daysCheckedIn: number;
  /** Days in the range (inclusive). */
  days: number;
}

/** Counts per value between `from` and `to` (inclusive). Deliberately no streaks. */
export function summary(program: SinProgram, from: LocalDate, to: LocalDate): ProgramSummary {
  const out: ProgramSummary = { held: 0, weak: 0, fell_repented: 0, daysCheckedIn: 0, days: Math.max(0, diffDays(from, to) + 1) };
  for (const c of program.checkIns) {
    if (c.date >= from && c.date <= to) {
      out[c.value]++;
      out.daysCheckedIn++;
    }
  }
  return out;
}

/** The content key the app shows after «وقعت ثم تبت»: the «خربانة؟ صلّحها» guidance. */
export function afterFall(_program: SinProgram): 'fixit' {
  return 'fixit';
}


/** A program entry as the catalog sends it (backend sin-programs.yaml, one per sin with a written program). */
export interface SinProgramEntryShape {
  sin: string;
  category: SinCategory;
  gradualAllowed: boolean;
  help: boolean;
  gradualStepsAr?: string[];
  gradualStepsEn?: string[];
  actionsAr: string[];
  actionsEn: string[];
  alternatives: string[];
  evidence: string[];
}

/**
 * «تخفَّف من ذنب» for a sin without a written program (owner, 2026-11-01): the common five stages only. The category
 * comes from the visitor («هل فيها حقٌّ لأحد من الناس؟»); the path is always «cut» (no gradual steps were written, and a
 * right of others is never gradual). The stage texts are the common ones; «ما ورد فيها» is the sin's own page.
 * Pending the sheikh's review, like the written programs.
 */
export function genericProgramEntry(sin: string, category: SinCategory): SinProgramEntryShape {
  return { sin, category, gradualAllowed: false, help: false, actionsAr: [], actionsEn: [], alternatives: [], evidence: [] };
}

/** The written program for `sin`, else the common one when the category is known, else null (ask for it first). */
export function programEntryFor<E extends SinProgramEntryShape>(
  entries: readonly E[],
  sin: string,
  category: SinCategory | null,
): E | SinProgramEntryShape | null {
  return entries.find((entry) => entry.sin === sin) ?? (category ? genericProgramEntry(sin, category) : null);
}
