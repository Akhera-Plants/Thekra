/**
 * «تمّ» on a habit reminder: which responses count (only the button, only on a habit reminder of this app, in
 * both payload shapes expo-notifications delivers), and what is logged (what is left of that day, once).
 */

import { correctLog, createPlan, emptyStore, logDone, upsertPlan, type Store } from '@thekra/practice-core';
import { HABIT_CATEGORY, LOG_ACTION, logRemaining, parseLogAction } from '../lib/practice/reminder-actions';
import { REMINDER_SOURCE } from '../lib/practice/reminders';

const PLAN_ID = '0b9b0c1e-0000-4000-8000-000000000001';
const ID = `${REMINDER_SOURCE}:habit:${PLAN_ID}:2026-10-29:05:15`;
const DATA = { source: REMINDER_SOURCE, route: `/practice/plan/${PLAN_ID}`, confirmTitle: 'أذكار', confirmBody: 'سُجِّل لهذا اليوم.' };

/** The listener / iOS shape: `content.data` is an object. */
function response(actionIdentifier: string, identifier = ID, data: Record<string, unknown> = DATA) {
  return { actionIdentifier, notification: { date: 0, request: { identifier, content: { title: 'أذكار', data } } } };
}

function store(amount = 10): Store {
  const plan = createPlan(
    { id: PLAN_ID, deedSlug: 'dhikr', title: 'أذكار', unit: 'count', amount, activeDaysPerWeek: 3, slots: ['05:15'], createdOn: '2026-10-01' },
    '2026-10-01T08:00:00.000Z',
  );
  return upsertPlan(emptyStore(), plan, '2026-10-01T08:00:00.000Z');
}

describe('parseLogAction', () => {
  it('reads «تمّ» from the listener shape', () => {
    expect(parseLogAction(response(LOG_ACTION))).toEqual({
      notificationId: ID,
      planId: PLAN_ID,
      date: '2026-10-29',
      confirm: { title: 'أذكار', body: 'سُجِّل لهذا اليوم.' },
    });
  });

  it('reads «تمّ» from the Android background task shape (`dataString`)', () => {
    const task = {
      actionIdentifier: LOG_ACTION,
      notification: { request: { identifier: ID, content: { title: 'أذكار', categoryIdentifier: HABIT_CATEGORY, dataString: JSON.stringify(DATA) } } },
    };
    expect(parseLogAction(task)?.planId).toBe(PLAN_ID);
  });

  it('ignores a plain tap, another reminder kind, another source and junk', () => {
    expect(parseLogAction(response('expo.modules.notifications.actions.DEFAULT'))).toBeNull();
    expect(parseLogAction(response(LOG_ACTION, `${REMINDER_SOURCE}:private:2026-10-29`))).toBeNull();
    expect(parseLogAction(response(LOG_ACTION, `${REMINDER_SOURCE}:kinship:2026-10-29`))).toBeNull();
    expect(parseLogAction(response(LOG_ACTION, ID, { source: 'other-app' }))).toBeNull();
    expect(parseLogAction({ actionIdentifier: LOG_ACTION, notification: null })).toBeNull();
    expect(parseLogAction('x')).toBeNull();
  });

  it('works without a confirmation text (an older scheduled reminder)', () => {
    expect(parseLogAction(response(LOG_ACTION, ID, { source: REMINDER_SOURCE }))?.confirm).toBeNull();
  });
});

describe('logRemaining (the hub’s own updatePlan + logDone)', () => {
  it('logs what is left of the day, once', () => {
    const first = logRemaining(store(), PLAN_ID, '2026-10-29');
    expect(first.logged).toBe(10);
    expect(first.store.plans[0]?.log['2026-10-29']).toBe(10);
    // The plan's own version is not touched by a log (logs sync per day).
    expect(first.store.plans[0]?.updatedAt).toBe('2026-10-01T08:00:00.000Z');
    const second = logRemaining(first.store, PLAN_ID, '2026-10-29');
    expect(second.logged).toBe(0);
    expect(second.store).toBe(first.store);
  });

  it('completes a partly done day, and logs again after an undo', () => {
    const partial: Store = { ...store(), plans: [logDone(store().plans[0]!, '2026-10-29', 4)] };
    expect(logRemaining(partial, PLAN_ID, '2026-10-29').logged).toBe(6);
    const undone: Store = { ...partial, plans: [correctLog(partial.plans[0]!, '2026-10-29', 0, '2026-10-29T09:00:00.000Z')] };
    expect(logRemaining(undone, PLAN_ID, '2026-10-29').logged).toBe(10);
  });

  it('does nothing for a plan that is gone', () => {
    const s = store();
    expect(logRemaining(s, 'missing', '2026-10-29')).toEqual({ store: s, logged: 0 });
  });
});
