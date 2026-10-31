import { describe, expect, it } from 'vitest';
import {
  addDays,
  alternativePlan,
  annotateCheckIn,
  checkIn,
  createPlan,
  endProgram,
  focusProgram,
  formatCountdown,
  genericLimitFor,
  hopeTextId,
  limitChoices,
  limitForToday,
  mergePrograms,
  parsePrograms,
  pausePlan,
  programCounters,
  recordWavePassed,
  sanitizeCheckIn,
  stageTrack,
  startProgram,
  suggestedLimit,
  urgeProgress,
  urgeTextIds,
  urgeTextIndex,
  validateCheckIn,
  weakPattern,
  type SinProgram,
  type Triggers,
} from '../src/index.js';

const START = '2026-11-01';
const NOW = '2026-11-01T10:00:00.000Z';
const base = (slug = 'waqt-tawasul', startedOn = START): SinProgram =>
  startProgram({ sinSlug: slug, category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn }, NOW);

describe('triggers on a check-in (model, validators, migration)', () => {
  it('stores chips after a weak day and drops them when the day becomes «ثبتّ»', () => {
    let p = checkIn(base(), START, 'weak', undefined, NOW);
    p = annotateCheckIn(p, START, { triggers: { when: 'after_isha', where: 'alone', feeling: 'boredom' } }, NOW);
    expect(p.checkIns[0]?.triggers).toEqual({ when: 'after_isha', where: 'alone', feeling: 'boredom' });
    p = checkIn(p, START, 'fell_repented', undefined, NOW);
    expect(p.checkIns[0]?.triggers?.when).toBe('after_isha');
    p = checkIn(p, START, 'held', undefined, NOW);
    expect(p.checkIns[0]?.triggers).toBeUndefined();
  });

  it('refuses chips on a held day, unknown chips and a check-in that does not exist', () => {
    const held = checkIn(base(), START, 'held', undefined, NOW);
    expect(() => annotateCheckIn(held, START, { triggers: { where: 'alone' } })).toThrow(RangeError);
    expect(() => annotateCheckIn(held, addDays(START, 1), { goodDeed: true })).toThrow(RangeError);
    const weak = checkIn(base(), START, 'weak', undefined, NOW);
    expect(() => annotateCheckIn(weak, START, { triggers: { where: 'moon' } as unknown as Triggers })).toThrow(RangeError);
    expect(validateCheckIn({ date: START, value: 'held', triggers: { where: 'alone' } })).toMatch(/only follow/);
    expect(validateCheckIn({ date: START, value: 'weak', nextLimit: 'action:7' })).toBeNull();
    expect(validateCheckIn({ date: START, value: 'weak', nextLimit: 'anything' })).toMatch(/nextLimit/);
  });

  it('empty chips clear the triggers; goodDeed and nextLimit can be set and cleared', () => {
    let p = checkIn(base(), START, 'fell_repented', undefined, NOW);
    p = annotateCheckIn(p, START, { triggers: { feeling: 'stress' }, goodDeed: true, nextLimit: 'phone_outside_room' }, NOW);
    expect(p.checkIns[0]).toMatchObject({ goodDeed: true, nextLimit: 'phone_outside_room', triggers: { feeling: 'stress' } });
    p = annotateCheckIn(p, START, { triggers: {}, goodDeed: false, nextLimit: null }, NOW);
    expect(p.checkIns[0]?.triggers).toBeUndefined();
    expect(p.checkIns[0]?.goodDeed).toBeUndefined();
    expect(p.checkIns[0]?.nextLimit).toBeUndefined();
  });

  it('migrates stored programs: missing = none, bad parts dropped without losing the day', () => {
    const raw = [
      {
        ...base(),
        checkIns: [
          { date: START, value: 'held' },
          { date: addDays(START, 1), value: 'weak', triggers: { when: 'noon', where: 'alone', extra: 1 }, goodDeed: 'yes', nextLimit: 'x' },
          { date: addDays(START, 2), value: 'held', triggers: { where: 'alone' } },
        ],
      },
    ];
    const [p] = parsePrograms(raw);
    expect(p?.checkIns).toHaveLength(3);
    expect(p?.checkIns[0]?.triggers).toBeUndefined();
    expect(p?.checkIns[1]).toEqual({ date: addDays(START, 1), value: 'weak', triggers: { where: 'alone' } });
    expect(p?.checkIns[2]?.triggers).toBeUndefined();
    expect(sanitizeCheckIn(null)).toBeNull();
  });

  it('details travel with the check-in when two copies merge (later write wins by date)', () => {
    const a = checkIn(base(), START, 'weak', undefined, '2026-11-01T10:00:00.000Z');
    const b = annotateCheckIn(a, START, { triggers: { where: 'outside' } }, '2026-11-01T11:00:00.000Z');
    expect(mergePrograms([a], [b])[0]?.checkIns[0]?.triggers).toEqual({ where: 'outside' });
  });
});

describe('«لحظة ضعف»', () => {
  it('counts ten minutes down and never goes past the end or before the start', () => {
    expect(urgeProgress(0, 0)).toEqual({ remaining: 600, fraction: 0, done: false });
    expect(urgeProgress(0, 300_000).fraction).toBeCloseTo(0.5);
    expect(urgeProgress(0, 700_000)).toEqual({ remaining: 0, fraction: 1, done: true });
    expect(urgeProgress(10_000, 0).remaining).toBe(600);
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('rotates one text every two minutes, starting differently each day', () => {
    expect(urgeTextIndex(0, START, 0)).toBe(-1);
    const first = urgeTextIndex(3, START, 0);
    expect(urgeTextIndex(3, START, 119)).toBe(first);
    expect(urgeTextIndex(3, START, 120)).toBe((first + 1) % 3);
    expect(urgeTextIndex(3, addDays(START, 1), 0)).toBe((first + 1) % 3);
  });

  it('uses the program texts then the common ones, and only the common ones without a program', () => {
    expect(urgeTextIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(urgeTextIds(undefined, ['c'])).toEqual(['c']);
  });

  it('focuses on the latest active program before its last stage', () => {
    const old = base('a', '2026-01-01');
    const fresh = base('b', '2026-10-30');
    const ended = endProgram(base('c', '2026-10-31'), NOW);
    expect(focusProgram([old, fresh, ended], '2026-10-31')?.sinSlug).toBe('b');
    expect(focusProgram([], START)).toBeNull();
  });

  it('«عبرت الموجة» records «ثبتّ» only on a day with no check-in', () => {
    const p = recordWavePassed(base(), START, NOW);
    expect(p.checkIns).toEqual([{ date: START, value: 'held', updatedAt: NOW }]);
    const fell = checkIn(base(), START, 'fell_repented', undefined, NOW);
    expect(recordWavePassed(fell, START)).toBe(fell);
  });
});

describe('no-reset counters', () => {
  it('counts held days in the last 30 and days since the last repentance, never resetting the first', () => {
    let p = base('x', '2026-10-01');
    for (let i = 0; i < 10; i++) p = checkIn(p, addDays('2026-10-20', i), 'held', undefined, NOW);
    p = checkIn(p, '2026-10-25', 'fell_repented', undefined, NOW);
    const c = programCounters(p, '2026-10-31');
    expect(c.held).toBe(9);
    expect(c.daysSinceRepentance).toBe(6);
    expect(c.fromStart).toBe(false);
    expect(programCounters(base('x', '2026-10-21'), '2026-10-31')).toMatchObject({ held: 0, daysSinceRepentance: 10, fromStart: true });
  });

  it('a held day older than 30 days leaves the window', () => {
    const p = checkIn(base('x', '2026-09-01'), '2026-09-01', 'held', undefined, NOW);
    expect(programCounters(p, '2026-10-01').held).toBe(0);
    expect(programCounters(p, '2026-09-30').held).toBe(1);
  });

  it('picks one hope text per day', () => {
    expect(hopeTextId([], START)).toBeNull();
    expect(hopeTextId(['a', 'b'], START)).toBe(hopeTextId(['a', 'b'], START));
    expect(hopeTextId(['a', 'b'], START)).not.toBe(hopeTextId(['a', 'b'], addDays(START, 1)));
  });
});

describe('«متى تضعف؟»', () => {
  function tagged(n: number, t: Triggers, from = START, value: 'weak' | 'fell_repented' = 'weak'): SinProgram {
    let p = base();
    for (let i = 0; i < n; i++) {
      const d = addDays(from, i);
      p = checkIn(p, d, value, undefined, NOW);
      p = annotateCheckIn(p, d, { triggers: t }, NOW);
    }
    return p;
  }

  it('waits for 14 check-ins with chips', () => {
    expect(weakPattern(tagged(13, { where: 'alone' }))).toBeNull();
    expect(weakPattern(tagged(14, { where: 'alone' }))).toMatchObject({ count: 14, where: 'alone', when: null, feeling: null });
  });

  it('finds the most frequent of each, ignoring held days and untagged days', () => {
    let p = tagged(10, { when: 'after_isha', where: 'alone', feeling: 'boredom' });
    for (let i = 10; i < 15; i++) {
      const d = addDays(START, i);
      p = checkIn(p, d, 'fell_repented', undefined, NOW);
      p = annotateCheckIn(p, d, { triggers: { when: 'late_night', feeling: 'stress' } }, NOW);
    }
    p = checkIn(p, addDays(START, 20), 'held', undefined, NOW);
    p = checkIn(p, addDays(START, 21), 'weak', undefined, NOW);
    expect(weakPattern(p)).toEqual({ count: 15, when: 'after_isha', where: 'alone', feeling: 'boredom' });
  });

  it('suggests one limit from the triggers, else the program step, else the phone', () => {
    expect(suggestedLimit({ when: 'after_isha', where: 'alone', feeling: null }, 3)).toBe('phone_outside_room');
    expect(suggestedLimit({ when: 'dhuhr_asr', where: 'outside', feeling: null }, 3)).toBe('plan_before_going_out');
    expect(suggestedLimit({ when: null, where: null, feeling: 'anger' }, 3)).toBe('wudu_when_angry');
    expect(suggestedLimit({ when: 'fajr_morning', where: null, feeling: null }, 3)).toBe('action:0');
    expect(suggestedLimit({ when: null, where: null, feeling: null }, 0)).toBe('phone_outside_room');
    expect(genericLimitFor({ when: 'late_night' })).toBe('phone_outside_room');
  });
});

describe('«خربانة؟ صلّحها»', () => {
  it('offers the program steps first, then the generic limit for today, without repeats', () => {
    expect(limitChoices(2, { where: 'outside' })).toEqual(['action:0', 'action:1', 'plan_before_going_out', 'phone_outside_room', 'stay_near_people']);
    expect(limitChoices(0, undefined)).toEqual(['phone_outside_room', 'stay_near_people', 'plan_free_time']);
  });

  it("shows yesterday's limit today only", () => {
    let p = checkIn(base(), START, 'fell_repented', undefined, NOW);
    p = annotateCheckIn(p, START, { nextLimit: 'action:1' }, NOW);
    expect(limitForToday(p, addDays(START, 1))).toBe('action:1');
    expect(limitForToday(p, START)).toBeNull();
    expect(limitForToday(p, addDays(START, 2))).toBeNull();
  });

  it('finds a live plan of an alternative habit and its minimum', () => {
    const plan = createPlan(
      { id: 'p1', habitKey: 'quran-wird', deedSlug: 'quran', title: 'ورد', unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['07:00'], createdOn: START },
      NOW,
    );
    expect(alternativePlan([plan], ['adhkar', 'quran-wird'])).toEqual({ plan, minimum: 2 });
    expect(alternativePlan([pausePlan(plan, START, NOW)], ['quran-wird'])).toBeNull();
    expect(alternativePlan([plan], ['other'])).toBeNull();
  });
});

describe('stages as a line', () => {
  it('marks done, current and next', () => {
    expect(stageTrack(base(), START).map((s) => s.state)).toEqual(['current', 'next', 'next', 'next', 'next']);
    let p = base();
    for (let i = 0; i < 7; i++) p = checkIn(p, addDays(START, i), 'held', undefined, NOW);
    expect(stageTrack(p, addDays(START, 7)).map((s) => s.state)).toEqual(['done', 'current', 'next', 'next', 'next']);
  });
});

describe('screen helpers', () => {
  it('picks the moment program from a hand-off, and nothing for a sin the user does not follow', async () => {
    const { momentProgram } = await import('../src/index.js');
    const a = base('a', '2026-10-01');
    const b = base('b', '2026-10-20');
    expect(momentProgram([a, b], undefined, '2026-10-21')?.sinSlug).toBe('b');
    expect(momentProgram([a, b], 'a', '2026-10-21')?.sinSlug).toBe('a');
    expect(momentProgram([a, b], 'c', '2026-10-21')).toBeNull();
  });

  it('resolves limits and picks the short and hope texts', async () => {
    const { resolveLimit, shortestTextId, hopeTextFor } = await import('../src/index.js');
    expect(resolveLimit('action:1', ['x', 'y'])).toEqual({ kind: 'action', text: 'y' });
    expect(resolveLimit('action:3', ['x'])).toBeNull();
    expect(resolveLimit('sleep_early', [])).toEqual({ kind: 'generic', key: 'sleep_early' });
    const texts = [{ id: '1', textAr: 'نص أطول من غيره' }, { id: '2', textAr: 'قصير' }];
    expect(shortestTextId(['1', '2', '9'], texts)).toBe('2');
    expect(hopeTextFor(['1', '2'], texts, START, '2')).toBe('1');
    expect(hopeTextFor(['9'], texts, START, null)).toBeNull();
  });
});
