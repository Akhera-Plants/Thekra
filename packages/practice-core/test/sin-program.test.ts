import { describe, expect, it } from 'vitest';
import {
  addDays,
  afterFall,
  checkIn,
  currentStage,
  pathFor,
  stagesFor,
  startProgram,
  summary,
  validateProgram,
  type SinProgram,
} from '../src/index.js';

const START = '2026-11-01';

function withCheckIns(p: SinProgram, from: string, days: number[]): SinProgram {
  let out = p;
  for (const d of days) out = checkIn(out, addDays(from, d), 'held');
  return out;
}

describe('paths (owner decision 2026-10-28)', () => {
  it('allows gradual only for haqq_allah when leaving at once is very hard', () => {
    expect(pathFor('haqq_allah', true)).toBe('gradual');
    expect(pathFor('haqq_allah', false)).toBe('cut');
    expect(pathFor('haqq_ibad', false)).toBe('cut');
  });

  it('haqq_ibad cannot be gradual, even when the user says it is hard', () => {
    const p = startProgram({ sinSlug: 'ghiba', category: 'haqq_ibad', hardToLeaveAtOnce: true, startedOn: START });
    expect(p.path).toBe('cut');
    expect(validateProgram({ ...p, path: 'gradual' })).toMatch(/cannot be gradual/);
  });

  it('adds restore_rights after limits for haqq_ibad only', () => {
    expect(stagesFor('haqq_allah')).toEqual(['harms', 'alternatives', 'environment', 'limits', 'leave']);
    expect(stagesFor('haqq_ibad')).toEqual(['harms', 'alternatives', 'environment', 'limits', 'restore_rights', 'leave']);
  });

  it('rejects bad input', () => {
    expect(() => startProgram({ sinSlug: '', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START })).toThrow();
    expect(() => startProgram({ sinSlug: 'x', category: 'other' as never, hardToLeaveAtOnce: false, startedOn: START })).toThrow();
    expect(() => startProgram({ sinSlug: 'x', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: 'now' })).toThrow();
  });
});

describe('checkIn', () => {
  const p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: true, startedOn: START });

  it('keeps one entry per date, sorted, notes local', () => {
    let q = checkIn(p, '2026-11-03', 'held', 'بعد الفجر كان أسهل');
    q = checkIn(q, '2026-11-02', 'weak');
    q = checkIn(q, '2026-11-03', 'fell_repented');
    expect(q.checkIns).toEqual([
      { date: '2026-11-02', value: 'weak' },
      { date: '2026-11-03', value: 'fell_repented', note: 'بعد الفجر كان أسهل' },
    ]);
    expect(checkIn(q, '2026-11-03', 'held', 'جديد').checkIns[1]?.note).toBe('جديد');
    expect(p.checkIns).toEqual([]);
  });

  it('rejects invalid values', () => {
    expect(() => checkIn(p, '2026-11-02', 'failed' as never)).toThrow(RangeError);
    expect(() => checkIn(p, '2026-11-31', 'held')).toThrow(RangeError);
  });
});

describe('currentStage', () => {
  const p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START });

  it('stays in the first stage for at least 7 days', () => {
    const q = withCheckIns(p, START, [0, 1, 2, 3, 4, 5]);
    expect(currentStage(q, START)).toEqual({ stage: 'harms', index: 0, since: START });
    expect(currentStage(q, addDays(START, 6)).stage).toBe('harms');
    expect(currentStage(q, addDays(START, 7))).toEqual({ stage: 'alternatives', index: 1, since: addDays(START, 7) });
  });

  it('stays without ≥ 4 check-ins in the last 7 days, and advances once they come', () => {
    const q = withCheckIns(p, START, [0, 1, 2]);
    expect(currentStage(q, addDays(START, 20)).stage).toBe('harms');
    const r = withCheckIns(q, START, [20]);
    // No 7-day window ever holds 4 check-ins: still the first stage, with no penalty.
    expect(currentStage(r, addDays(START, 21)).stage).toBe('harms');
    const s = withCheckIns(p, START, [10, 11, 12, 13]);
    expect(currentStage(s, addDays(START, 13)).stage).toBe('harms');
    expect(currentStage(s, addDays(START, 14))).toEqual({ stage: 'alternatives', index: 1, since: addDays(START, 14) });
  });

  it('counts any check-in value (showing up is what matters)', () => {
    let q = p;
    for (const [d, v] of [[0, 'held'], [1, 'weak'], [2, 'fell_repented'], [3, 'weak']] as const) q = checkIn(q, addDays(START, d), v);
    expect(currentStage(q, addDays(START, 7)).stage).toBe('alternatives');
  });

  it('walks through every stage and stays on leave', () => {
    const daily = withCheckIns(p, START, Array.from({ length: 60 }, (_, i) => i));
    expect(currentStage(daily, addDays(START, 14)).stage).toBe('environment');
    expect(currentStage(daily, addDays(START, 21)).stage).toBe('limits');
    expect(currentStage(daily, addDays(START, 28))).toEqual({ stage: 'leave', index: 4, since: addDays(START, 28) });
    expect(currentStage(daily, addDays(START, 59)).stage).toBe('leave');
  });

  it('haqq_ibad goes through restore_rights before leave', () => {
    const ibad = startProgram({ sinSlug: 'ghiba', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: START });
    const daily = withCheckIns(ibad, START, Array.from({ length: 60 }, (_, i) => i));
    expect(currentStage(daily, addDays(START, 28)).stage).toBe('restore_rights');
    expect(currentStage(daily, addDays(START, 35)).stage).toBe('leave');
  });
});

describe('summary and afterFall', () => {
  it('counts values in range with no streaks', () => {
    let p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START });
    p = checkIn(p, '2026-11-01', 'held');
    p = checkIn(p, '2026-11-02', 'weak');
    p = checkIn(p, '2026-11-03', 'fell_repented');
    p = checkIn(p, '2026-11-04', 'held');
    p = checkIn(p, '2026-11-20', 'held');
    const s = summary(p, '2026-11-01', '2026-11-07');
    expect(s).toEqual({ held: 2, weak: 1, fell_repented: 1, daysCheckedIn: 4, days: 7 });
    expect(Object.keys(s).some((k) => /streak|fail/i.test(k))).toBe(false);
  });

  it('afterFall points to the «خربانة؟ صلّحها» content', () => {
    const p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START });
    expect(afterFall(checkIn(p, START, 'fell_repented'))).toBe('fixit');
  });
});
