/**
 * The new-tab page (redesign §4.6), as plain data so it is tested in Node: the date (Gregorian; Hijri when chosen),
 * one text from the user's source (a reminder set, a chosen habit's evidence, or «تذكيراتي» of this browser), today's
 * habits with done marks and the streak (practice-core). The extension never holds sin programs, and no source can be
 * one. Turned off in the options, the page shows only the date (the override cannot be removed at runtime).
 */
import {
  actionable,
  currentStreak,
  dailyPick,
  dayAgenda,
  isHijriSupported,
  formatHijriAr,
  toHijri,
  type LocalDate,
  type Store,
} from '@thekra/practice-core';
import { habitTitle, type Habit } from './catalog.js';
import type { ReminderSetLite } from './cache.js';
import { quoteDisplay, type QuoteDisplay, type QuoteLite, type Translate } from './quotes.js';
import type { Prefs } from './state.js';

export interface NewTabModel {
  off: boolean;
  date: string;
  hijri: string | null;
  /** The day's text with its source line (empty for the user's own line), or null when the source has none. */
  text: QuoteDisplay | null;
  habits: { title: string; done: boolean }[];
  streak: number;
  hasPlans: boolean;
}

export interface NewTabInput {
  store: Store;
  prefs: Prefs;
  catalog: readonly Habit[];
  quotes: Readonly<Record<string, QuoteLite>>;
  sets: readonly ReminderSetLite[];
  today: LocalDate;
  /** For the Gregorian line (the browser's `Date` for `today`). */
  now: Date;
  t: Translate;
}

export function gregorianLine(now: Date, lang: 'ar' | 'en'): string {
  // Western digits in both languages (content rule 7).
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
}

function hijriLine(date: LocalDate, offset: number, lang: 'ar' | 'en'): string | null {
  if (!isHijriSupported()) return null;
  if (lang === 'ar') return formatHijriAr(date, offset);
  const hd = toHijri(date, offset);
  return `${hd.day}/${hd.month}/${hd.year} AH`;
}

function shownQuotes(items: readonly QuoteLite[], prefs: Prefs, t: Translate): QuoteDisplay[] {
  return items.map((q) => quoteDisplay(q, prefs.lang, t)).filter((d): d is QuoteDisplay => d !== null);
}

export function pickNewTabText(input: Pick<NewTabInput, 'prefs' | 'catalog' | 'quotes' | 'sets' | 'today' | 't'>): QuoteDisplay | null {
  const { prefs, today, t } = input;
  const source = prefs.newTabSource;
  if (source.kind === 'mine') {
    const line = dailyPick(prefs.myReminders, today);
    return line ? { text: line.text, source: '' } : null;
  }
  if (source.kind === 'set') {
    const set = input.sets.find((s) => s.slug === source.slug);
    return dailyPick(shownQuotes(set?.items ?? [], prefs, t), today) ?? null;
  }
  if (source.kind === 'habit') {
    const habit = input.catalog.find((h) => h.key === source.habitKey);
    const items = (habit?.evidence ?? []).map((id) => input.quotes[id.toLowerCase()]).filter((q): q is QuoteLite => q !== undefined);
    return dailyPick(shownQuotes(items, prefs, t), today) ?? null;
  }
  return null;
}

export function newTabModel(input: NewTabInput): NewTabModel {
  const { store, prefs, today } = input;
  const lang = prefs.lang;
  const date = gregorianLine(input.now, lang);
  const hijri = prefs.showHijri ? hijriLine(today, store.settings.hijriOffset, lang) : null;
  if (!prefs.newTab) return { off: true, date, hijri, text: null, habits: [], streak: 0, hasPlans: false };
  const defaultRuleOf = (plan: { habitKey?: string }) => input.catalog.find((h) => h.key === plan.habitKey)?.defaultRule;
  const opts = { hijriOffset: store.settings.hijriOffset, defaultRuleOf };
  const habits = actionable(dayAgenda(store, today, opts))
    .filter((item) => item.kind === 'habit')
    .map((item) => {
      const plan = store.plans.find((p) => p.id === item.planId);
      const habit = input.catalog.find((h) => h.key === plan?.habitKey);
      return { title: habit ? habitTitle(habit, lang) : (plan?.title ?? ''), done: item.complete };
    });
  return {
    off: false,
    date,
    hijri,
    text: pickNewTabText(input),
    habits,
    streak: currentStreak(store, today, opts),
    hasPlans: store.plans.length > 0,
  };
}
