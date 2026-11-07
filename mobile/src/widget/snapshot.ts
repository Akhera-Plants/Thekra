/**
 * The home-screen widgets' data (redesign §4.6, Android first). The app builds one snapshot on foreground and after
 * every change and saves it; the widget task (task-handler.tsx) only reads it, so a widget never touches the practice
 * store. Pure: no React Native imports here, so the jest tests run in Node.
 *
 * - «المداومة» (small): the streak with the brand-green flame and «بقي n».
 * - «ورد اليوم» (medium): today's habits with done marks (habits only: no names of people, never the sin program), and a
 *   generic «لحظة مجاهدة» button that opens the moment screen (owner round 5, F-24 a / F-09; it names no sin).
 * - «نص اليوم»: one text a day from the source chosen in settings (a reminder set, the saved texts, «تذكيراتي», or
 *   «مواسم الخير»: today's date and the next occasion). The candidates are saved, and the widget picks the day's one
 *   (practice-core `dailyPick`), so it still turns over on days the app is not opened.
 *
 * A snapshot from an earlier day shows no stale done marks: the list and «بقي» wait for the app to be opened.
 */
import {
  actionable,
  addDays,
  currentStreak,
  dailyPick,
  dayAgenda,
  occurrences,
  type AgendaOccasion,
  type LocalDate,
  type PlanDayOptions,
  type Store,
  type TodayTextSource,
} from '@thekra/practice-core';

export const WIDGET_SNAPSHOT_KEY = 'thekra.widget.snapshot.v1';
export const WIDGET_NAMES = ['StreakWidget', 'WirdWidget', 'DailyTextWidget'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];
/** Days of occasions saved for «مواسم الخير». */
export const WIDGET_OCCASION_DAYS = 60;
/** Habits listed on the medium widget. */
export const WIDGET_MAX_ITEMS = 5;
/** Deep link of «ورد اليوم» (the app scheme + the tab route). */
export const WIRD_URI = 'thekra://habits';
/** Deep link of «لحظة مجاهدة» (generic: the screen decides on the device which program it is about). */
export const MOMENT_URI = 'thekra://practice/moment';
/** The moment button's words when a snapshot from an older build has none. */
export const MOMENT_LABEL_FALLBACK = 'لحظة مجاهدة';

export interface WidgetText {
  text: string;
  /** Source line (book, number, grade); empty for the user's own lines. */
  attribution: string;
}

export interface WidgetLabels {
  /** «المداومة». */
  streak: string;
  /** «بقي {n}» with `{n}` in it. */
  remaining: string;
  /** «تمّ وردك اليوم». */
  allDone: string;
  /** «ورد اليوم». */
  wird: string;
  /** «افتح التطبيق لترى ورد اليوم». */
  openApp: string;
  /** «أضف غرسًا صغيرًا». */
  noHabits: string;
  /** «نص اليوم». */
  dailyText: string;
  /** Shown when the chosen source has no text yet. */
  noText: string;
  /** The date-and-occasion source's title («اليوم والمناسبة القريبة»). */
  seasons: string;
  /** «لحظة مجاهدة» on the wird widget (optional: older snapshots have none). */
  moment?: string;
  /** «اليوم: {title}». */
  todayOccasion: string;
  /** «القادم: {title}، {date}» (`{date}` = day and month name). */
  nextOccasion: string;
  /** January … December. */
  months: string[];
}

export interface WidgetSnapshot {
  v: 1;
  /** The local day the list and the counts were computed for. */
  date: LocalDate;
  rtl: boolean;
  hasPlans: boolean;
  streak: number;
  remaining: number;
  items: { title: string; done: boolean }[];
  source: TodayTextSource['kind'];
  texts: WidgetText[];
  occasions: { date: LocalDate; title: string }[];
  labels: WidgetLabels;
}

export interface SnapshotInput {
  store: Store;
  today: LocalDate;
  planDays: PlanDayOptions;
  occasions: readonly AgendaOccasion[];
  /** Plan id → its title in the UI language. */
  titleOf: (planId: string) => string;
  source: TodayTextSource;
  /** The candidate texts of the chosen source (empty for «مواسم الخير»). */
  texts: readonly WidgetText[];
  labels: WidgetLabels;
  locale: 'ar' | 'en';
}

function upcomingOccasions(occasions: readonly AgendaOccasion[], today: LocalDate, hijriOffset: number, locale: 'ar' | 'en') {
  const end = addDays(today, WIDGET_OCCASION_DAYS - 1);
  const out: { date: LocalDate; title: string }[] = [];
  for (const o of occasions) {
    let dates: LocalDate[];
    try {
      dates = occurrences(o.rule, today, end, { hijriOffset });
    } catch {
      continue; // A Hijri rule without Umm al-Qura: a wrong date is worse than none.
    }
    for (const date of dates) out.push({ date, title: locale === 'en' ? o.titleEn : o.titleAr });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function buildWidgetSnapshot(input: SnapshotInput): WidgetSnapshot {
  const { store, today, planDays } = input;
  const habits = actionable(dayAgenda(store, today, planDays)).filter((item) => item.kind === 'habit');
  return {
    v: 1,
    date: today,
    rtl: input.locale === 'ar',
    hasPlans: store.plans.length > 0,
    streak: currentStreak(store, today, planDays),
    remaining: habits.filter((item) => !item.complete).length,
    items: habits.slice(0, WIDGET_MAX_ITEMS).map((item) => ({ title: input.titleOf(item.planId), done: item.complete })),
    source: input.source.kind,
    texts: input.source.kind === 'seasons' ? [] : input.texts.slice(0, 60).map((t) => ({ text: t.text, attribution: t.attribution })),
    occasions: upcomingOccasions(input.occasions, today, store.settings.hijriOffset, input.locale),
    labels: input.labels,
  };
}

/** Never throws: a missing or malformed snapshot is `null` (the widget shows its empty state). */
export function parseWidgetSnapshot(raw: string | null): WidgetSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as WidgetSnapshot;
    return value && value.v === 1 && typeof value.date === 'string' && value.labels ? value : null;
  } catch {
    return null;
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export interface WidgetView {
  streak: { value: number; line: string };
  wird: { title: string; items: { title: string; done: boolean }[]; line: string; moment: string };
  text: { title: string; body: string; attribution: string };
}

/** What each widget shows on `today` (the widget task calls this with the device's date). */
export function widgetView(snapshot: WidgetSnapshot, today: LocalDate): WidgetView {
  const { labels } = snapshot;
  const fresh = snapshot.date === today;
  const line = !snapshot.hasPlans
    ? labels.noHabits
    : !fresh
      ? labels.openApp
      : snapshot.remaining === 0
        ? labels.allDone
        : fill(labels.remaining, { n: snapshot.remaining });

  let text: WidgetView['text'];
  if (snapshot.source === 'seasons') {
    const dayMonth = (date: LocalDate) => `${Number(date.slice(8, 10))} ${labels.months[Number(date.slice(5, 7)) - 1] ?? ''}`;
    const todays = snapshot.occasions.filter((o) => o.date === today).map((o) => o.title);
    const next = snapshot.occasions.find((o) => o.date > today);
    const parts = [
      todays.length > 0 ? fill(labels.todayOccasion, { title: todays.join('، ') }) : null,
      next ? fill(labels.nextOccasion, { title: next.title, date: dayMonth(next.date) }) : null,
    ].filter((p): p is string => p !== null);
    text = { title: `${labels.seasons} · ${dayMonth(today)}`, body: parts.join('\n') || labels.noText, attribution: '' };
  } else {
    const pick = dailyPick(snapshot.texts, today);
    text = { title: labels.dailyText, body: pick?.text ?? labels.noText, attribution: pick?.attribution ?? '' };
  }

  return {
    streak: { value: snapshot.streak, line },
    wird: { title: labels.wird, items: fresh ? snapshot.items : [], line, moment: labels.moment || MOMENT_LABEL_FALLBACK },
    text,
  };
}
