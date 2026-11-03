import { describe, expect, it } from 'vitest';
import {
  addPledge,
  applyStep,
  cleanLine,
  createPlan,
  daySummary,
  emptyHeart,
  emptyStore,
  eveningCardVisible,
  HEART_LINE_MAX,
  intentionState,
  keepPledge,
  logMinimum,
  makeIntention,
  markMessageSeen,
  minimumMet,
  minimumToLog,
  muraqabaQuoteId,
  MURAQABA_QUOTE_IDS,
  parseHeart,
  pledgesDue,
  pledgeTrigger,
  previousStep,
  reviewHistory,
  saveEvening,
  saveWeeklyReview,
  selfMessageDue,
  serializeHeart,
  setHeartPrefs,
  stepChoices,
  toggleExcusedDay,
  upsertPlan,
  weeklyReviewDue,
  weekSummary,
  currentStreak,
  type Plan,
  type Store,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';
const FRIDAY = '2026-10-30';

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'x', title: id, unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-10-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

describe('نية اليوم', () => {
  it('is offered once until noon, then a card until made, then one line', () => {
    let data = emptyHeart();
    expect(intentionState(data, '2026-10-28', '07:00')).toBe('offer');
    expect(intentionState(data, '2026-10-28', '12:00')).toBeNull();
    expect(intentionState(setHeartPrefs(data, { intentionOfferDismissed: true }), '2026-10-28', '07:00')).toBeNull();
    data = setHeartPrefs(data, { intention: true });
    expect(intentionState(data, '2026-10-28', '07:00')).toBe('card');
    data = makeIntention(data, { date: '2026-10-28', planIds: ['a', 'a', 'b'], pledge: '  ألا   أغتاب أحدًا  ' });
    expect(intentionState(data, '2026-10-28', '07:00')).toBe('made');
    expect(data.intentions[0]).toEqual({ date: '2026-10-28', planIds: ['a', 'b'], pledge: 'ألا أغتاب أحدًا' });
  });

  it('lines are one line, capped', () => {
    expect(cleanLine('a\n\nb')).toBe('a b');
    expect(cleanLine('   ')).toBeUndefined();
    expect(cleanLine('x'.repeat(500))).toHaveLength(HEART_LINE_MAX);
  });
});

describe('المحاسبة', () => {
  it('evening card: opt-in, after 19:00, until saved', () => {
    let data = emptyHeart();
    expect(eveningCardVisible(data, '2026-10-28', '20:00')).toBe(false);
    data = setHeartPrefs(data, { eveningReview: true });
    expect(eveningCardVisible(data, '2026-10-28', '18:59')).toBe(false);
    expect(eveningCardVisible(data, '2026-10-28', '19:00')).toBe(true);
    data = saveEvening(data, { date: '2026-10-28', kept: 'partly' });
    expect(eveningCardVisible(data, '2026-10-28', '20:00')).toBe(false);
  });

  it('Friday review: due on Friday, and Saturday morning when skipped; never once saved or when off', () => {
    const data = emptyHeart();
    expect(weeklyReviewDue(data, FRIDAY, '08:00')).toBe(FRIDAY);
    expect(weeklyReviewDue(data, '2026-10-31', '09:00')).toBe(FRIDAY);
    expect(weeklyReviewDue(data, '2026-10-31', '13:00')).toBeNull();
    expect(weeklyReviewDue(data, '2026-10-29', '08:00')).toBeNull();
    const saved = saveWeeklyReview(data, { weekOf: FRIDAY, steady: [], weak: [] }, NOW);
    expect(weeklyReviewDue(saved, '2026-10-31', '09:00')).toBeNull();
    expect(weeklyReviewDue(setHeartPrefs(data, { fridayReview: false }), FRIDAY, '08:00')).toBeNull();
  });

  it('the user chooses the evening time and the weekly review day', () => {
    let data = setHeartPrefs(emptyHeart(), { eveningReview: true, eveningFrom: '21:30' });
    expect(eveningCardVisible(data, '2026-10-28', '21:00')).toBe(false);
    expect(eveningCardVisible(data, '2026-10-28', '21:30')).toBe(true);
    // Thursday (4): due on Thursday, and Friday morning when skipped; not on Friday itself any more.
    data = setHeartPrefs(data, { reviewDay: 4 });
    expect(weeklyReviewDue(data, '2026-10-29', '08:00')).toBe('2026-10-29');
    expect(weeklyReviewDue(data, FRIDAY, '09:00')).toBe('2026-10-29');
    expect(weeklyReviewDue(data, FRIDAY, '13:00')).toBeNull();
    // Saturday (6) wraps to Sunday morning.
    data = setHeartPrefs(data, { reviewDay: 6 });
    expect(weeklyReviewDue(data, '2026-11-01', '09:00')).toBe('2026-10-31');
  });

  it('keeps a valid chosen time and day, drops invalid ones', () => {
    const json = JSON.stringify({ ...emptyHeart(), prefs: { eveningFrom: '20:15', reviewDay: 2 } });
    expect(parseHeart(json).prefs).toMatchObject({ eveningFrom: '20:15', reviewDay: 2 });
    const bad = JSON.stringify({ ...emptyHeart(), prefs: { eveningFrom: '25:00', reviewDay: 9 } });
    expect(parseHeart(bad).prefs).toMatchObject({ eveningFrom: '19:00', reviewDay: 5 });
  });

  it('week summary: steady habits and where one weakened, excused days left out', () => {
    const log: Record<string, number> = {};
    for (let d = 24; d <= 30; d++) log[`2026-10-${d}`] = 5;
    const steady = plan('s', { log });
    const weak = plan('w', { log: { '2026-10-24': 5, '2026-10-25': 5 } });
    let store = storeOf(steady, weak);
    store = toggleExcusedDay(store, '2026-10-26', '2026-10-30', NOW);
    const out = weekSummary(store, FRIDAY, FRIDAY);
    expect(out.steady.map((r) => r.planId)).toEqual(['s']);
    expect(out.weak).toEqual([{ planId: 'w', asked: 6, done: 2, missed: 4 }]);
  });

  it('step choices: increase only where allowed; lighten one ladder step', () => {
    const young = plan('a', { amountChangedOn: '2026-10-20' });
    expect(stepChoices(young, FRIDAY)).toEqual(['lighten', 'keep']);
    const log: Record<string, number> = {};
    for (let d = 1; d <= 29; d++) log[`2026-10-${String(d).padStart(2, '0')}`] = 10;
    const ready = plan('b', { log, amountChangedOn: '2026-09-01' });
    expect(stepChoices(ready, FRIDAY)).toEqual(['increase', 'lighten', 'keep']);
    expect(applyStep(ready, 'increase', FRIDAY, NOW).amount).toBe(15);
    expect(applyStep(ready, 'lighten', FRIDAY, NOW).amount).toBe(7);
    expect(applyStep(ready, 'keep', FRIDAY, NOW)).toBe(ready);
    expect(previousStep(1)).toBeNull();
    expect(stepChoices(plan('c', { amount: 1 }), FRIDAY)).toEqual(['keep']);
  });

  it('«رسالة إلى نفسي» shows first the next Friday until read; history newest first', () => {
    let data = saveWeeklyReview(emptyHeart(), { weekOf: '2026-10-23', steady: [], weak: [], message: 'لا تؤجّل الورد', heart: 'middle' }, NOW);
    data = saveWeeklyReview(data, { weekOf: '2026-10-16', steady: [], weak: [] }, NOW);
    expect(selfMessageDue(data, '2026-10-29')).toBeNull();
    expect(selfMessageDue(data, FRIDAY)?.message).toBe('لا تؤجّل الورد');
    data = markMessageSeen(data, '2026-10-23');
    expect(selfMessageDue(data, FRIDAY)).toBeNull();
    expect(reviewHistory(data).map((r) => r.weekOf)).toEqual(['2026-10-23', '2026-10-16']);
  });
});

describe('التزام شخصي', () => {
  // 2026-10-28 18:00 local: yesterday's make-up window (until noon today) has closed.
  const now = new Date(2026, 9, 28, 18, 0).getTime();
  const today = '2026-10-28';

  it('triggers after two asked days in a row with nothing logged, not before the pledge, not on excused days', () => {
    const p = plan('a', { log: { '2026-10-24': 10, '2026-10-25': 10 } });
    let data = setHeartPrefs(emptyHeart(), { pledges: true });
    data = addPledge(data, { id: 'g', planId: 'a', action: 'rakatain', createdOn: '2026-10-24' });
    const pledge = data.pledges[0]!;
    const store = storeOf(p);
    expect(pledgeTrigger(store, pledge, today, { now })).toBe('2026-10-27');
    expect(pledgesDue(store, data, today, { now })).toEqual([{ pledge, on: '2026-10-27' }]);
    expect(pledgesDue(store, keepPledge(data, 'g', '2026-10-27'), today, { now })).toEqual([]);
    expect(pledgesDue(store, setHeartPrefs(data, { pledges: false }), today, { now })).toEqual([]);
    expect(pledgeTrigger(store, { ...pledge, createdOn: '2026-10-27' }, today, { now })).toBeNull();
    const excused = toggleExcusedDay(store, '2026-10-26', today, NOW);
    expect(pledgeTrigger(excused, pledge, today, { now })).toBeNull();
    const excusedLate = toggleExcusedDay(storeOf(plan('a', { log: { '2026-10-25': 10 } })), '2026-10-27', today, NOW);
    expect(pledgeTrigger(excusedLate, pledge, today, { now })).toBeNull();
  });

  it('yesterday is not a miss while it can still be made up; days not asked are passed over', () => {
    const morning = new Date(2026, 9, 28, 9, 0).getTime();
    const p = plan('a', { log: { '2026-10-25': 10 } });
    const pledge = addPledge(emptyHeart(), { id: 'g', planId: 'a', action: 'custom', text: 'أقرأ صفحة زيادة', createdOn: '2026-10-25' }).pledges[0]!;
    expect(pledgeTrigger(storeOf(p), pledge, today, { now: morning })).toBeNull();
    const mondays = plan('m', { rule: { kind: 'weekdays', days: [1] }, log: {} });
    const pm = { ...pledge, planId: 'm', createdOn: '2026-10-01' };
    expect(pledgeTrigger(storeOf(mondays), pm, today, { now })).toBe('2026-10-26');
  });

  it('a custom pledge needs its words; one pledge per habit', () => {
    expect(() => addPledge(emptyHeart(), { id: 'x', planId: 'a', action: 'custom', createdOn: '2026-10-01' })).toThrow();
    let data = addPledge(emptyHeart(), { id: 'x', planId: 'a', action: 'sadaqah', text: '5 دنانير', createdOn: '2026-10-01' });
    data = addPledge(data, { id: 'y', planId: 'a', action: 'rakatain', createdOn: '2026-10-02' });
    expect(data.pledges.map((p) => p.id)).toEqual(['y']);
  });
});

describe('أقل ما يمكن', () => {
  it('logs the heavy-day amount and counts for the streak', () => {
    const p = plan('a');
    expect(minimumToLog(p, '2026-10-28')).toBe(2);
    const after = logMinimum(p, '2026-10-28', '2026-10-28', NOW);
    expect(after.log['2026-10-28']).toBe(2);
    expect(minimumMet(after, '2026-10-28')).toBe(true);
    expect(minimumToLog(after, '2026-10-28')).toBeNull();
    expect(minimumToLog(plan('one', { amount: 1 }), '2026-10-28')).toBeNull();
    expect(logMinimum(after, '2026-10-28', '2026-10-28', NOW)).toBe(after);
    const store = storeOf(after);
    expect(currentStreak(store, '2026-10-28', { now: new Date(2026, 9, 28, 20).getTime() })).toBe(1);
    expect(daySummary(store, '2026-10-28').done.map((x) => x.id)).toEqual(['a']);
  });
});

describe('storage and المراقبة', () => {
  it('round-trips and drops what is invalid', () => {
    let data = setHeartPrefs(emptyHeart(), { intention: true, pledges: true });
    data = makeIntention(data, { date: '2026-10-28', planIds: ['a'], pledge: 'x' });
    data = saveWeeklyReview(data, { weekOf: FRIDAY, steady: [{ planId: 'a', title: 'A', missed: 0 }], weak: [], step: { planId: 'a', choice: 'keep' }, heart: 'present' }, NOW);
    data = addPledge(data, { id: 'g', planId: 'a', action: 'sadaqah', createdOn: '2026-10-01' });
    expect(parseHeart(serializeHeart(data))).toEqual(data);
    expect(parseHeart('{bad')).toEqual(emptyHeart());
    expect(parseHeart({ v: 1, intentions: [{ date: 'x' }], weekly: [{ weekOf: FRIDAY }], pledges: [{ id: 'z', planId: 'a', action: 'penalty', createdOn: FRIDAY }] })).toEqual(emptyHeart());
  });

  it('rotates one published id a day', () => {
    const ids = new Set([0, 1, 2].map((i) => muraqabaQuoteId(`2026-10-${28 + i}`)));
    expect(ids.size).toBe(MURAQABA_QUOTE_IDS.length);
    expect(muraqabaQuoteId('2026-10-28', [])).toBeNull();
  });
});

describe('«التزام شخصي»: deeds that wipe out sins', () => {
  it('lists at least ten deeds plus sadaqah and a custom line, each deed titled with its evidence', async () => {
    const { PLEDGE_DEED_INFO, PLEDGE_DEEDS, PLEDGE_ACTIONS } = await import('../src/index.js');
    expect(PLEDGE_DEED_INFO.map((d) => d.key)).toEqual([...PLEDGE_DEEDS]);
    expect(PLEDGE_DEEDS.length).toBeGreaterThanOrEqual(10);
    expect(PLEDGE_ACTIONS).toContain('sadaqah');
    expect(PLEDGE_ACTIONS).toContain('custom');
    for (const d of PLEDGE_DEED_INFO) {
      expect(d.titleAr && d.titleEn && d.evidence.textAr && d.evidence.textEn && d.evidence.sourceAr && d.evidence.sourceEn).toBeTruthy();
    }
  });
});
