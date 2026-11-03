import { describe, expect, it } from 'vitest';
import {
  arabicActs,
  capPerDay,
  createPlan,
  DEFAULT_NOTIFICATION_PREFS,
  emptyStore,
  isQuietTime,
  notificationPlan,
  NOTIFY_TEXTS,
  parseNotificationPrefs,
  startProgram,
  toggleExcusedDay,
  upsertPlan,
  type NotificationPlanInput,
  type Plan,
  type PlannedNotification,
  type Relative,
  type Store,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';
const TODAY = '2026-10-28'; // a Wednesday; Friday is the 30th

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan(
      { id, deedSlug: 'x', title: id, unit: 'count', amount: 2, activeDaysPerWeek: 7, slots: ['09:00', '13:00'], createdOn: '2026-10-01' },
      NOW,
    ),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

const run = (store: Store, extra: Partial<NotificationPlanInput> = {}) =>
  notificationPlan({ store, prefs: DEFAULT_NOTIFICATION_PREFS, today: TODAY, now: '08:00', days: 1, ...extra });

const keys = (list: PlannedNotification[]) => list.map((n) => n.key);

describe('notificationPlan: habits', () => {
  it('reminds at each slot, and none once the day is done', () => {
    expect(keys(run(storeOf(plan('a'))))).toEqual(['habit:a:2026-10-28:09:00', 'habit:a:2026-10-28:13:00']);
    expect(run(storeOf(plan('a', { log: { [TODAY]: 2 } })))).toEqual([]);
  });

  it('the second slot only while the first did not lead to a log: past slots and done days drop', () => {
    expect(keys(run(storeOf(plan('a')), { now: '10:00' }))).toEqual(['habit:a:2026-10-28:13:00']);
    expect(run(storeOf(plan('a', { log: { [TODAY]: 2 } })), { now: '10:00' })).toEqual([]);
  });

  it('an established habit reminds once, a paused one never, an excused day not at all', () => {
    expect(keys(run(storeOf(plan('a', { establishedOn: '2026-10-20' }))))).toEqual(['habit:a:2026-10-28:09:00']);
    expect(run(storeOf(plan('a', { pausedOn: '2026-10-20' })))).toEqual([]);
    const excused = toggleExcusedDay(storeOf(plan('a')), TODAY, TODAY, NOW);
    expect(run(excused)).toEqual([]);
  });

  it('a periodic act once per due day, in its first slot', () => {
    const friday = plan('f', { rule: { kind: 'weekdays', days: [5] } });
    expect(keys(run(storeOf(friday), { days: 7, kinds: ['habit'] }))).toEqual(['habit:f:2026-10-30:09:00']);
  });

  it('quiet hours: suggested night slots drop, the night prayer and the user’s own times stay', () => {
    const late = plan('w', { habitKey: 'witr', slots: ['22:00', '23:00'] });
    const night = plan('q', { habitKey: 'qiyam-last-third', slots: ['04:00'] });
    const own = plan('o', { habitKey: 'witr', slots: ['23:30'] });
    const defaultSlotsOf = (p: Plan) => (p.habitKey === 'witr' ? ['22:00', '23:00'] : p.habitKey === 'qiyam-last-third' ? ['04:00'] : undefined);
    const out = run(storeOf(late, night, own), { days: 2, now: '05:30', defaultSlotsOf });
    expect(keys(out)).toEqual([
      'habit:w:2026-10-28:22:00',
      'habit:o:2026-10-28:23:30',
      'habit:q:2026-10-29:04:00',
      'habit:w:2026-10-29:22:00',
      'habit:o:2026-10-29:23:30',
    ]);
    expect(isQuietTime('23:00')).toBe(true);
    expect(isQuietTime('04:59')).toBe(true);
    expect(isQuietTime('05:00')).toBe(false);
  });
});

describe('notificationPlan: the policy’s own reminders', () => {
  it('evening nudge: opt-in, once a day, only while a habit is not done', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, habits: false, eveningNudge: true };
    expect(keys(run(storeOf(plan('a')), { prefs }))).toEqual(['evening:2026-10-28']);
    expect(run(storeOf(plan('a', { log: { [TODAY]: 2 } })), { prefs })).toEqual([]);
    expect(run(storeOf(plan('a')), { prefs: { ...prefs, eveningNudge: false } })).toEqual([]);
    expect(run(storeOf(plan('a')), { prefs, now: '21:00' })).toEqual([]);
  });

  it('Friday review reminder at 17:00, on by default, not once saved', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, habits: false };
    expect(run(storeOf(plan('a')), { prefs, days: 7 }).map((n) => [n.key, n.time])).toEqual([['friday:2026-10-30', '17:00']]);
    expect(run(storeOf(plan('a')), { prefs, days: 7, reviewDoneOn: (d) => d === '2026-10-30' })).toEqual([]);
    expect(run(emptyStore(), { prefs, days: 7 })).toEqual([]);
  });

  it('weekly review reminder on the chosen day', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, habits: false, reviewDay: 0, fridayTime: '20:00' };
    expect(run(storeOf(plan('a')), { prefs, days: 7 }).map((n) => [n.date, n.time])).toEqual([['2026-11-01', '20:00']]);
    expect(parseNotificationPrefs({ reviewDay: 3 }).reviewDay).toBe(3);
    expect(parseNotificationPrefs({ reviewDay: 7 }).reviewDay).toBe(5);
  });

  it('people lists: one generic reminder per due day; the private moment only when asked for', () => {
    const rel: Relative = { id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' }, history: [] };
    const store: Store = { ...emptyStore(), relatives: [rel, { ...rel, id: 'r2' }] };
    const out = run(store);
    expect(out).toEqual([{ kind: 'periodic', key: 'periodic:2026-10-28', date: TODAY, time: '18:00', relativeIds: ['r1', 'r2'], count: 2 }]);
    const program = startProgram({ sinSlug: 'x', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: TODAY }, NOW);
    const withProgram: Store = { ...emptyStore(), programs: [program] };
    expect(run(withProgram)).toEqual([]);
    expect(keys(run(withProgram, { prefs: { ...DEFAULT_NOTIFICATION_PREFS, privateMoment: true } }))).toEqual(['private:2026-10-28']);
    expect(run(withProgram, { prefs: { ...DEFAULT_NOTIFICATION_PREFS, privateMoment: true }, kinds: ['habit', 'periodic'] })).toEqual([]);
  });
});

describe('the daily cap', () => {
  it('at most four a day: the rest merge into one digest counting the acts', () => {
    const many = storeOf(plan('a'), plan('b'), plan('c'));
    const out = run(many);
    expect(out).toHaveLength(4);
    expect(keys(out)).toEqual(['habit:a:2026-10-28:09:00', 'habit:b:2026-10-28:09:00', 'habit:c:2026-10-28:09:00', 'digest:2026-10-28']);
    expect(out[3]).toMatchObject({ kind: 'digest', time: '13:00', count: 3 });
    expect(run(many, { kinds: ['habit'] })).toHaveLength(3);
  });

  it('a digest of nudges only is dropped', () => {
    const entries: PlannedNotification[] = [
      { kind: 'habit', key: 'h1', date: TODAY, time: '08:00', planId: 'a' },
      { kind: 'habit', key: 'h2', date: TODAY, time: '09:00', planId: 'b' },
      { kind: 'habit', key: 'h3', date: TODAY, time: '10:00', planId: 'c' },
      { kind: 'friday', key: 'f', date: TODAY, time: '17:00' },
      { kind: 'evening', key: 'e', date: TODAY, time: '21:00' },
    ];
    expect(capPerDay(entries).map((e) => e.key)).toEqual(['h1', 'h2', 'h3']);
  });
});

describe('prefs and words', () => {
  it('parses defensively', () => {
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(parseNotificationPrefs({ eveningNudge: true, eveningTime: '20:30', fridayTime: '25:00', x: 1 })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      eveningNudge: true,
      eveningTime: '20:30',
    });
  });

  it('digest words count acts in Arabic forms; no text blames', () => {
    expect(arabicActs(1)).toBe('عمل واحد');
    expect(arabicActs(2)).toBe('عملان');
    expect(NOTIFY_TEXTS.ar.digestBody(5)).toBe('عندك 5 أعمال اليوم');
    expect(NOTIFY_TEXTS.ar.digestBody(12)).toBe('عندك 12 عملًا اليوم');
    expect(NOTIFY_TEXTS.en.digestBody(1)).toBe('You have 1 act today');
    expect(JSON.stringify(NOTIFY_TEXTS)).not.toMatch(/فشل|قصّرت|fail|guilt/i);
  });
});
