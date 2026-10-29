import { describe, expect, it } from 'vitest';
import {
  addDays,
  afterFall,
  checkIn,
  activePrograms,
  currentStage,
  endProgram,
  exportForSync,
  emptyStore,
  mergePrograms,
  MAX_URGES_PER_DAY,
  notebookDays,
  openPrograms,
  parsePrograms,
  pathFor,
  recordDeedAfterFall,
  recordUrgePassed,
  sealPrograms,
  urgesPassed,
  stagesFor,
  startProgram,
  summary,
  validateCheckIn,
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
    expect(q.checkIns.map(({ updatedAt: _, ...c }) => c)).toEqual([
      { date: '2026-11-02', value: 'weak' },
      { date: '2026-11-03', value: 'fell_repented', note: 'بعد الفجر كان أسهل' },
    ]);
    expect(q.checkIns.every((c) => typeof c.updatedAt === 'string')).toBe(true);
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

describe('endProgram / mergePrograms', () => {
  const T = (h: number) => `2026-11-0${h}T10:00:00.000Z`;
  const base = (at: string) => startProgram({ sinSlug: 'ghiba', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-11-01' }, at);

  it('ending drops check-ins and notes and keeps only a marker; an ended program takes no check-in', () => {
    const p = checkIn(base(T(1)), '2026-11-02', 'held', 'سرّ', T(2));
    const ended = endProgram(p, T(3));
    expect(ended).toEqual({ sinSlug: 'ghiba', category: 'haqq_ibad', path: 'cut', startedOn: '2026-11-01', checkIns: [], updatedAt: T(3), endedAt: T(3) });
    expect(JSON.stringify(ended)).not.toContain('سرّ');
    expect(activePrograms([ended, base(T(1))])).toHaveLength(1);
    expect(() => checkIn(ended, '2026-11-04', 'held')).toThrow(RangeError);
    expect(validateProgram(ended)).toBeNull();
  });

  it('an end beats an older copy (it does not come back), and a later restart beats the end, in either order', () => {
    const old = checkIn(base(T(1)), '2026-11-02', 'held', undefined, T(4));
    const ended = endProgram(base(T(1)), T(5));
    expect(mergePrograms([old], [ended])).toEqual([ended]);
    expect(mergePrograms([ended], [old])).toEqual([ended]);
    const again = base(T(6));
    expect(mergePrograms([ended], [again])).toEqual([again]);
    expect(mergePrograms([again], [ended])).toEqual([again]);
  });

  it('on the same date the later check-in wins with its note, whichever device has more check-ins', () => {
    let many = base(T(1));
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) many = checkIn(many, d, 'held', 'قديم', T(2));
    const edited = checkIn(base(T(1)), '2026-11-03', 'weak', 'تعديل اليوم', T(3));
    for (const merged of [mergePrograms([many], [edited]), mergePrograms([edited], [many])]) {
      expect(merged[0]?.checkIns).toHaveLength(3);
      expect(merged[0]?.checkIns[2]).toMatchObject({ date: '2026-11-03', value: 'weak', note: 'تعديل اليوم' });
    }
  });
});

describe('«أتبِع السيئة الحسنة»: the deed after a fall', () => {
  const T = (h: number) => `2026-11-0${h}T10:00:00.000Z`;
  const p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START }, T(1));

  it('keeps the deed key with that day\'s fell_repented check-in, and the stage logic ignores it', () => {
    const fell = checkIn(p, START, 'fell_repented', 'سرّ', T(2));
    const done = recordDeedAfterFall(fell, START, 'two-rakahs', T(3));
    expect(done.checkIns).toEqual([{ date: START, value: 'fell_repented', note: 'سرّ', updatedAt: T(3), deed: 'two-rakahs' }]);
    expect(validateProgram(done)).toBeNull();
    expect(currentStage(done, addDays(START, 3))).toEqual(currentStage(fell, addDays(START, 3)));
    expect(summary(done, START, START)).toEqual(summary(fell, START, START));
  });

  it('needs a fell_repented check-in that day, a valid key and a running program', () => {
    expect(() => recordDeedAfterFall(p, START, 'dhikr')).toThrow(RangeError);
    expect(() => recordDeedAfterFall(checkIn(p, START, 'held'), START, 'dhikr')).toThrow(RangeError);
    const fell = checkIn(p, START, 'fell_repented');
    expect(() => recordDeedAfterFall(fell, START, 'Free text!')).toThrow(RangeError);
    expect(() => recordDeedAfterFall(endProgram(fell), START, 'dhikr')).toThrow(RangeError);
  });

  it('stays while the day stays fell_repented and goes when the day is changed to another value', () => {
    const done = recordDeedAfterFall(checkIn(p, START, 'fell_repented'), START, 'sadaqa');
    expect(checkIn(done, START, 'fell_repented', 'later').checkIns[0]?.deed).toBe('sadaqa');
    expect(checkIn(done, START, 'held').checkIns[0]?.deed).toBeUndefined();
  });

  it('validates the key and refuses it on another value', () => {
    expect(validateCheckIn({ date: START, value: 'fell_repented', deed: 'dhikr' })).toBeNull();
    expect(validateCheckIn({ date: START, value: 'held', deed: 'dhikr' })).toMatch(/only with fell_repented/);
    expect(validateCheckIn({ date: START, value: 'fell_repented', deed: 'x'.repeat(41) })).toMatch(/kebab-case/);
    expect(validateCheckIn({ date: START, value: 'fell_repented', deed: 'ركعتان' })).toMatch(/kebab-case/);
  });

  it('merges with the check-in: the later written day wins with its deed', () => {
    const fell = checkIn(p, START, 'fell_repented', undefined, T(2));
    const withDeed = recordDeedAfterFall(fell, START, 'dhikr', T(3));
    for (const merged of [mergePrograms([fell], [withDeed]), mergePrograms([withDeed], [fell])]) {
      expect(merged[0]?.checkIns[0]?.deed).toBe('dhikr');
    }
  });
});

describe('«لحظة ضعف عبرتها»: weak moments passed', () => {
  const T = (h: number) => `2026-11-0${h}T10:00:00.000Z`;
  const p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START }, T(1));

  it('counts per date, never as a check-in, and leaves the stage logic alone', () => {
    let q = recordUrgePassed(p, START, T(2));
    q = recordUrgePassed(q, START, T(3));
    q = recordUrgePassed(q, addDays(START, 2), T(4));
    q = recordUrgePassed(q, addDays(START, 1), T(4));
    expect(q.urges).toEqual([
      { date: START, count: 2, updatedAt: T(3) },
      { date: addDays(START, 1), count: 1, updatedAt: T(4) },
      { date: addDays(START, 2), count: 1, updatedAt: T(4) },
    ]);
    expect(q.checkIns).toEqual([]);
    expect(urgesPassed(q, START, addDays(START, 1))).toBe(3);
    expect(urgesPassed(p, START, START)).toBe(0);
    expect(summary(q, START, addDays(START, 6)).daysCheckedIn).toBe(0);
    expect(currentStage(q, addDays(START, 10))).toEqual(currentStage(p, addDays(START, 10)));
    expect(validateProgram(q)).toBeNull();
  });

  it('caps a day and refuses an ended program or a bad date', () => {
    let q = p;
    for (let i = 0; i < MAX_URGES_PER_DAY + 5; i++) q = recordUrgePassed(q, START);
    expect(q.urges?.[0]?.count).toBe(MAX_URGES_PER_DAY);
    expect(() => recordUrgePassed(p, 'today')).toThrow(RangeError);
    expect(() => recordUrgePassed(endProgram(p), START)).toThrow(RangeError);
  });

  it('validates marks', () => {
    expect(validateProgram({ ...p, urges: 'x' })).toMatch(/urges must be an array/);
    expect(validateProgram({ ...p, urges: [{ date: START, count: 0 }] })).toMatch(/count/);
    expect(validateProgram({ ...p, urges: [{ date: 'x', count: 1 }] })).toMatch(/date/);
  });

  it('merges by date with the higher count, the same in either order; ending drops them', () => {
    const a = recordUrgePassed(recordUrgePassed(p, START, T(2)), START, T(3));
    const b = recordUrgePassed(recordUrgePassed(p, START, T(4)), addDays(START, 1), T(5));
    const ab = mergePrograms([a], [b]);
    expect(ab).toEqual(mergePrograms([b], [a]));
    expect(ab[0]?.urges).toEqual([
      { date: START, count: 2, updatedAt: T(4) },
      { date: addDays(START, 1), count: 1, updatedAt: T(5) },
    ]);
    expect(mergePrograms([p], [p])[0]).not.toHaveProperty('urges');
    const ended = endProgram(a, T(6));
    expect(ended).not.toHaveProperty('urges');
    expect(mergePrograms([a], [ended])).toEqual([ended]);
  });
});

describe('new private records stay inside the program (vault only, never the sync body)', () => {
  const key = new Uint8Array(32).fill(7);
  let p = startProgram({ sinSlug: 'secret-sin-slug', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START });
  p = recordDeedAfterFall(checkIn(p, START, 'fell_repented'), START, 'two-rakahs');
  p = recordUrgePassed(p, START);

  it('round-trips parsePrograms and the vault, dropping only invalid marks and deeds', () => {
    expect(parsePrograms([p])).toEqual([p]);
    expect(openPrograms(sealPrograms([p], key), key)).toEqual([p]);
    const dirty = { ...p, urges: [...(p.urges ?? []), { date: 'bad', count: 1 }], checkIns: [...p.checkIns, { date: addDays(START, 1), value: 'held', deed: 'dhikr' }] };
    expect(parsePrograms([dirty])).toEqual([p]);
  });

  it('never reaches the sync payload', () => {
    const payload = JSON.stringify(exportForSync({ ...emptyStore(), programs: [p] }));
    expect(payload).not.toContain('two-rakahs');
    expect(payload).not.toContain('secret-sin-slug');
    expect(payload).not.toContain('urges');
  });
});

describe('notebookDays', () => {
  it('joins check-ins and weak moments by day, newest first, up to today and the limit', () => {
    let p = startProgram({ sinSlug: 'reels', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START });
    p = checkIn(p, START, 'held', 'n1');
    p = recordUrgePassed(recordUrgePassed(p, addDays(START, 1)), addDays(START, 1));
    p = recordUrgePassed(checkIn(p, addDays(START, 2), 'weak'), addDays(START, 2));
    p = checkIn(p, addDays(START, 9), 'held');
    const days = notebookDays(p, addDays(START, 2), 10);
    expect(days.map((d) => [d.date, d.checkIn?.value ?? null, d.urgesPassed])).toEqual([
      [addDays(START, 2), 'weak', 1],
      [addDays(START, 1), null, 2],
      [START, 'held', 0],
    ]);
    expect(notebookDays(p, addDays(START, 2), 2)).toHaveLength(2);
    expect(notebookDays(p, addDays(START, 2), 0)).toEqual([]);
  });
});
