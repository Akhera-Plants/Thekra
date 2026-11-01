/**
 * Suitable times only (owner, 2026-11-01: «لا تطرح أوقاتًا غير مناسبة»; he saw «بعد الظهر» offered for Duha). A catalog
 * habit may carry a `window` (practice-core `DeedWindow`: Duha from sunrise + 15 to dhuhr − 10, no prayer anchors;
 * witr after isha to before fajr with «بعد العشاء» / «قبل النوم»…). The add flow and the plan screen offer only
 * `anchorsFor(window)` and fixed times inside the window on the user's prayer times for the day (with AlAdhan's
 * sunrise when cached, else practice-core's late estimate). Pure: no React, no store.
 */

import {
  anchorsFor,
  isPrayerAnchor,
  isSlotSuitable,
  isTimeInWindow,
  PRAYER_ANCHORS,
  windowBounds,
  type DeedWindow,
  type LocalTime,
  type PrayerAnchor,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';

/** A reminder slot as picked: a fixed `HH:MM` or a prayer anchor. */
export type SlotChoice = LocalTime | PrayerAnchor;

/** The anchors to offer, in the usual order of the day. */
export function offeredAnchors(window: DeedWindow | undefined): PrayerAnchor[] {
  const allowed = anchorsFor(window);
  return PRAYER_ANCHORS.filter((a) => allowed.includes(a));
}

/** Whether one picked slot suits the deed on a day with these prayer times. */
export function isChoiceSuitable(choice: SlotChoice, window: DeedWindow | undefined, times?: PrayerTimesWithSunrise): boolean {
  return isPrayerAnchor(choice) ? isSlotSuitable({ time: '00:00', anchor: choice }, window, times) : isSlotSuitable({ time: choice }, window, times);
}

/** The picked slots that do not suit the deed (an anchor it does not allow, a time outside its window). */
export function unsuitableChoices(choices: readonly SlotChoice[], window: DeedWindow | undefined, times?: PrayerTimesWithSunrise): SlotChoice[] {
  return choices.filter((c) => !isChoiceSuitable(c, window, times));
}

/**
 * The habit's suggested slots that suit it on this day; when none does (an unusual prayer timetable), the start of the
 * window, so the setup never opens empty or wrong.
 */
export function suitableDefaults(
  defaults: readonly SlotChoice[],
  window: DeedWindow | undefined,
  times?: PrayerTimesWithSunrise,
): SlotChoice[] {
  const kept = defaults.filter((c) => isChoiceSuitable(c, window, times));
  if (kept.length > 0 || !window) return [...kept];
  return [windowBounds(window, times).from];
}

/**
 * The slots once the unsuitable ones are taken out («صحّح الأوقات» on the plan screen); when nothing is left, the
 * habit's suitable defaults.
 */
export function fixedChoices(
  choices: readonly SlotChoice[],
  defaults: readonly SlotChoice[],
  window: DeedWindow | undefined,
  times?: PrayerTimesWithSunrise,
): SlotChoice[] {
  const kept = choices.filter((c) => isChoiceSuitable(c, window, times));
  return kept.length > 0 ? kept : suitableDefaults(defaults, window, times);
}

/** Where the time picker opens: the last time chosen when it suits, else a time inside the window, else `fallback`. */
export function pickerStart(
  chosenTimes: readonly LocalTime[],
  window: DeedWindow | undefined,
  times: PrayerTimesWithSunrise | undefined,
  fallback: LocalTime,
): LocalTime {
  const last = chosenTimes[chosenTimes.length - 1];
  if (last && (!window || isTimeInWindow(last, window, times))) return last;
  if (!window) return last ?? fallback;
  return isTimeInWindow(fallback, window, times) ? fallback : windowBounds(window, times).from;
}

/** The window's start and end on this day, for the one line «وقتها: من … إلى …» (null without a window). */
export function windowRange(window: DeedWindow | undefined, times?: PrayerTimesWithSunrise): { from: LocalTime; to: LocalTime } | null {
  return window ? windowBounds(window, times) : null;
}
