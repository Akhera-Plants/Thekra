import { describe, expect, it } from 'vitest';
import {
  addDays,
  createPlan,
  freshStartAction,
  freshStartFor,
  freshStartKey,
  freshStarts,
  logDone,
  type Plan,
} from '../src/index.js';

const T = '2026-10-01T10:00:00.000Z';
const kinds = (date: string, offset = 0) => freshStarts(date, offset).map((s) => s.kind);

describe('freshStarts', () => {
  it('has nothing on an ordinary day (Wednesday 17 Jumada al-Ula 1448)', () => {
    expect(freshStarts('2026-10-28')).toEqual([]);
    expect(freshStarts('2026-11-14')).toEqual([]); // Saturday 4 Jumada al-Akhira
  });

  it('knows Friday and Monday, each its own occasion', () => {
    expect(freshStarts('2026-10-30')).toEqual([{ kind: 'friday', key: 'friday:2026-10-30' }]);
    expect(freshStarts('2026-11-02')).toEqual([{ kind: 'monday', key: 'monday:2026-11-02' }]);
  });

  it('marks the first three days of a Hijri month as one occasion', () => {
    expect(freshStarts('2026-11-11')).toEqual([{ kind: 'month-start', key: 'month-start:1448-6' }]); // 1 Jumada al-Akhira
    expect(kinds('2026-11-12')).toEqual(['month-start']);
    expect(freshStarts('2026-11-13')).toEqual([
      { kind: 'month-start', key: 'month-start:1448-6' },
      { kind: 'friday', key: 'friday:2026-11-13' },
    ]);
  });

  it('puts the ten days of Dhu al-Hijja first, then the month start and the weekday', () => {
    expect(kinds('2026-05-18')).toEqual(['dhul-hijja-ten', 'month-start', 'monday']); // 1 Dhu al-Hijja 1447
    expect(freshStarts('2026-05-27')[0]).toEqual({ kind: 'dhul-hijja-ten', key: 'dhul-hijja-ten:1447' }); // the 10th
    expect(kinds('2026-05-28')).toEqual([]); // the 11th, a Thursday
  });

  it("keeps Sha'ban as one occasion for the whole month", () => {
    expect(kinds('2026-01-20')).toEqual(['shaban', 'month-start']); // 1 Sha'ban 1447
    expect(freshStarts('2026-02-10')[0]).toEqual({ kind: 'shaban', key: 'shaban:1447' });
  });

  it("follows the user's Hijri offset", () => {
    expect(kinds('2026-11-10')).toEqual([]); // 30 Jumada al-Ula
    expect(kinds('2026-11-10', 1)).toEqual(['month-start']); // the local month started a day earlier
    expect(kinds('2026-11-14', -1)).toEqual(['month-start']); // a day later: the 3rd
  });
});

describe('freshStartFor', () => {
  it('shows at most one card: the first occasion not set aside', () => {
    expect(freshStartFor('2026-11-13', 0, [])?.kind).toBe('month-start');
    const monthSetAside = [freshStartKey({ kind: 'month-start', key: 'month-start:1448-6' })];
    expect(freshStartFor('2026-11-13', 0, monthSetAside)?.kind).toBe('friday');
    expect(freshStartFor('2026-11-12', 0, monthSetAside)).toBeNull();
    expect(freshStartFor('2026-10-28', 0, [])).toBeNull();
  });

  it('sets a Friday aside for that Friday only', () => {
    const setAside = [freshStartKey({ kind: 'friday', key: 'friday:2026-10-30' })];
    expect(freshStartFor('2026-10-30', 0, setAside)).toBeNull();
    expect(freshStartFor('2026-11-06', 0, setAside)?.kind).toBe('friday');
  });
});

describe('freshStartAction', () => {
  const START = '2026-09-01';
  const plan = (id: string): Plan =>
    createPlan({ id, deedSlug: 'duha', title: 'الضحى', unit: 'count', amount: 5, activeDaysPerWeek: 7, slots: ['09:30'], createdOn: START }, T);
  const steady = (p: Plan, days: number): Plan => {
    let out = p;
    for (let i = 0; i < days; i++) out = logDone(out, addDays(START, i), 5);
    return out;
  };
  const day28 = addDays(START, 28);

  it('offers a small habit to someone without one', () => {
    expect(freshStartAction([], day28)).toEqual({ kind: 'start' });
  });

  it('offers one step up for a plan that may climb (canIncrease), else only the renewal', () => {
    expect(freshStartAction([plan('young')], day28)).toEqual({ kind: 'renew' });
    expect(freshStartAction([plan('young'), steady(plan('ready'), 28)], day28)).toEqual({ kind: 'increase', planId: 'ready' });
  });
});
