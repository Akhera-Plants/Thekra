/**
 * «الأعمال الدورية» (owner round 6, C-10 / C-17 / C-01i; docs/plan/2026-11-09-owner-round-6.md §6): one main tab of
 * «عاداتي» holding EVERY periodic act. There is no «أهلي وناسي» any more: its people lists (relatives, parents,
 * neighbours, friends, the sick) live INSIDE the act «صلة الرحم والأحباب».
 *
 * {@link PERIODIC_ACTS} is the shared catalog, in the tab's order. Each act names the practice-catalog templates
 * (`backend/prisma/taxonomy/deed-schedules.yaml`, `kind: periodic`) a plan of it is made from; a backend test checks
 * that every template exists, is periodic and has public evidence ids. The member can also add his own act
 * ({@link createCustomPeriodic}): a plan with {@link CUSTOM_PERIODIC_KEY}, a non-daily rule and its own reminders.
 *
 * Data: nothing new. A periodic act is a plan (from a template, or custom) or, for «صلة الرحم والأحباب», the member's
 * `Relative` rows (every circle). The round-5 people data needs no migration: the same rows are now the people of this
 * act (no row is moved, renamed or dropped).
 *
 * Limits: an act counts once toward the 8 periodic acts (LIMITS.periodic) however many people or plans it holds ({@link periodicActKeyOf}
 * groups them); a custom act is always periodic, never a habit (limits, streak, commitment). Pure.
 */
import { nowIso, type IsoTime, type LocalDate, type LocalTime } from './dates.js';
import { PEOPLE_CIRCLES, isRelativeOpen, type PeopleCircle, type Relative } from './kinship.js';
import { createPlan, isPaused, type Plan } from './plan.js';
import { validateRule, type Rule } from './rules.js';
import type { PrayerAnchor } from './prayer.js';
import type { Store } from './storage.js';

/** The habit key of a member's own periodic act. Its `deedSlug` is {@link CUSTOM_PERIODIC_KEY} too (no deed page). */
export const CUSTOM_PERIODIC_KEY = 'custom-periodic';

export interface PeriodicActInfo {
  /** Stable key (notification switches use it). Never reused. */
  key: string;
  ar: string;
  en: string;
  /** deed-schedules.yaml templates (`kind: periodic`) a plan of this act is made from; the first is the default. */
  templates: readonly string[];
  /** People lists inside the act (only «صلة الرحم والأحباب»). */
  circles?: readonly PeopleCircle[];
}

/**
 * The catalog, in the tab's order (owner's list): 1 «صلة الرحم والأحباب» (its people lists), 2 صدقة, 3 صيام الاثنين
 * والخميس, 4 الأيام البيض, 5–8 four more acts chosen from deed-schedules.yaml templates with public evidence: ختمة القرآن,
 * زيارة القبور, صيام يوم عرفة, صيام عاشوراء. «سورة الكهف يوم الجمعة» (`kahf-jumua`) waits for a verified public evidence
 * id (its template has none yet), «صلاة التسابيح» has no reviewed template, and «عيادة المريض» is a people list of act 1.
 */
export const PERIODIC_ACTS: readonly PeriodicActInfo[] = [
  {
    key: 'silat',
    ar: 'صلة الرحم والأحباب',
    en: 'Ties of kinship and loved ones',
    templates: ['silat-ar-rahim', 'birr-walidayn', 'tafaqqud-jiran', 'tafaqqud-sadiq', 'iyadat-marid'],
    circles: PEOPLE_CIRCLES,
  },
  { key: 'sadaqah', ar: 'صدقة', en: 'Charity', templates: ['sadaqah-weekly'] },
  { key: 'ithnayn-khamis', ar: 'صيام الاثنين والخميس', en: 'Fasting Mondays and Thursdays', templates: ['siyam-ithnayn-khamis'] },
  { key: 'ayyam-bid', ar: 'الأيام البيض', en: 'The White Days', templates: ['siyam-ayyam-bid'] },
  { key: 'khatma', ar: 'ختمة القرآن', en: 'Completing the Quran', templates: ['khatma'] },
  { key: 'ziyarat-qubur', ar: 'زيارة القبور', en: 'Visiting the graves', templates: ['ziyarat-qubur'] },
  { key: 'arafah', ar: 'صيام يوم عرفة', en: 'Fasting the Day of Arafah', templates: ['siyam-arafah'] },
  { key: 'ashura', ar: 'صيام عاشوراء', en: 'Fasting Ashura', templates: ['siyam-ashura'] },
];

/** Every template key of the catalog. */
export const PERIODIC_TEMPLATE_KEYS: readonly string[] = PERIODIC_ACTS.flatMap((a) => a.templates);

/** The act with this key. */
export function periodicAct(key: string): PeriodicActInfo | undefined {
  return PERIODIC_ACTS.find((a) => a.key === key);
}

/** True for a member's own periodic act. */
export function isCustomPeriodic(plan: Pick<Plan, 'habitKey'>): boolean {
  return plan.habitKey === CUSTOM_PERIODIC_KEY;
}

/**
 * The act a plan belongs to: its catalog act (by template key), `custom:<planId>` for a custom act, or null (a habit,
 * or a periodic template outside the catalog list, e.g. `kahf-jumua`: the client's catalog lookup still decides its
 * limits).
 */
export function periodicActKeyOf(plan: Pick<Plan, 'id' | 'habitKey'>): string | null {
  if (isCustomPeriodic(plan)) return `custom:${plan.id}`;
  if (plan.habitKey === undefined) return null;
  return PERIODIC_ACTS.find((a) => a.templates.includes(plan.habitKey as string))?.key ?? null;
}

/**
 * The periodic test the limits, the streak and the commitment use: the client's own (`catalog kind: periodic`), plus a
 * custom act, which is always periodic.
 */
export function withCustomPeriodic(isPeriodicAct?: (plan: Plan) => boolean): (plan: Plan) => boolean {
  return (plan) => isCustomPeriodic(plan) || (isPeriodicAct?.(plan) ?? false);
}

/** One act in use: its plans (unpaused) and, for «صلة الرحم والأحباب», its people. */
export interface ActivePeriodicAct {
  /** Catalog key, or `custom:<planId>`. */
  key: string;
  /** The catalog entry; absent for a custom act (its title is the plan's). */
  info?: PeriodicActInfo;
  plans: Plan[];
  relatives: Relative[];
}

/**
 * The acts the member has, in the catalog's order, then custom acts in the store's order. «صلة الرحم والأحباب» is in
 * use when any person is listed (a visited sick person still counts as listed) or a plan of its templates exists.
 */
export function activePeriodicActs(store: Pick<Store, 'plans' | 'relatives'>): ActivePeriodicAct[] {
  const out: ActivePeriodicAct[] = [];
  const live = store.plans.filter((p) => !isPaused(p));
  for (const info of PERIODIC_ACTS) {
    const plans = live.filter((p) => p.habitKey !== undefined && info.templates.includes(p.habitKey));
    const relatives = info.circles ? store.relatives.filter((r) => info.circles?.includes(r.circle ?? 'kin')) : [];
    if (plans.length > 0 || relatives.length > 0) out.push({ key: info.key, info, plans, relatives });
  }
  for (const plan of live) if (isCustomPeriodic(plan)) out.push({ key: `custom:${plan.id}`, plans: [plan], relatives: [] });
  return out;
}

/** The people of «صلة الرحم والأحباب» grouped by list, in {@link PEOPLE_CIRCLES} order (open people first in each). */
export function silatPeople(relatives: readonly Relative[]): { circle: PeopleCircle; people: Relative[] }[] {
  return PEOPLE_CIRCLES.map((circle) => ({
    circle,
    people: relatives
      .filter((r) => (r.circle ?? 'kin') === circle)
      .sort((a, b) => Number(isRelativeOpen(b)) - Number(isRelativeOpen(a))),
  })).filter((g) => g.people.length > 0);
}

export interface NewCustomPeriodic {
  id: string;
  /** The member's own name for the act (1–200 characters). */
  title: string;
  /** Not daily: a periodic act (weekdays fewer than 7, every n>1 days, every n weeks, monthly, Hijri). */
  rule: Rule;
  /** Reminder times (at least one); the first rings on each due day. */
  slots: LocalTime[];
  slotAnchors?: (PrayerAnchor | null)[];
  createdOn: LocalDate;
}

/** True for a rule that is not every day (the condition of a periodic act). */
export function isPeriodicRule(rule: Rule): boolean {
  if (rule.kind === 'daily') return false;
  if (rule.kind === 'weekdays') return new Set(rule.days).size < 7;
  if (rule.kind === 'everyNDays') return rule.n > 1;
  return true;
}

/**
 * A member's own periodic act («أضف عملًا دوريًا»): one `times` unit on each due day, reminded in its first slot. Throws
 * on an empty title, an invalid or daily rule, or invalid slots.
 */
export function createCustomPeriodic(input: NewCustomPeriodic, now: IsoTime = nowIso()): Plan {
  const title = input.title.trim();
  if (title.length === 0 || title.length > 200) throw new RangeError('title must be 1–200 characters');
  const err = validateRule(input.rule);
  if (err) throw new RangeError(`Invalid rule: ${err}`);
  if (!isPeriodicRule(input.rule)) throw new RangeError('A periodic act needs a rule that is not every day');
  return createPlan(
    {
      id: input.id,
      habitKey: CUSTOM_PERIODIC_KEY,
      deedSlug: CUSTOM_PERIODIC_KEY,
      title,
      unit: 'times',
      amount: 1,
      activeDaysPerWeek: 1,
      slots: [...input.slots],
      ...(input.slotAnchors ? { slotAnchors: [...input.slotAnchors] } : {}),
      createdOn: input.createdOn,
      rule: input.rule,
    },
    now,
  );
}
