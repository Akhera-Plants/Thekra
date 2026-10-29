/**
 * «نيّتي اليوم» (a morning intention on one of the day's habits) and «محاسبة المساء» (three short evening questions
 * and «الحمد لله على ما كان»): the user's private notebook, shared by the website and the app
 * (docs/plan/2026-10-tazkiya-tracker-proposals.md items 5 and 7).
 *
 * Private and local only, like the sin program (roadmap §0.1): the journal lives in its own device key, is never
 * part of the Store, never synced, never in a notification. `parseJournal` is defensive: it never throws, drops
 * entries that fail validation and copies only known fields. The prompts' wording comes from the practice catalog
 * (`tazkiya` of `GET /v1/practice/catalog`); this module holds only the shape and the rules.
 */
import { isIsoTime, isValidDate, isValidTime, nowIso, timeToMinutes, type IsoTime, type LocalDate, type LocalTime } from './dates.js';

export const JOURNAL_VERSION = 1;
/** The optional line of intention. */
export const NIYYAH_NOTE_MAX = 140;
/** One evening answer. */
export const MUHASABA_ANSWER_MAX = 500;
/** A habit title kept with the intention, so the notebook still reads after the plan is gone. */
const TITLE_MAX = 120;
/** Dismissed prompt keys kept (the oldest drop out; they only matter for a few days). */
export const DISMISSED_MAX = 60;

/** The morning card shows from this time until {@link NIYYAH_UNTIL} (or until an intention is set). */
export const NIYYAH_FROM: LocalTime = '04:00';
export const NIYYAH_UNTIL: LocalTime = '12:00';
/** The evening card shows from this local time when no Maghrib time is known. */
export const MUHASABA_FROM: LocalTime = '18:00';

/** The three evening questions, in order. Their wording is catalog content. */
export const MUHASABA_QUESTIONS = ['helped', 'away', 'tomorrow'] as const;
export type MuhasabaQuestion = (typeof MUHASABA_QUESTIONS)[number];

export interface Niyyah {
  /** The plan chosen among the day's habits. */
  planId: string;
  /** The habit's title as shown when it was chosen. */
  title: string;
  note?: string;
  at: IsoTime;
}

export interface Muhasaba {
  answers: Partial<Record<MuhasabaQuestion, string>>;
  /** «الحمد لله على ما كان» was tapped. */
  thanked: boolean;
  at: IsoTime;
}

export interface JournalDay {
  date: LocalDate;
  niyyah?: Niyyah;
  muhasaba?: Muhasaba;
}

export interface TazkiyaJournal {
  v: typeof JOURNAL_VERSION;
  /** At most one entry per date, newest first. */
  days: JournalDay[];
  /** Prompts set aside with «ليس الآن» (see {@link promptKey} and fresh-start.ts `freshStartKey`). */
  dismissed: string[];
}

export function emptyJournal(): TazkiyaJournal {
  return { v: JOURNAL_VERSION, days: [], dismissed: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Trims a typed line; null when empty or longer than `max`. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

/** Why a new intention is not valid, or null. */
export function validateNiyyah(input: { planId: unknown; title: unknown; note?: unknown }): string | null {
  if (typeof input.planId !== 'string' || input.planId.trim() === '') return 'planId is required';
  if (cleanText(input.title, TITLE_MAX) === null) return `title must be 1…${TITLE_MAX} characters`;
  if (input.note !== undefined && input.note !== '' && cleanText(input.note, NIYYAH_NOTE_MAX) === null) {
    return `note must be at most ${NIYYAH_NOTE_MAX} characters`;
  }
  return null;
}

/** Why an evening entry is not valid, or null. An entry needs at least one answer or the «الحمد لله» tap. */
export function validateMuhasaba(input: { answers: Partial<Record<string, unknown>>; thanked: unknown }): string | null {
  if (typeof input.thanked !== 'boolean') return 'thanked must be true or false';
  for (const [key, value] of Object.entries(input.answers)) {
    if (!(MUHASABA_QUESTIONS as readonly string[]).includes(key)) return `unknown question "${key}"`;
    if (typeof value !== 'string') return `${key} must be text`;
    if (value.trim().length > MUHASABA_ANSWER_MAX) return `${key} must be at most ${MUHASABA_ANSWER_MAX} characters`;
  }
  const answered = Object.values(input.answers).some((v) => typeof v === 'string' && v.trim() !== '');
  return answered || input.thanked ? null : 'an evening entry needs an answer or the thanks';
}

function parseNiyyah(raw: unknown): Niyyah | undefined {
  if (!isRecord(raw) || !isIsoTime(raw.at) || validateNiyyah({ planId: raw.planId, title: raw.title, note: raw.note }) !== null) {
    return undefined;
  }
  const note = cleanText(raw.note, NIYYAH_NOTE_MAX);
  return { planId: raw.planId as string, title: cleanText(raw.title, TITLE_MAX) as string, ...(note ? { note } : {}), at: raw.at };
}

function parseMuhasaba(raw: unknown): Muhasaba | undefined {
  if (!isRecord(raw) || !isIsoTime(raw.at) || !isRecord(raw.answers)) return undefined;
  if (validateMuhasaba({ answers: raw.answers, thanked: raw.thanked }) !== null) return undefined;
  return { answers: cleanAnswers(raw.answers as Partial<Record<MuhasabaQuestion, string>>), thanked: raw.thanked as boolean, at: raw.at };
}

function cleanAnswers(answers: Partial<Record<MuhasabaQuestion, string>>): Partial<Record<MuhasabaQuestion, string>> {
  const out: Partial<Record<MuhasabaQuestion, string>> = {};
  for (const key of MUHASABA_QUESTIONS) {
    const text = cleanText(answers[key], MUHASABA_ANSWER_MAX);
    if (text) out[key] = text;
  }
  return out;
}

function byDateDesc(a: JournalDay, b: JournalDay): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

/** Reads a stored journal (JSON text or a parsed value). Never throws; anything unreadable becomes empty. */
export function parseJournal(json: unknown): TazkiyaJournal {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      return emptyJournal();
    }
  }
  if (!isRecord(raw) || raw.v !== JOURNAL_VERSION) return emptyJournal();
  const seen = new Set<string>();
  const days: JournalDay[] = [];
  for (const item of Array.isArray(raw.days) ? raw.days : []) {
    if (!isRecord(item) || !isValidDate(item.date) || seen.has(item.date)) continue;
    const niyyah = parseNiyyah(item.niyyah);
    const muhasaba = parseMuhasaba(item.muhasaba);
    if (!niyyah && !muhasaba) continue;
    seen.add(item.date);
    days.push({ date: item.date, ...(niyyah ? { niyyah } : {}), ...(muhasaba ? { muhasaba } : {}) });
  }
  const dismissed = Array.isArray(raw.dismissed)
    ? raw.dismissed.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 80).slice(-DISMISSED_MAX)
    : [];
  return { v: JOURNAL_VERSION, days: days.sort(byDateDesc), dismissed };
}

export function serializeJournal(journal: TazkiyaJournal): string {
  return JSON.stringify(journal);
}

export function journalDay(journal: TazkiyaJournal, date: LocalDate): JournalDay | undefined {
  return journal.days.find((d) => d.date === date);
}

function withDay(journal: TazkiyaJournal, date: LocalDate, edit: (day: JournalDay) => JournalDay): TazkiyaJournal {
  const next = edit(journalDay(journal, date) ?? { date });
  const days = journal.days.filter((d) => d.date !== date);
  if (next.niyyah || next.muhasaba) days.push(next);
  return { ...journal, days: days.sort(byDateDesc) };
}

/** Sets (or replaces) the day's intention. Throws a RangeError on invalid input. */
export function setNiyyah(
  journal: TazkiyaJournal,
  date: LocalDate,
  input: { planId: string; title: string; note?: string },
  now: IsoTime = nowIso(),
): TazkiyaJournal {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  const error = validateNiyyah(input);
  if (error) throw new RangeError(error);
  const note = cleanText(input.note, NIYYAH_NOTE_MAX);
  const niyyah: Niyyah = { planId: input.planId, title: (cleanText(input.title, TITLE_MAX) as string), ...(note ? { note } : {}), at: now };
  return withDay(journal, date, (day) => ({ ...day, niyyah }));
}

/** Sets (or replaces) the day's evening entry. Throws a RangeError on invalid input. */
export function setMuhasaba(
  journal: TazkiyaJournal,
  date: LocalDate,
  input: { answers: Partial<Record<MuhasabaQuestion, string>>; thanked: boolean },
  now: IsoTime = nowIso(),
): TazkiyaJournal {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  const error = validateMuhasaba(input);
  if (error) throw new RangeError(error);
  const muhasaba: Muhasaba = { answers: cleanAnswers(input.answers), thanked: input.thanked, at: now };
  return withDay(journal, date, (day) => ({ ...day, muhasaba }));
}

/** Removes one day from the notebook (its intention and its evening entry). */
export function deleteDay(journal: TazkiyaJournal, date: LocalDate): TazkiyaJournal {
  return { ...journal, days: journal.days.filter((d) => d.date !== date) };
}

/** «دفتر المحاسبة»: every written day, newest first. */
export function notebook(journal: TazkiyaJournal): JournalDay[] {
  return [...journal.days].sort(byDateDesc);
}

/** The plan the user chose for `date`, if any (the quiet mark in the day list). */
export function intendedPlan(journal: TazkiyaJournal, date: LocalDate): string | null {
  return journalDay(journal, date)?.niyyah?.planId ?? null;
}

export type TazkiyaPrompt = 'niyyah' | 'muhasaba';

/** The key under which «ليس الآن» sets a prompt aside for one day. */
export function promptKey(prompt: TazkiyaPrompt, date: LocalDate): string {
  return `${prompt}:${date}`;
}

export function isDismissed(journal: TazkiyaJournal, key: string): boolean {
  return journal.dismissed.includes(key);
}

/** Sets a prompt or a fresh-start card aside. Only the last {@link DISMISSED_MAX} keys are kept. */
export function dismiss(journal: TazkiyaJournal, key: string): TazkiyaJournal {
  if (isDismissed(journal, key)) return journal;
  return { ...journal, dismissed: [...journal.dismissed, key].slice(-DISMISSED_MAX) };
}

export interface PromptContext {
  /** The local day and time now. */
  date: LocalDate;
  time: LocalTime;
  /** The day has at least one habit to choose for the intention. */
  hasHabitsToday: boolean;
  /** The user has started anything (a habit, a relative or a program): the evening card is for them. */
  started: boolean;
  /** Maghrib today when the device knows it; else {@link MUHASABA_FROM}. */
  eveningFrom?: LocalTime;
}

/**
 * Which private prompt the hub shows now: the intention in the morning (until noon, once set it is done), the
 * evening questions from Maghrib (or 18:00) to midnight. Nothing in between, nothing after «ليس الآن».
 */
export function duePrompt(journal: TazkiyaJournal, ctx: PromptContext): TazkiyaPrompt | null {
  if (!isValidDate(ctx.date) || !isValidTime(ctx.time)) return null;
  const minutes = timeToMinutes(ctx.time);
  const day = journalDay(journal, ctx.date);
  const evening = timeToMinutes(ctx.eveningFrom && isValidTime(ctx.eveningFrom) ? ctx.eveningFrom : MUHASABA_FROM);
  if (minutes >= evening) {
    if (!ctx.started || day?.muhasaba || isDismissed(journal, promptKey('muhasaba', ctx.date))) return null;
    return 'muhasaba';
  }
  if (minutes >= timeToMinutes(NIYYAH_FROM) && minutes < timeToMinutes(NIYYAH_UNTIL)) {
    if (!ctx.hasHabitsToday || day?.niyyah || isDismissed(journal, promptKey('niyyah', ctx.date))) return null;
    return 'niyyah';
  }
  return null;
}

/**
 * The supplication shown after a tick: the catalog's lines in turn, so the same words rarely repeat back to back.
 * Null without lines.
 */
export function celebrationLine<T>(lines: readonly T[], turn: number): T | null {
  if (lines.length === 0) return null;
  const index = ((Math.trunc(turn) % lines.length) + lines.length) % lines.length;
  return lines[index] ?? null;
}
