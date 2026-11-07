/**
 * The heart slot of «ورد اليوم» (owner round 5, F-06 a, F-35 a, A-01 a; docs/plan/2026-11-07-owner-round-5.md §1): ONE
 * card at the top, chosen by a fixed priority, the same on the web and the app:
 *
 * 1. «نية اليوم» in the morning (until {@link INTENTION_UNTIL}): the one-time offer of the setting, or the card to make
 *    today's intention (`intentionState` `offer` / `card`).
 * 2. «محاسبة المساء» from the user's evening time while today's review is not saved (`eveningCardVisible`).
 * 3. The weekly review on its day (and the next morning when skipped, `weeklyReviewDue`).
 * 4. «عملك المعتاد يُكتب لك» the morning after an excused or heavy day, when the commitment before it is above 60%
 *    (`usualDeedDue`), until {@link USUAL_DEED_UNTIL}.
 * 5. Otherwise, in the morning, the one line of an intention already made (`intentionState` `made`).
 * 6. Nothing (null).
 *
 * Each card is one line with «ابدأ» that opens its sheet. Pure.
 */
import type { LocalDate, LocalTime } from './dates.js';
import { excuseOfYesterday, usualDeedDue, type CommitmentOptions } from './commitment.js';
import { eveningCardVisible, INTENTION_UNTIL, intentionState, weeklyReviewDue, type HeartData } from './heart.js';
import type { Store } from './storage.js';

/** «عملك المعتاد يُكتب لك» shows in the morning only (F-35 a: «صباح اليوم التالي للعذر فقط»). */
export const USUAL_DEED_UNTIL: LocalTime = INTENTION_UNTIL;

export type HeartSlot =
  | { kind: 'intention'; state: 'offer' | 'card' | 'made' }
  | { kind: 'evening' }
  | { kind: 'weekly'; weekOf: LocalDate }
  /** `reason`: yesterday was «عذر» (sick or travelling) or a heavy day; the card says which («أمس كان يوم عذر…»). */
  | { kind: 'usual-deed'; reason: 'excused' | 'heavy' };

export type HeartSlotKind = HeartSlot['kind'];

/** The one card to show now, or null. `time` is the user's local `HH:MM`. */
export function heartSlot(
  heart: HeartData,
  store: Pick<Store, 'plans' | 'settings'>,
  today: LocalDate,
  time: LocalTime,
  opts: CommitmentOptions = {},
): HeartSlot | null {
  const intention = intentionState(heart, today, time);
  if (intention === 'offer' || intention === 'card') return { kind: 'intention', state: intention };
  if (eveningCardVisible(heart, today, time)) return { kind: 'evening' };
  const weekOf = weeklyReviewDue(heart, today, time);
  if (weekOf) return { kind: 'weekly', weekOf };
  if (time < USUAL_DEED_UNTIL && usualDeedDue(store, today, opts)) {
    const reason = excuseOfYesterday(store, today);
    if (reason) return { kind: 'usual-deed', reason };
  }
  if (intention === 'made') return { kind: 'intention', state: 'made' };
  return null;
}
