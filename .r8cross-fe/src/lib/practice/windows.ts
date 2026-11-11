/**
 * Deed time windows on the web (owner, 2026-11-01: «لا تطرح أوقاتًا غير مناسبة»). The rules live in practice-core
 * (`anchorsFor`, `isSlotSuitable`, `windowBounds`); this file shapes them for the slot pickers, the one-line window
 * label and the «صحّح الأوقات» fix of an older plan.
 */
import {
  anchorsFor,
  isPrayerAnchor,
  isSlotSuitable,
  isValidTime,
  slotChoices,
  updatePlan,
  type DeedWindow,
  type Plan,
  type PrayerAnchor,
  type PrayerTimesWithSunrise,
  type Store,
  type WindowEdge,
} from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { sortedSlots } from './plans';

export type WindowSide = 'after' | 'before' | 'at';

export interface WindowPoint {
  edge: WindowEdge;
  side: WindowSide;
}

/** «من بعد الشروق إلى قبل الظهر»: each end as an edge and whether it is after, before or at it. */
export function windowParts(window: DeedWindow): { from: WindowPoint; to: WindowPoint } {
  const side = (minutes: number | undefined): WindowSide => (!minutes ? 'at' : minutes > 0 ? 'after' : 'before');
  return {
    from: { edge: window.from, side: side(window.fromMinutes) },
    to: { edge: window.to, side: side(window.toMinutes) },
  };
}

/** The anchors a habit's slot picker offers (all of them for a habit without a window). */
export function suitableAnchors(habit: PracticeHabit | undefined): readonly PrayerAnchor[] {
  return anchorsFor(habit?.window);
}

/** Why a picker value cannot be saved for this window: an anchor it does not allow, or a time outside it. */
export function slotProblem(
  value: string,
  window: DeedWindow | undefined,
  prayer: PrayerTimesWithSunrise | undefined,
): 'anchor' | 'outside' | null {
  if (!window || value === '') return null;
  if (isPrayerAnchor(value)) return window.anchors.includes(value) ? null : 'anchor';
  if (!isValidTime(value)) return null;
  return isSlotSuitable({ time: value }, window, prayer) ? null : 'outside';
}

/** True when one of the plan's reminder slots does not suit its deed's window. */
export function hasUnsuitableSlot(plan: Plan, window: DeedWindow | undefined, prayer: PrayerTimesWithSunrise | undefined): boolean {
  if (!window) return false;
  return plan.slots.some((time, i) => !isSlotSuitable({ time, anchor: plan.slotAnchors?.[i] ?? null }, window, prayer));
}

/**
 * «صحّح الأوقات»: keeps the suitable slots, replaces the others with the catalog's suggested times (or the deed's own
 * anchors) that suit the window, and drops what cannot be replaced, keeping at least one slot. Null when nothing
 * needs fixing or nothing suitable is known.
 */
export function suitableChoices(
  plan: Plan,
  habit: PracticeHabit | undefined,
  prayer: PrayerTimesWithSunrise | undefined,
): (string | PrayerAnchor)[] | null {
  const window = habit?.window;
  if (!habit || !window || !hasUnsuitableSlot(plan, window, prayer)) return null;
  const fits = (choice: string) => slotProblem(choice, window, prayer) === null;
  const kept = slotChoices(plan).filter(fits);
  const spare = [...habit.defaultSlots, ...window.anchors].filter((choice) => fits(choice) && !kept.includes(choice));
  const wanted = plan.slots.length;
  const next = [...kept];
  while (next.length < wanted && spare.length > 0) next.push(spare.shift() as string);
  return next.length > 0 ? next : null;
}

/** Applies {@link suitableChoices} to the store (the change syncs like any edit). */
export function fixPlanSlots(store: Store, planId: string, choices: readonly (string | PrayerAnchor)[], now: string): Store {
  const { slots, slotAnchors } = sortedSlots(choices);
  return updatePlan(store, planId, (plan) => {
    const next: Plan = { ...plan, slots, updatedAt: now };
    if (slotAnchors) next.slotAnchors = slotAnchors;
    else delete next.slotAnchors;
    return next;
  });
}

/** Sunrise per date from an AlAdhan calendar/timings response (`"06:12 (+03)"` → `"06:12"`). Never throws. */
export function sunrisesFromAlAdhan(json: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof json !== 'object' || json === null) return out;
  const data = (json as { data?: unknown }).data;
  const days = Array.isArray(data) ? data : data !== undefined ? [data] : [];
  for (const day of days) {
    const d = day as { timings?: Record<string, unknown>; date?: { gregorian?: { date?: unknown } } } | null;
    const raw = d?.date?.gregorian?.date;
    const sunrise = d?.timings?.['Sunrise'];
    if (typeof raw !== 'string' || typeof sunrise !== 'string') continue;
    const date = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim());
    const time = /^(\d{2}):(\d{2})/.exec(sunrise.trim());
    if (!date || !time || !isValidTime(`${time[1]}:${time[2]}`)) continue;
    out[`${date[3]}-${date[2]}-${date[1]}`] = `${time[1]}:${time[2]}`;
  }
  return out;
}
