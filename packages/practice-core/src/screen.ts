/**
 * Screens beyond the app (redesign §4.6): «تذكيراتي» (the user's own short lines, device-local on every client), the
 * daily text of the home-screen widget and of the extension's new-tab page, and «مواسم الخير» (today and the next
 * occasion). Shared by the app, the website and the extension so each picks the same text on the same day.
 *
 * Pure; nothing here touches storage or the network.
 */
import { addDays, toDayNumber, type LocalDate } from './dates.js';
import type { AgendaOccasion } from './agenda.js';
import { occurrences } from './rules.js';

// ── تذكيراتي ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Characters per line at most. */
export const MY_REMINDER_MAX_LENGTH = 120;
/** Lines at most. */
export const MY_REMINDERS_MAX = 20;

export interface MyReminder {
  /** Client id (random). */
  id: string;
  text: string;
  /** ISO time it was written. */
  createdAt: string;
}

/** Collapses whitespace and trims; the caller rejects an empty or too-long result. */
export function cleanReminderText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export type MyReminderError = 'empty' | 'tooLong' | 'full' | 'duplicate';

/** Why a new line cannot be added, or `null`. */
export function myReminderError(list: readonly MyReminder[], text: string): MyReminderError | null {
  const clean = cleanReminderText(text);
  if (clean.length === 0) return 'empty';
  if ([...clean].length > MY_REMINDER_MAX_LENGTH) return 'tooLong';
  if (list.length >= MY_REMINDERS_MAX) return 'full';
  if (list.some((r) => r.text === clean)) return 'duplicate';
  return null;
}

/** The list with the line added at the end. Throws a RangeError with the {@link MyReminderError} code when it cannot. */
export function addMyReminder(list: readonly MyReminder[], text: string, id: string, createdAt: string): MyReminder[] {
  const err = myReminderError(list, text);
  if (err) throw new RangeError(err);
  return [...list, { id, text: cleanReminderText(text), createdAt }];
}

export function removeMyReminder(list: readonly MyReminder[], id: string): MyReminder[] {
  return list.filter((r) => r.id !== id);
}

/** Never throws: drops malformed, empty, too-long and duplicate lines, keeps at most {@link MY_REMINDERS_MAX}. */
export function parseMyReminders(raw: unknown): MyReminder[] {
  if (!Array.isArray(raw)) return [];
  const out: MyReminder[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id.length === 0 || typeof r.text !== 'string') continue;
    const text = cleanReminderText(r.text);
    if (text.length === 0 || [...text].length > MY_REMINDER_MAX_LENGTH || out.some((o) => o.text === text || o.id === r.id)) continue;
    out.push({ id: r.id, text, createdAt: typeof r.createdAt === 'string' ? r.createdAt : '' });
    if (out.length >= MY_REMINDERS_MAX) break;
  }
  return out;
}

// ── Daily text ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The same item all day, the next one tomorrow (by local day number). */
export function dailyPick<T>(items: readonly T[], date: LocalDate): T | undefined {
  if (items.length === 0) return undefined;
  const n = toDayNumber(date);
  return items[((n % items.length) + items.length) % items.length];
}

/**
 * Where «نص اليوم» comes from: a reminder set (by slug), the user's saved texts, «تذكيراتي», or «مواسم الخير». The
 * extension also offers a habit's evidence text. Sin-program content is never a source.
 */
export type TodayTextSource =
  | { kind: 'set'; slug: string }
  | { kind: 'saved' }
  | { kind: 'mine' }
  | { kind: 'seasons' }
  | { kind: 'habit'; habitKey: string };

export const DEFAULT_TODAY_TEXT_SOURCE: TodayTextSource = { kind: 'seasons' };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Never throws; anything unknown is {@link DEFAULT_TODAY_TEXT_SOURCE}. */
export function parseTodayTextSource(raw: unknown): TodayTextSource {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_TODAY_TEXT_SOURCE;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'set':
      return typeof r.slug === 'string' && SLUG.test(r.slug) && r.slug.length <= 80 ? { kind: 'set', slug: r.slug } : DEFAULT_TODAY_TEXT_SOURCE;
    case 'habit':
      return typeof r.habitKey === 'string' && SLUG.test(r.habitKey) && r.habitKey.length <= 80
        ? { kind: 'habit', habitKey: r.habitKey }
        : DEFAULT_TODAY_TEXT_SOURCE;
    case 'saved':
    case 'mine':
    case 'seasons':
      return { kind: r.kind };
    default:
      return DEFAULT_TODAY_TEXT_SOURCE;
  }
}

// ── مواسم الخير ─────────────────────────────────────────────────────────────────────────────────────────────────

/** How far ahead the next occasion is searched. */
export const NEXT_OCCASION_HORIZON = 400;

export interface OccasionOn {
  occasion: AgendaOccasion;
  date: LocalDate;
  /** Days from today (0 = today). */
  inDays: number;
}

/**
 * Today's occasions and the next one after today. A rule the runtime cannot evaluate (Hijri without Umm al-Qura) is
 * skipped: a wrong date is worse than none.
 */
export function seasonsOfGood(
  occasions: readonly AgendaOccasion[],
  today: LocalDate,
  opts: { hijriOffset?: number; horizon?: number } = {},
): { today: AgendaOccasion[]; next: OccasionOn | null } {
  const horizon = opts.horizon ?? NEXT_OCCASION_HORIZON;
  const end = addDays(today, horizon);
  const todays: AgendaOccasion[] = [];
  let next: OccasionOn | null = null;
  for (const o of occasions) {
    let dates: LocalDate[];
    try {
      dates = occurrences(o.rule, today, end, { hijriOffset: opts.hijriOffset ?? 0 });
    } catch {
      continue;
    }
    if (dates[0] === today) todays.push(o);
    const after = dates.find((d) => d > today);
    if (after && (!next || after < next.date)) next = { occasion: o, date: after, inDays: toDayNumber(after) - toDayNumber(today) };
  }
  return { today: todays, next };
}
