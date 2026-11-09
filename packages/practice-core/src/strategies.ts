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

/**
 * The three families of «استراتيجيات العادات» (owner round 6, C-18 a: the reference's «بناء / ترك / عودة»): building a
 * habit, leaving a sin («تخفّف»), and coming back after a gap. Shared so the website and the app group (and filter)
 * every strategy the same way; the grouping is ours (docs/plan/labels-to-decide.md).
 */
export type StrategyKind = 'build' | 'leave' | 'return';
export const STRATEGY_KINDS: readonly StrategyKind[] = ['build', 'leave', 'return'];

export interface Strategy {
  key: string;
  action: StrategyAction;
  /** Its family (the filter «للبناء · للترك · للعودة»). */
  kind: StrategyKind;
  titleAr: string;
  titleEn: string;
}

/** In the order of the plan («ابدأ صغيرًا جدًا» … «حاسب نفسك»). Keys never change: they are stored in the prefs. */
export const STRATEGIES: readonly Strategy[] = [
  { key: 'start-tiny', action: 'add', kind: 'build', titleAr: 'ابدأ صغيرًا جدًا', titleEn: 'Start very small' },
  { key: 'anchor-prayer', action: 'habits', kind: 'build', titleAr: 'اربطها بصلاة', titleEn: 'Tie it to a prayer' },
  { key: 'if-then', action: 'pledges', kind: 'build', titleAr: '«إذا… فإني…»', titleEn: '"If…, then I will…"' },
  { key: 'prepare-place', action: 'habits', kind: 'build', titleAr: 'هيّئ مكانك', titleEn: 'Prepare your place' },
  { key: 'block-sin', action: 'leaveSin', kind: 'leave', titleAr: 'صعّب طريق المعصية', titleEn: 'Make the way to the sin harder' },
  { key: 'never-twice', action: 'wird', kind: 'return', titleAr: 'لا تفوّتها مرتين', titleEn: 'Never miss it twice' },
  { key: 'make-up', action: 'record', kind: 'return', titleAr: 'اقضِ ما فاتك', titleEn: 'Make up what you missed' },
  { key: 'bundle', action: 'add', kind: 'build', titleAr: 'اجمعها بما تحب', titleEn: 'Pair it with what you love' },
  { key: 'season', action: 'seasons', kind: 'build', titleAr: 'ابدأ في موسم', titleEn: 'Start in a season' },
  { key: 'know-weak', action: 'leaveSin', kind: 'leave', titleAr: 'اعرف متى تضعف', titleEn: 'Know when you weaken' },
  { key: 'ride-wave', action: 'moment', kind: 'leave', titleAr: 'اركب الموجة', titleEn: 'Ride the wave' },
  { key: 'follow-good', action: 'leaveSin', kind: 'leave', titleAr: 'أتبع السيئة الحسنة', titleEn: 'Follow a wrong with a good deed' },
  { key: 'company', action: 'friends', kind: 'build', titleAr: 'الصحبة الصالحة', titleEn: 'Good company' },
  { key: 'self-review', action: 'evening', kind: 'return', titleAr: 'حاسب نفسك', titleEn: 'Review yourself' },
];

export const STRATEGY_KEYS: readonly string[] = STRATEGIES.map((s) => s.key);

/** The family of a strategy (an unknown key counts as «بناء»). */
export function strategyKind(key: string): StrategyKind {
  return strategyByKey(key)?.kind ?? 'build';
}

/**
 * Strategies not listed on the strategies page nor in the weekly reminder (owner round 3, item 14): «لا تفوّتها مرتين»
 * appears in context instead, on a habit's row the day after it was missed.
 */
export const IN_CONTEXT_STRATEGIES: readonly string[] = ['never-twice'];

/** The strategies both clients list (page and «التنبيهات › الاستراتيجيات»), in catalog order; one family or all. */
export function listedStrategies(kind: StrategyKind | 'all' = 'all'): Strategy[] {
  return STRATEGIES.filter((s) => !IN_CONTEXT_STRATEGIES.includes(s.key) && (kind === 'all' || s.kind === kind));
}

/**
 * True when «طبّقها على عادة» fits the strategy: a building or returning strategy shapes a habit's loop. A «ترك»
 * strategy opens its own place instead («تخفّف», «لحظة مجاهدة», or the easy good deeds of «أتبع السيئة الحسنة»).
 */
export function strategyAppliesToHabit(key: string): boolean {
  const strategy = strategyByKey(key);
  return strategy !== undefined && strategy.kind !== 'leave' && !IN_CONTEXT_STRATEGIES.includes(key);
}

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
