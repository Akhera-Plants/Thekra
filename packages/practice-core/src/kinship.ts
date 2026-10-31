/**
 * صلة الرحم, local-first. A relative is a nickname («خالتي») and a rhythm; never a phone number, email or
 * address (docs/plan/silat-rahim-plan.md §4, §5.9). Due dates follow the same rule as that plan's
 * `computeNextDueOn` (§4.3): a contact restarts the cycle; a relative never contacted is due now.
 *
 * Sync (Store v2): `updatedAt` versions the relative's own fields (name, relation, rule). Contacts sync on their
 * own as (relative, date) pairs, so `logContact` / `undoLastContact` do not touch `updatedAt`. In a store, undo a
 * contact through `undoContact` / `updateRelative` (storage.ts) so the removal is kept as a tombstone.
 */
import { addDays, diffDays, isIsoTime, isValidDate, nowIso, weekday, type IsoTime, type LocalDate } from './dates.js';
import { firstWeekdayOnOrAfter, validateRule, type Rule } from './rules.js';

export type KinshipRule = Extract<Rule, { kind: 'everyNDays' | 'everyNWeeks' | 'weekdays' }>;

/**
 * Which people list («أعمال دورية» with people) a person belongs to: صلة الرحم (`kin`), برّ الوالدين (`parents`),
 * تفقّد الجيران (`neighbors`), تفقّد صديق (`friends`), عيادة المريض (`sick`, on demand: added while sick, due every
 * two days until visited once, then no longer due). Each list counts as one periodic act.
 */
export type PeopleCircle = 'kin' | 'parents' | 'neighbors' | 'friends' | 'sick';
export const PEOPLE_CIRCLES: readonly PeopleCircle[] = ['kin', 'parents', 'neighbors', 'friends', 'sick'];
/** A sick person is reminded every this many days until visited. */
export const SICK_VISIT_EVERY_DAYS = 2;

export interface Relative {
  id: string;
  /** Nickname only. Max {@link MAX_NAME_LENGTH} characters; contact details are rejected. */
  name: string;
  /** Free label, e.g. 'aunt', 'خالة'. */
  relation: string;
  rule: KinshipRule;
  /** The people list; absent means `kin` (every relative before 2026-10-31). */
  circle?: PeopleCircle;
  lastContactedOn?: LocalDate;
  /** Logged contact dates in the order they were logged (no duplicates). */
  history: LocalDate[];
  /** ISO time of the last local edit of name, relation or rule. Set by the helpers; v1 data gets it on upgrade. */
  updatedAt?: IsoTime;
}

export const MAX_NAME_LENGTH = 60;
const KINSHIP_KINDS = new Set(['everyNDays', 'everyNWeeks', 'weekdays']);

const DIGIT = '0-9٠-٩۰-۹';
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_RE = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/)/i;
const DIGIT_RUN_RE = new RegExp(`[${DIGIT}][${DIGIT}\\s\\-().+/]*[${DIGIT}]`, 'g');
const DIGIT_CHAR_RE = new RegExp(`[${DIGIT}]`, 'g');

/**
 * True when `text` looks like a phone number (a run of ≥ 7 digits, Latin, Arabic-Indic or Persian, ignoring
 * spaces, dashes, dots, slashes and parentheses), an email address or a link. A guard-rail, not a guarantee.
 */
export function looksLikeContactDetails(text: string): boolean {
  if (EMAIL_RE.test(text) || URL_RE.test(text)) return true;
  for (const run of text.match(DIGIT_RUN_RE) ?? []) {
    if ((run.match(DIGIT_CHAR_RE)?.length ?? 0) >= 7) return true;
  }
  return false;
}

/** Returns an English error message, or `null` when well-formed. Accepts any input. */
export function validateRelative(rel: unknown): string | null {
  if (typeof rel !== 'object' || rel === null) return 'relative must be an object';
  const r = rel as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return 'id must be a non-empty string';
  if (typeof r.name !== 'string' || r.name.trim().length === 0 || r.name.length > MAX_NAME_LENGTH) {
    return `name must be 1–${MAX_NAME_LENGTH} characters`;
  }
  if (looksLikeContactDetails(r.name)) return 'name must not contain contact details';
  if (typeof r.relation !== 'string') return 'relation must be a string';
  if (looksLikeContactDetails(r.relation)) return 'relation must not contain contact details';
  const rule = r.rule as { kind?: unknown } | null;
  if (typeof rule !== 'object' || rule === null || !KINSHIP_KINDS.has(rule.kind as string)) {
    return 'rule must be everyNDays, everyNWeeks or weekdays';
  }
  const ruleErr = validateRule(rule);
  if (ruleErr) return ruleErr;
  if (r.circle !== undefined && !PEOPLE_CIRCLES.includes(r.circle as PeopleCircle)) {
    return `circle must be one of ${PEOPLE_CIRCLES.join(', ')}`;
  }
  if (r.lastContactedOn !== undefined && !isValidDate(r.lastContactedOn)) return 'lastContactedOn must be YYYY-MM-DD';
  if (!Array.isArray(r.history) || !r.history.every(isValidDate)) return 'history must be an array of YYYY-MM-DD';
  if (r.updatedAt !== undefined && !isIsoTime(r.updatedAt)) return 'updatedAt must be an ISO time';
  return null;
}

export interface NewRelative {
  id: string;
  name: string;
  relation: string;
  rule: KinshipRule;
  /** Default `kin`. */
  circle?: PeopleCircle;
}

/** A new relative with no contacts. Throws when invalid (including contact details in the name). */
export function createRelative(input: NewRelative, now: IsoTime = nowIso()): Relative {
  const rel: Relative = {
    id: input.id,
    name: input.name.trim(),
    relation: input.relation,
    rule: input.rule,
    history: [],
    updatedAt: now,
  };
  if (input.circle !== undefined && input.circle !== 'kin') rel.circle = input.circle;
  const err = validateRelative(rel);
  if (err) throw new RangeError(`Invalid relative: ${err}`);
  return rel;
}

/** The person's list (`kin` when absent). */
export function circleOf(rel: Pick<Relative, 'circle'>): PeopleCircle {
  return rel.circle ?? 'kin';
}

/**
 * False for a sick person already visited: «عيادة المريض» is on demand, so after the visit the person is no longer
 * due (the user removes them, or adds them again when sick again). Everyone else is always open.
 */
export function isRelativeOpen(rel: Relative): boolean {
  return !(circleOf(rel) === 'sick' && rel.history.length > 0);
}

/** The rule for a sick person added on `today`: due now, then every {@link SICK_VISIT_EVERY_DAYS} days. */
export function sickRule(today: LocalDate): KinshipRule {
  return { kind: 'everyNDays', n: SICK_VISIT_EVERY_DAYS, anchor: today };
}

/** The latest date in a list (`undefined` when empty). */
export function latestDate(dates: readonly LocalDate[]): LocalDate | undefined {
  let best: LocalDate | undefined;
  for (const d of dates) if (best === undefined || d > best) best = d;
  return best;
}

/**
 * Next due date.
 * - Never contacted: due now (`today`, or the rule's next weekday on or after today).
 * - everyNDays: last contact + n.
 * - everyNWeeks: last contact + 7n, moved forward to the rule's weekday.
 * - weekdays: the first listed weekday strictly after the last contact.
 */
export function nextDue(rel: Relative, today: LocalDate): LocalDate {
  const last = rel.lastContactedOn;
  const rule = rel.rule;
  switch (rule.kind) {
    case 'everyNDays':
      return last ? addDays(last, rule.n) : today;
    case 'everyNWeeks':
      return firstWeekdayOnOrAfter(last ? addDays(last, 7 * rule.n) : today, rule.weekday);
    case 'weekdays': {
      const start = last ? addDays(last, 1) : today;
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        if (rule.days.includes(weekday(d))) return d;
      }
      return start; // unreachable for a valid rule
    }
  }
}

export interface DueEntry {
  relative: Relative;
  nextDue: LocalDate;
  /** Negative when overdue. */
  daysUntilDue: number;
}

export interface DueList {
  overdue: DueEntry[];
  /** Due from today through today + 6. */
  thisWeek: DueEntry[];
  later: DueEntry[];
}

/** Buckets relatives by next due date (a visited sick person is left out); each bucket is sorted by due date, then name. */
export function dueList(relatives: readonly Relative[], today: LocalDate): DueList {
  if (!isValidDate(today)) throw new RangeError('Invalid today');
  const out: DueList = { overdue: [], thisWeek: [], later: [] };
  for (const relative of relatives) {
    if (!isRelativeOpen(relative)) continue;
    const due = nextDue(relative, today);
    const entry: DueEntry = { relative, nextDue: due, daysUntilDue: diffDays(today, due) };
    if (entry.daysUntilDue < 0) out.overdue.push(entry);
    else if (entry.daysUntilDue <= 6) out.thisWeek.push(entry);
    else out.later.push(entry);
  }
  const byDue = (a: DueEntry, b: DueEntry) =>
    a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.relative.name.localeCompare(b.relative.name);
  out.overdue.sort(byDue);
  out.thisWeek.sort(byDue);
  out.later.sort(byDue);
  return out;
}

/**
 * «تواصلت معه». Appends the date to the history (a date already logged is not repeated) and sets
 * `lastContactedOn` to the latest logged date, so a backdated log never moves it backwards.
 */
export function logContact(rel: Relative, date: LocalDate): Relative {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  const history = rel.history.includes(date) ? [...rel.history] : [...rel.history, date];
  return { ...rel, history, lastContactedOn: latestDate(history) as LocalDate };
}

/**
 * Removes the most recently logged contact; `lastContactedOn` falls back to the latest remaining date.
 * On a relative inside a synced store, prefer `undoContact(store, relativeId)`, which also records a tombstone.
 */
export function undoLastContact(rel: Relative): Relative {
  if (rel.history.length === 0) return { ...rel, history: [] };
  const history = rel.history.slice(0, -1);
  const copy: Relative = { ...rel, history };
  const last = latestDate(history);
  if (last === undefined) delete copy.lastContactedOn;
  else copy.lastContactedOn = last;
  return copy;
}
