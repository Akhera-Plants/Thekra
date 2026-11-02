/**
 * Owner round 3 (docs/plan/2026-11-01-owner-round-3.md), the pure parts of the app: the loop builder's checks
 * (item 17), the tasbih arithmetic and «وردك الأدنى» (item 15), the limit sheet's words (item 16), the commitment
 * rate per habit (item 9), the 60% rule of «عملك المعتاد يُكتب لك» (item 8) and the rotating «تمّ وردك اليوم» line
 * (item 4).
 */

import {
  addHabitLoop,
  addSinLoop,
  createPlan,
  limitBlock,
  logDone,
  emptyStore,
  removeSinLoop,
  startEbb,
  startProgram,
  toggleExcusedDay,
  updateHabitLoop,
  type LimitBlock,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import {
  HABIT_LOOP_STEPS,
  SIN_LOOP_STEPS,
  canAddLoop,
  canLeaveStep,
  draftOf,
  habitLoopInput,
  loopLines,
  loopProblem,
  sinLoopInput,
  sinLoops,
} from '../lib/practice/loops';
import { isTasbihRound, minimumRows, mujahadaPassage, tasbihReward } from '../lib/practice/mujahada';
import { limitMessage } from '../lib/practice/limit-message';
import { commitmentRates, meanCommitment, planCommitment, showUsualDeed, usualDeedShown } from '../lib/practice/commitment';
import { DAY_DONE_LINES, dayDoneLineIndex, dayDoneLineKey } from '../lib/practice/day-done';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

const NOW = '2026-11-02T08:00:00.000Z';

function plan(id: string, createdOn: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'dhikr', title: id, unit: 'minutes', amount: 5, activeDaysPerWeek: 7, slots: ['06:00'], createdOn }, NOW),
    ...extra,
  };
}

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

describe('loop builder (item 17)', () => {
  it('asks six questions each; only the habit routine is required', () => {
    expect(HABIT_LOOP_STEPS.map((s) => s.field)).toEqual(['cue', 'craving', 'routine', 'reward', 'obstacle', 'ifThen']);
    expect(HABIT_LOOP_STEPS.filter((s) => !s.optional).map((s) => s.field)).toEqual(['routine']);
    expect(SIN_LOOP_STEPS.map((s) => s.field)).toEqual(['trigger', 'feeling', 'craving', 'act', 'after', 'alternative']);
    expect(SIN_LOOP_STEPS.every((s) => s.optional)).toBe(true);
  });

  it('a step may be left only with an allowed answer', () => {
    const routine = HABIT_LOOP_STEPS[2]!;
    expect(canLeaveStep('habit', routine, '')).toBe(false);
    expect(canLeaveStep('habit', routine, '   ')).toBe(false);
    expect(canLeaveStep('habit', routine, 'أقرأ صفحة')).toBe(true);
    expect(canLeaveStep('habit', HABIT_LOOP_STEPS[0]!, '')).toBe(true);
    expect(canLeaveStep('sin', SIN_LOOP_STEPS[0]!, 'x'.repeat(301))).toBe(false);
  });

  it('checks the whole draft before saving', () => {
    expect(loopProblem('habit', { cue: 'بعد الفجر' })).toBe('routine');
    expect(loopProblem('habit', { routine: 'أقرأ صفحة' })).toBeNull();
    expect(loopProblem('sin', {})).toBe('empty');
    expect(loopProblem('sin', { feeling: 'ملل' })).toBeNull();
    expect(loopProblem('sin', { feeling: 'x'.repeat(400) })).toBe('tooLong');
  });

  it('saves a habit loop through practice-core and edits it back (an emptied answer is cleared)', () => {
    const draft = { cue: ' بعد الفجر ', craving: 'قربٌ من الله', routine: 'أقرأ صفحة', reward: 'طمأنينة', obstacle: 'النوم', ifThen: '' };
    let p = addHabitLoop(plan('p1', '2026-10-01'), 'loop-1', habitLoopInput(draft), NOW);
    expect(p.loops).toHaveLength(1);
    expect(p.loops![0]).toMatchObject({ cue: 'بعد الفجر', routine: 'أقرأ صفحة', obstacle: 'النوم' });
    expect(p.loops![0]!.ifThen).toBeUndefined();
    expect(loopLines('habit', p.loops![0]!).map((l) => l.field)).toEqual(['cue', 'craving', 'routine', 'reward', 'obstacle']);
    const edited = { ...draftOf(p.loops![0]!), obstacle: '' };
    p = updateHabitLoop(p, 'loop-1', habitLoopInput(edited), NOW);
    expect(p.loops![0]!.obstacle).toBeUndefined();
    expect(canAddLoop('habit', 4)).toBe(true);
    expect(canAddLoop('habit', 5)).toBe(false);
  });

  it('saves a sin loop on the program and hides a removed one', () => {
    let program = startProgram({ sinSlug: 'ghiba', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, NOW);
    program = addSinLoop(program, 's1', sinLoopInput({ trigger: 'مجلس', alternative: 'أذكر محاسنه' }), NOW);
    expect(sinLoops(program)).toHaveLength(1);
    program = removeSinLoop(program, 's1', NOW);
    expect(sinLoops(program)).toHaveLength(0);
    expect(program.loops).toHaveLength(1); // the marker stays for the merge
  });
});

describe('tasbih and «وردك الأدنى» (item 15)', () => {
  it('each count is written ten times up to seven hundred times', () => {
    expect(tasbihReward(0)).toEqual({ count: 0, min: 0, max: 0 });
    expect(tasbihReward(1)).toEqual({ count: 1, min: 10, max: 700 });
    expect(tasbihReward(33)).toEqual({ count: 33, min: 330, max: 23100 });
    expect(tasbihReward(-3).count).toBe(0);
    expect(isTasbihRound(33)).toBe(true);
    expect(isTasbihRound(34)).toBe(false);
    expect(isTasbihRound(0)).toBe(false);
  });

  it('rotates the verse passages and keeps a passage whole', () => {
    const verses = [['a'], ['b', 'c'], ['d']];
    const first = mujahadaPassage(verses, '2026-11-02', 0);
    const later = mujahadaPassage(verses, '2026-11-02', 120);
    expect(first).not.toBeNull();
    expect(later).not.toEqual(first);
    expect(verses).toContainEqual(later);
    expect(mujahadaPassage([], '2026-11-02', 0)).toBeNull();
    expect(mujahadaPassage(undefined, '2026-11-02', 0)).toBeNull();
  });

  it('offers a smaller amount for each open habit, and the sitting prayer for a prayer habit', () => {
    const quran = plan('q', '2026-10-01', { amount: 10, deedSlug: 'quran' });
    const done = logDone(plan('d', '2026-10-01'), '2026-11-02', 5);
    const items = [
      { kind: 'habit' as const, planId: 'q', required: 10, done: 0, remaining: 10, complete: false },
      { kind: 'habit' as const, planId: 'd', required: 5, done: 5, remaining: 0, complete: true },
    ];
    const rows = minimumRows(items, [quran, done], [], '2026-11-02');
    expect(rows.map((r) => r.planId)).toEqual(['q']);
    expect(rows[0]!.amount).toBeGreaterThan(0);
    expect(rows[0]!.amount).toBeLessThan(10);
    expect(rows[0]!.prayer).toBe(false);
  });
});

describe('limit sheet words (item 16)', () => {
  const fmt = (d: string) => `<${d}>`;

  it('says why, with the unlock day when it unlocks by itself', () => {
    const young: LimitBlock = { kind: 'sapling', reason: 'habits_young', count: 3, max: 3, unlocksOn: '2027-01-10', waitingOn: [] };
    expect(limitMessage(young, fmt)).toEqual({ key: 'practice.limits.why.habits_young', params: { count: 3, max: 3, date: '<2027-01-10>' } });
    const full: LimitBlock = { kind: 'program', reason: 'programs_full', count: 3, max: 3, unlocksOn: null, waitingOn: [] };
    expect(limitMessage(full, fmt).key).toBe('practice.limits.why.programs_fullNoDate');
  });

  it('every reason has its words in both languages', () => {
    for (const reason of ['habits_young', 'programs_young', 'habits_youngNoDate', 'programs_youngNoDate', 'programs_fullNoDate', 'periodic_fullNoDate']) {
      expect(typeof lookup(ar, `practice.limits.why.${reason}`)).toBe('string');
      expect(typeof lookup(en, `practice.limits.why.${reason}`)).toBe('string');
    }
  });

  it('a fourth young habit is refused with the day the first one settles', () => {
    const store: Store = { ...emptyStore(), plans: [plan('a', '2026-10-01'), plan('b', '2026-10-15'), plan('c', '2026-11-01')] };
    const block = limitBlock(store, '2026-11-02', 'sapling');
    expect(block?.reason).toBe('habits_young');
    expect(limitMessage(block!, (d) => d).params.date).toBe('2026-12-30');
  });
});

describe('commitment (items 8 and 9)', () => {
  function withLog(p: Plan, days: string[]): Plan {
    return days.reduce((acc, d) => logDone(acc, d, 5), p);
  }
  const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

  it('rates each habit over the 30 full days before today; a habit started today has none', () => {
    const steady = withLog(plan('a', '2026-09-01'), days(3, 31)); // 29 of 30 days (2026-10-03 … 2026-10-31; window 10-03 … 11-01)
    const fresh = plan('b', '2026-11-02');
    const store: Store = { ...emptyStore(), plans: [steady, fresh] };
    const rates = commitmentRates(store, '2026-11-02');
    expect(rates.map((r) => r.planId)).toEqual(['a']);
    expect(rates[0]!.percent).toBe(97);
    expect(planCommitment(fresh, '2026-11-02')).toBeNull();
    expect(meanCommitment([])).toBeNull();
  });

  it('shows «عملك المعتاد يُكتب لك» only the day after an excuse, and only above 60%', () => {
    expect(usualDeedShown(true, 0.61)).toBe(true);
    expect(usualDeedShown(true, 0.6)).toBe(false);
    expect(usualDeedShown(false, 0.95)).toBe(false);
    expect(usualDeedShown(true, null)).toBe(false);

    const kept = withLog(plan('a', '2026-09-01'), days(1, 30));
    let store: Store = { ...emptyStore(), plans: [kept] };
    // Not on the day the excuse is tapped.
    store = toggleExcusedDay(store, '2026-11-02', '2026-11-02');
    expect(showUsualDeed(store, '2026-11-02')).toBe(false);
    // The next day, with a high commitment before it.
    expect(showUsualDeed(store, '2026-11-03')).toBe(true);
    // A low commitment: not shown.
    const thin = withLog(plan('a', '2026-09-01'), days(1, 5));
    const low = toggleExcusedDay({ ...emptyStore(), plans: [thin] }, '2026-11-02', '2026-11-02');
    expect(showUsualDeed(low, '2026-11-03')).toBe(false);
    // «يومي ثقيل» yesterday counts as an excuse.
    const heavy: Store = { ...emptyStore(), plans: [startEbb(kept, '2026-11-02', NOW)] };
    expect(showUsualDeed(heavy, '2026-11-03')).toBe(true);
  });
});

describe('«تمّ وردك اليوم» line (item 4)', () => {
  it('one line all day, another the next day, every line in both languages', () => {
    expect(dayDoneLineIndex('2026-11-02')).toBe(dayDoneLineIndex('2026-11-02'));
    expect(dayDoneLineIndex('2026-11-03')).not.toBe(dayDoneLineIndex('2026-11-02'));
    const seen = new Set(Array.from({ length: DAY_DONE_LINES }, (_, i) => dayDoneLineIndex(`2026-11-${String(i + 1).padStart(2, '0')}`)));
    expect(seen.size).toBe(DAY_DONE_LINES);
    for (let i = 0; i < DAY_DONE_LINES; i++) {
      expect(typeof lookup(ar, `practice.celebrate.lines.${i}`)).toBe('string');
      expect(typeof lookup(en, `practice.celebrate.lines.${i}`)).toBe('string');
    }
    expect(dayDoneLineKey('2026-11-02')).toMatch(/^practice\.celebrate\.lines\.\d$/);
  });
});
