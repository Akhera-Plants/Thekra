/**
 * «استراتيجيات العادات» (redesign §4.5): the fourteen strategies, the feature each one opens («جرّبها»), and the
 * weekly opt-in reminder («ذكّرني بها», at most one a week, planned by notify.ts as kind `strategy`).
 *
 * The idea and example lines are UI copy of each client; the short titles live here because the web push planner and
 * the app's local notifications both name the strategy of the week. Wording is ours, not a quoted text.
 */
import { toDayNumber, weekday, type LocalDate } from './dates.js';

/** What «جرّبها» opens. Each client maps it to its own screen. */
export type StrategyAction =
  | 'add'
  | 'habits'
  | 'wird'
  | 'record'
  | 'seasons'
  | 'moment'
  | 'leaveSin'
  | 'friends'
  | 'pledges'
  | 'evening';

export interface Strategy {
  key: string;
  action: StrategyAction;
  titleAr: string;
  titleEn: string;
}

/** In the order of the plan («ابدأ صغيرًا جدًا» … «حاسب نفسك»). Keys never change: they are stored in the prefs. */
export const STRATEGIES: readonly Strategy[] = [
  { key: 'start-tiny', action: 'add', titleAr: 'ابدأ صغيرًا جدًا', titleEn: 'Start very small' },
  { key: 'anchor-prayer', action: 'habits', titleAr: 'اربطها بصلاة', titleEn: 'Tie it to a prayer' },
  { key: 'if-then', action: 'pledges', titleAr: '«إذا… فإني…»', titleEn: '"If…, then I will…"' },
  { key: 'prepare-place', action: 'habits', titleAr: 'هيّئ مكانك', titleEn: 'Prepare your place' },
  { key: 'block-sin', action: 'leaveSin', titleAr: 'صعّب طريق المعصية', titleEn: 'Make the way to the sin harder' },
  { key: 'never-twice', action: 'wird', titleAr: 'لا تفوّتها مرتين', titleEn: 'Never miss it twice' },
  { key: 'make-up', action: 'record', titleAr: 'اقضِ ما فاتك', titleEn: 'Make up what you missed' },
  { key: 'bundle', action: 'add', titleAr: 'اجمعها بما تحب', titleEn: 'Pair it with what you love' },
  { key: 'season', action: 'seasons', titleAr: 'ابدأ في موسم', titleEn: 'Start in a season' },
  { key: 'know-weak', action: 'leaveSin', titleAr: 'اعرف متى تضعف', titleEn: 'Know when you weaken' },
  { key: 'ride-wave', action: 'moment', titleAr: 'اركب الموجة', titleEn: 'Ride the wave' },
  { key: 'follow-good', action: 'leaveSin', titleAr: 'أتبع السيئة الحسنة', titleEn: 'Follow a wrong with a good deed' },
  { key: 'company', action: 'friends', titleAr: 'الصحبة الصالحة', titleEn: 'Good company' },
  { key: 'self-review', action: 'evening', titleAr: 'حاسب نفسك', titleEn: 'Review yourself' },
];

export const STRATEGY_KEYS: readonly string[] = STRATEGIES.map((s) => s.key);

/** The strategy reminder's default weekday (6 = Saturday); round 6: the member chooses the day (`NotificationPrefs.strategyDay`). */
export const STRATEGY_WEEKDAY = 6;

export function strategyByKey(key: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.key === key);
}

/** Known keys only, once each, in the catalog order. */
export function cleanStrategyKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const chosen = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return STRATEGY_KEYS.filter((key) => chosen.has(key));
}

/** Adds or removes one strategy from the opt-in list. */
export function toggleStrategy(keys: readonly string[], key: string): string[] {
  if (!STRATEGY_KEYS.includes(key)) return cleanStrategyKeys(keys);
  return keys.includes(key) ? keys.filter((k) => k !== key) : cleanStrategyKeys([...keys, key]);
}

/**
 * The strategy reminded on `date` (the reminder's weekday, {@link STRATEGY_WEEKDAY} by default) among the chosen ones,
 * rotating week by week; null on other days or without a choice.
 */
export function strategyOfWeek(keys: readonly string[], date: LocalDate, day: number = STRATEGY_WEEKDAY): string | null {
  const chosen = cleanStrategyKeys(keys);
  if (chosen.length === 0 || weekday(date) !== day) return null;
  const week = Math.floor(toDayNumber(date) / 7);
  return chosen[((week % chosen.length) + chosen.length) % chosen.length] ?? null;
}
