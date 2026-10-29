import { describe, expect, it } from 'vitest';
import {
  LADDER,
  formatPlanAmount,
  formatRakahs,
  rakahsOf,
  addDays,
  adherence,
  adherenceBand,
  canIncrease,
  correctLog,
  createPlan,
  dailyLoad,
  decreaseTo,
  endEbb,
  increase,
  loadWarning,
  logDone,
  mergeLogEntry,
  mergeLogs,
  nextStep,
  normalize,
  relapseSuggestion,
  requiredOn,
  startEbb,
  startSeason,
  startSuggestion,
  status,
  targetDaysIn,
  validatePlan,
  type Plan,
} from '../src/index.js';

const START = '2026-09-01';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({
      id: 'p1',
      deedSlug: 'qiraat-al-quran',
      title: 'قراءة',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 4,
      slots: ['06:00', '21:00'],
      createdOn: START,
    }),
    ...overrides,
  };
}

/** Logs `count` days starting at `from`. */
function withDays(plan: Plan, from: string, count: number, amount = 5): Plan {
  let p = plan;
  for (let i = 0; i < count; i++) p = logDone(p, addDays(from, i), amount);
  return p;
}

describe('ladder and suggestions', () => {
  it('has the lecture ladder', () => {
    expect(LADDER).toEqual([1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 45, 60]);
  });

  it('starts at 2 (far) or 5 (near) minutes', () => {
    expect(startSuggestion('far')).toBe(2);
    expect(startSuggestion('near')).toBe(5);
  });

  it('steps one ladder value at a time', () => {
    expect(nextStep(5)).toBe(7);
    expect(nextStep(7)).toBe(10);
    expect(nextStep(10)).toBe(15);
    expect(nextStep(4)).toBe(5);
    expect(nextStep(0.5)).toBe(1);
    expect(nextStep(60)).toBeNull();
  });

  it('suggests a 60% cut after relapse, on the ladder, at least 1', () => {
    expect(relapseSuggestion(10)).toBe(3);
    expect(relapseSuggestion(20)).toBe(7);
    expect(relapseSuggestion(60)).toBe(20);
    expect(relapseSuggestion(5)).toBe(2);
    expect(relapseSuggestion(2)).toBe(1);
    expect(relapseSuggestion(1)).toBe(1);
  });
});

describe('createPlan / validatePlan', () => {
  it('creates an empty-log plan whose hold clock starts on createdOn', () => {
    const p = makePlan();
    expect(p.log).toEqual({});
    expect(p.amountChangedOn).toBe(START);
    expect('ceiling' in p).toBe(false);
  });

  it('rejects bad fields', () => {
    const base = { id: 'p', deedSlug: 'd', title: 't', unit: 'minutes' as const, amount: 5, slots: ['06:00'], createdOn: START };
    expect(() => createPlan({ ...base, activeDaysPerWeek: 1 })).toThrow(RangeError);
    expect(() => createPlan({ ...base, activeDaysPerWeek: 8 })).toThrow(RangeError);
    expect(() => createPlan({ ...base, activeDaysPerWeek: 3, slots: [] })).toThrow(RangeError);
    expect(() => createPlan({ ...base, activeDaysPerWeek: 3, slots: ['6am'] })).toThrow(RangeError);
    expect(() => createPlan({ ...base, activeDaysPerWeek: 3, amount: 0 })).toThrow(RangeError);
    expect(validatePlan({ ...makePlan(), log: { '2026-09-01': -1 } })).toMatch(/log/);
    expect(validatePlan(makePlan())).toBeNull();
  });
});

describe('increase gating («وحش الزيادة»)', () => {
  const day28 = addDays(START, 28);

  it('is false before 28 days even with a perfect log', () => {
    const p = withDays(makePlan(), START, 27);
    expect(canIncrease(p, addDays(START, 27))).toBe(false);
  });

  it('needs ≥ 75% adherence over the last 28 full days', () => {
    // 4 days/week over 28 days → 16 target days; 12/16 = 0.75.
    expect(canIncrease(withDays(makePlan(), START, 12), day28)).toBe(true);
    expect(canIncrease(withDays(makePlan(), START, 11), day28)).toBe(false);
  });

  it('ignores today (still in progress) when measuring adherence', () => {
    const p = logDone(withDays(makePlan(), START, 11), day28, 5);
    expect(canIncrease(p, day28)).toBe(false);
  });

  it('is false during ebb or season, at the ceiling and at the top of the ladder', () => {
    const ready = withDays(makePlan(), START, 28);
    expect(canIncrease(ready, day28)).toBe(true);
    expect(canIncrease(startEbb(ready, day28), day28)).toBe(false);
    expect(canIncrease(startSeason(ready, 10, addDays(day28, 10)), day28)).toBe(false);
    expect(canIncrease({ ...ready, ceiling: 5 }, day28)).toBe(false);
    expect(canIncrease({ ...ready, amount: 60 }, day28)).toBe(false);
  });

  it('increases exactly one step and restarts the hold clock', () => {
    const ready = withDays(makePlan(), START, 28);
    const up = increase(ready, day28);
    expect(up.amount).toBe(7);
    expect(up.amountChangedOn).toBe(day28);
    expect(canIncrease(withDays(up, day28, 27, 7), addDays(day28, 27))).toBe(false);
    expect(ready.amount).toBe(5); // not mutated
  });

  it('caps a step at the ceiling', () => {
    const ready = withDays(makePlan({ ceiling: 6 }), START, 28);
    expect(increase(ready, day28).amount).toBe(6);
  });

  it('throws when not allowed', () => {
    expect(() => increase(makePlan(), addDays(START, 3))).toThrow();
  });
});

describe('requiredOn: no doubling, ebb, season', () => {
  it('never doubles a missed day', () => {
    const p = makePlan({ amount: 10 });
    // Nothing logged yesterday; today still asks for 10, not 20.
    expect(requiredOn(p, '2026-09-10')).toBe(10);
    expect(requiredOn(logDone(p, '2026-09-09', 3), '2026-09-10')).toBe(10);
  });

  it('asks for a token amount during an ebb (2, or less if the plan is smaller)', () => {
    const p = startEbb(makePlan({ amount: 10 }), '2026-09-10');
    expect(requiredOn(p, '2026-09-09')).toBe(10);
    expect(requiredOn(p, '2026-09-10')).toBe(2);
    expect(requiredOn(startEbb(makePlan({ amount: 1 }), START), START)).toBe(1);
    expect(requiredOn(endEbb(p), '2026-09-10')).toBe(10);
    expect('ebb' in endEbb(p)).toBe(false);
  });

  it('uses the season amount until `until`, then the previous amount, even before normalize', () => {
    const p = startSeason(makePlan({ amount: 10 }), 30, '2027-03-19');
    expect(p.amount).toBe(30);
    expect(p.season).toEqual({ amount: 30, until: '2027-03-19', previous: 10 });
    expect(requiredOn(p, '2027-03-19')).toBe(30);
    expect(requiredOn(p, '2027-03-20')).toBe(10);
  });
});

describe('season auto-return (normalize)', () => {
  it('keeps the season while it lasts and returns without penalty after', () => {
    const base = makePlan({ amount: 10, amountChangedOn: '2026-12-01' });
    const season = startSeason(base, 30, '2027-03-19');
    expect(normalize(season, '2027-03-19').season).toBeDefined();
    const after = normalize(season, '2027-03-20');
    expect(after.amount).toBe(10);
    expect('season' in after).toBe(false);
    expect(after.amountChangedOn).toBe('2026-12-01');
    // The hold clock kept running through the season.
    const logged = withDays(after, '2027-02-20', 28, 10);
    expect(canIncrease(logged, '2027-03-20')).toBe(true);
  });

  it('a nested season keeps the everyday amount as previous', () => {
    const s = startSeason(startSeason(makePlan({ amount: 10 }), 20, '2027-03-01'), 30, '2027-03-19');
    expect(s.season?.previous).toBe(10);
  });
});

describe('logging and adherence', () => {
  it('accumulates partial amounts on the same day («خربانة؟ صلّحها»)', () => {
    const p0 = makePlan();
    const p = logDone(logDone(p0, '2026-09-02', 3), '2026-09-02', 4);
    expect(p.log['2026-09-02']).toBe(7);
    expect(p0.log).toEqual({});
    expect(() => logDone(p0, '2026-09-02', 0)).toThrow(RangeError);
  });

  it('correctLog sets the day (0 clears it) and stamps the correction; validatePlan accepts the cleared day', () => {
    const p = correctLog(logDone(makePlan(), '2026-09-02', 100), '2026-09-02', 10, '2026-09-02T10:00:00.000Z');
    expect(p.log['2026-09-02']).toBe(10);
    expect(p.logCorrectedAt).toEqual({ '2026-09-02': '2026-09-02T10:00:00.000Z' });
    const cleared = correctLog(p, '2026-09-02', 0, '2026-09-02T11:00:00.000Z');
    expect(cleared.log['2026-09-02']).toBe(0);
    expect(validatePlan(cleared)).toBeNull();
    expect(adherence(cleared, '2026-09-02', '2026-09-02')).toBe(0);
    expect(validatePlan({ ...makePlan(), log: { '2026-09-02': 0 } })).not.toBeNull();
    expect(() => correctLog(p, '2026-09-02', -1)).toThrow(RangeError);
    expect(() => correctLog(p, 'x', 1)).toThrow(RangeError);
  });

  it('mergeLogEntry: the later correction wins, else the larger amount; the same answer in either order', () => {
    const plain = { amount: 9 };
    const early = { amount: 3, correctedAt: '2026-09-02T10:00:00.000Z' };
    const late = { amount: 0, correctedAt: '2026-09-02T11:00:00.000Z' };
    expect(mergeLogEntry(plain, early)).toBe(early);
    expect(mergeLogEntry(early, plain)).toBe(early);
    expect(mergeLogEntry(early, late)).toBe(late);
    expect(mergeLogEntry(late, early)).toBe(late);
    expect(mergeLogEntry({ amount: 2 }, { amount: 5 })).toEqual({ amount: 5 });
    expect(mergeLogEntry(undefined, plain)).toBe(plain);
    expect(mergeLogs({ log: { a: 1, b: 4 } }, { log: { b: 2, c: 0 }, logCorrectedAt: { b: '2026-09-02T10:00:00.000Z', c: '2026-09-02T10:00:00.000Z' } })).toEqual({
      log: { a: 1, b: 2, c: 0 },
      logCorrectedAt: { b: '2026-09-02T10:00:00.000Z', c: '2026-09-02T10:00:00.000Z' },
    });
  });

  it('prorates target days', () => {
    const p = makePlan({ activeDaysPerWeek: 5 });
    expect(targetDaysIn(p, '2026-09-01', '2026-09-07')).toBe(5);
    expect(targetDaysIn(p, '2026-09-01', '2026-09-14')).toBe(10);
    expect(targetDaysIn(p, '2026-09-01', '2026-09-03')).toBeCloseTo(15 / 7);
    expect(targetDaysIn(p, '2026-09-03', '2026-09-01')).toBe(0);
  });

  it('counts any amount as a done day, caps at 1, and ignores days before createdOn', () => {
    const p = makePlan({ activeDaysPerWeek: 2 });
    expect(adherence(withDays(p, START, 1, 0.5), START, '2026-09-07')).toBeCloseTo(0.5);
    expect(adherence(withDays(p, START, 7), START, '2026-09-07')).toBe(1);
    expect(adherence(withDays(p, START, 2), '2026-08-01', '2026-09-07')).toBe(1);
    expect(adherence(p, '2026-09-07', '2026-09-01')).toBe(1);
  });

  it('bands without failure words', () => {
    expect(adherenceBand(0.75, 10)).toBe('excellent');
    expect(adherenceBand(0.5, 100)).toBe('good');
    expect(adherenceBand(0.45, 30)).toBe('good');
    expect(adherenceBand(0.45, 90)).toBe('gentle');
    expect(adherenceBand(0, 5)).toBe('gentle');
  });
});

describe('status (relapse)', () => {
  it('is ok for a young plan even with nothing logged', () => {
    expect(status(makePlan(), addDays(START, 7))).toBe('ok');
  });

  it('is relapse after 7 empty days on an older plan', () => {
    const p = logDone(makePlan(), START, 5);
    expect(status(p, addDays(START, 7))).toBe('ok');
    expect(status(p, addDays(START, 8))).toBe('relapse');
    expect(status(logDone(p, addDays(START, 8), 1), addDays(START, 8))).toBe('ok');
  });

  it('decreaseTo applies a relapse suggestion and restarts the hold clock', () => {
    const p = makePlan({ amount: 10 });
    const down = decreaseTo(p, relapseSuggestion(10), '2026-10-01');
    expect(down.amount).toBe(3);
    expect(down.amountChangedOn).toBe('2026-10-01');
    expect(() => decreaseTo(p, 10, '2026-10-01')).toThrow(RangeError);
    const inSeason = decreaseTo(startSeason(p, 30, '2026-10-30'), 5, '2026-10-01');
    expect(inSeason.season?.previous).toBe(5);
    expect(normalize(inSeason, '2026-10-31').amount).toBe(5);
  });
});

describe('daily load', () => {
  const a = makePlan({ id: 'a', amount: 20 });
  const b = makePlan({ id: 'b', amount: 15 });
  const c = makePlan({ id: 'c', unit: 'count', amount: 100 });

  it('sums minutes only, with ebb and season applied on the date', () => {
    expect(dailyLoad([a, b, c], '2026-10-01')).toBe(35);
    expect(dailyLoad([startEbb(a, '2026-10-01'), b, c], '2026-10-01')).toBe(17);
    expect(dailyLoad([startSeason(a, 40, '2026-10-05'), b], '2026-10-01')).toBe(55);
  });

  it('warns when nawafil exceed half of free time', () => {
    expect(loadWarning([a, b, c], 70)).toBe('ok');
    expect(loadWarning([a, b, c], 69)).toBe('over');
    expect(loadWarning([startEbb(a, '2026-10-01'), b], 40, '2026-10-01')).toBe('ok');
    expect(loadWarning([a], 0)).toBe('over');
  });
});

describe('rakah amounts', () => {
  it('keeps Duha even and Witr odd', () => {
    expect([1, 2, 3, 4].map((n) => rakahsOf(n, 'pairs'))).toEqual([2, 4, 6, 8]);
    expect([1, 2, 3, 6].map((n) => rakahsOf(n, 'odd'))).toEqual([1, 3, 5, 11]);
    expect(rakahsOf(0, 'odd')).toBe(0);
    expect(formatPlanAmount(0, 'times', 'ركعة', 'ar', 'odd')).toBe('0 ركعة');
  });

  it('says the count the Arabic way', () => {
    expect([1, 2, 4, 10, 11].map((n) => formatRakahs(n, 'ar'))).toEqual([
      'ركعة واحدة',
      'ركعتان',
      '4 ركعات',
      '10 ركعات',
      '11 ركعة',
    ]);
    expect(formatRakahs(1, 'en')).toBe("1 rak'ah");
    expect(formatRakahs(4, 'en')).toBe("4 rak'ahs");
  });

  it('formats other units from the catalog label', () => {
    expect(formatPlanAmount(2, 'times', 'ركعتان', 'ar', 'pairs')).toBe('4 ركعات');
    expect(formatPlanAmount(10, 'minutes', 'دقيقة', 'ar')).toBe('10 دقيقة');
    expect(formatPlanAmount(1, 'times', 'صدقة', 'ar')).toBe('صدقة');
    expect(formatPlanAmount(2, 'times', 'صدقة', 'ar')).toBe('2 × صدقة');
    expect(formatPlanAmount(3, 'count', '', 'en')).toBe('3');
  });
});
