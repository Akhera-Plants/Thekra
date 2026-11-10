/**
 * «استراتيجيات العادات» (redesign §4.5): the fourteen strategies, the feature each one opens («جرّبها»), and the
 * weekly opt-in reminder («ذكّرني بها», at most one a week, planned by notify.ts as kind `strategy`).
 *
 * The idea and example lines are UI copy of each client; the short titles live here because the web push planner and
 * the app's local notifications both name the strategy of the week. Wording is ours, not a quoted text.
 */
import { nowIso, toDayNumber, weekday, type IsoTime, type LocalDate } from './dates.js';
import { addHabitLoop, MAX_LOOP_TEXT, updateHabitLoop, type Plan } from './plan.js';
import type { PrayerAnchor } from './prayer.js';

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

/**
 * The answer of «حلقة العادة» a strategy writes when it is applied to a habit («طبّقها على عادة», owner round 7, C2).
 */
export type StrategyLoopField = 'cue' | 'routine' | 'reward' | 'ifThen';

export interface Strategy {
  key: string;
  action: StrategyAction;
  /** Its family (the filter «للبناء · للترك · للعودة»). */
  kind: StrategyKind;
  titleAr: string;
  titleEn: string;
  /**
   * «طبّقها على عادة»: the loop answer this strategy fills for the chosen habit (round 7, C2). Absent: the strategy is
   * not an answer of a habit's loop, so «جرّبها» opens its own place (a season on «سجلّي», «صحبة», the evening review,
   * and every «ترك» strategy).
   */
  applyField?: StrategyLoopField;
}

/** In the order of the plan («ابدأ صغيرًا جدًا» … «حاسب نفسك»). Keys never change: they are stored in the prefs. */
export const STRATEGIES: readonly Strategy[] = [
  { key: 'start-tiny', action: 'add', kind: 'build', titleAr: 'ابدأ صغيرًا جدًا', titleEn: 'Start very small', applyField: 'routine' },
  { key: 'anchor-prayer', action: 'habits', kind: 'build', titleAr: 'اربطها بصلاة', titleEn: 'Tie it to a prayer', applyField: 'cue' },
  { key: 'if-then', action: 'pledges', kind: 'build', titleAr: '«إذا… فإني…»', titleEn: '"If…, then I will…"', applyField: 'ifThen' },
  { key: 'prepare-place', action: 'habits', kind: 'build', titleAr: 'هيّئ مكانك', titleEn: 'Prepare your place', applyField: 'cue' },
  { key: 'block-sin', action: 'leaveSin', kind: 'leave', titleAr: 'صعّب طريق المعصية', titleEn: 'Make the way to the sin harder' },
  { key: 'never-twice', action: 'wird', kind: 'return', titleAr: 'لا تفوّتها مرتين', titleEn: 'Never miss it twice' },
  { key: 'make-up', action: 'record', kind: 'return', titleAr: 'اقضِ ما فاتك', titleEn: 'Make up what you missed', applyField: 'ifThen' },
  { key: 'bundle', action: 'add', kind: 'build', titleAr: 'اجمعها بما تحب', titleEn: 'Pair it with what you love', applyField: 'reward' },
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
 * True when «طبّقها على عادة» fits the strategy: it is one answer of a habit's loop ({@link Strategy.applyField}). A
 * «ترك» strategy opens its own place instead («تخفّف», «لحظة مجاهدة», or the easy good deeds of «أتبع السيئة الحسنة»),
 * and so do «ابدأ في موسم» (the occasions of «سجلّي»), «الصحبة الصالحة» («صحبة») and «حاسب نفسك» (the evening review):
 * none of them is an answer about one habit (round 7, C2).
 */
export function strategyAppliesToHabit(key: string): boolean {
  const strategy = strategyByKey(key);
  return strategy?.applyField !== undefined && strategy.kind !== 'leave' && !IN_CONTEXT_STRATEGIES.includes(key);
}

/** The loop answer a strategy fills, or null when it is not applied to a habit. */
export function strategyApplyField(key: string): StrategyLoopField | null {
  return strategyAppliesToHabit(key) ? (strategyByKey(key)?.applyField ?? null) : null;
}

/** The prayer of a plan's first prayer-anchored reminder («بعد الفجر» → `fajr`), for «اربطها بصلاة»; null without one. */
export function anchoredPrayerOf(plan: Pick<Plan, 'slotAnchors'>): 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | null {
  const anchor = (plan.slotAnchors ?? []).find((a): a is Exclude<PrayerAnchor, 'before-sleep'> => a !== null && a !== 'before-sleep');
  return anchor ? (anchor.slice('after-'.length) as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha') : null;
}

/**
 * «طبّقها على عادة» saved (round 7, C2): writes `answer` into the strategy's question of the habit's FIRST loop (the
 * loop the habit page shows first), or starts that loop when the habit has none; then `routine` (the habit itself, «ورد
 * القرآن: 2 صفحة») fills its required «الفعل» unless the strategy writes it. Only that one answer changes; the plan's
 * `updatedAt` moves, so it syncs like any edit. Throws for a strategy that is not applied to a habit or an empty answer.
 */
export function applyStrategyToPlan(
  plan: Plan,
  key: string,
  answer: string,
  opts: { loopId: string; routine: string; now?: IsoTime },
): Plan {
  const field = strategyApplyField(key);
  if (field === null) throw new RangeError('This strategy is not applied to a habit');
  const text = answer.trim().slice(0, MAX_LOOP_TEXT).trim();
  if (text === '') throw new RangeError('The answer must not be empty');
  const now = opts.now ?? nowIso();
  const first = plan.loops?.[0];
  if (first) return updateHabitLoop(plan, first.id, { [field]: text }, now);
  const routine = field === 'routine' ? text : opts.routine.trim().slice(0, MAX_LOOP_TEXT).trim() || text;
  return addHabitLoop(plan, opts.loopId, { cue: '', craving: '', reward: '', ...{ [field]: text }, routine }, now);
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
