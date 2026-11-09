import { describe, expect, it } from 'vitest';
import {
  activeSinLoops,
  addHabitLoop,
  addSinLoop,
  applyServerChanges,
  checkIn,
  createPlan,
  createVault,
  currentStreak,
  emptyStore,
  endProgram,
  HABIT_SETTLE_DAYS,
  habitSettlesOn,
  keptDays,
  limitBlock,
  limits,
  localChanges,
  logDone,
  MAX_HABIT_LOOPS,
  MAX_LOOP_TEXT,
  MAX_SIN_LOOPS,
  mergePrograms,
  openPrograms,
  parsePrograms,
  parseStore,
  parseVaultKey,
  pausePlan,
  planFields,
  removeHabitLoop,
  removeSinLoop,
  resumePlan,
  sealVault,
  serializeStore,
  serializeVaultKey,
  startProgram,
  streakDay,
  unlockVault,
  updateHabitLoop,
  updateSinLoop,
  upsertPlan,
  validateHabitLoop,
  validatePlan,
  validateProgram,
  validateSinLoop,
  VaultError,
  type Plan,
  type SinProgram,
  type Store,
} from '../src/index.js';

const T = '2026-11-01T10:00:00.000Z';
const T2 = '2026-11-01T11:00:00.000Z';
const T3 = '2026-11-01T12:00:00.000Z';

const plan = (id: string, createdOn = '2026-10-20', habitKey?: string): Plan =>
  createPlan(
    { id, deedSlug: 'nawafil', title: id, unit: 'count', amount: 2, activeDaysPerWeek: 7, slots: ['09:30'], createdOn, ...(habitKey ? { habitKey } : {}) },
    T,
  );
const storeOf = (...plans: Plan[]): Store => plans.reduce((s, p) => upsertPlan(s, p, T), emptyStore());
const program = (sinSlug: string, startedOn: string): SinProgram =>
  startProgram({ sinSlug, category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn }, T);
const isPeriodicAct = (p: Plan) => p.habitKey === 'sadaqah-weekly';

describe('habit limit: 3 young habits; a habit kept 90 days frees its place', () => {
  it('kept days exclude the pause', () => {
    const p = plan('a', '2026-08-01');
    expect(keptDays(p, '2026-08-01')).toBe(0);
    expect(keptDays(p, '2026-10-30')).toBe(90);
    const paused = pausePlan(p, '2026-09-01', T);
    expect(keptDays(paused, '2026-09-11')).toBe(31); // paused for 10 days, still paused
    const resumed = resumePlan(paused, '2026-09-11', T);
    expect(keptDays(resumed, '2026-10-30')).toBe(80);
    expect(habitSettlesOn(resumed, '2026-10-30')).toBe('2026-11-09');
  });

  it('a 4th habit needs one habit kept 90 days; then the cap grows with every settled habit', () => {
    const s = storeOf(plan('a', '2026-08-03'), plan('b', '2026-09-01'), plan('c', '2026-10-01'));
    expect(limits(s, '2026-10-31').canAdd('sapling')).toBe(false); // a: 89 days
    expect(limitBlock(s, '2026-10-31', 'sapling')).toEqual({
      kind: 'sapling',
      reason: 'habits_young',
      count: 3,
      max: 3,
      unlocksOn: '2026-11-01',
      waitingOn: [
        { id: 'a', settlesOn: '2026-11-01' },
        { id: 'b', settlesOn: '2026-11-30' },
        { id: 'c', settlesOn: '2026-12-30' },
      ],
    });
    const l = limits(s, '2026-11-01');
    expect(l.sapling.count).toBe(2);
    expect(l.canAdd('sapling')).toBe(true);
    expect(limitBlock(s, '2026-11-01', 'sapling')).toBeNull();
    // With a 4th young habit the place is taken again until b settles.
    const four = upsertPlan(s, plan('d', '2026-11-01'), T);
    expect(limitBlock(four, '2026-11-01', 'sapling')?.unlocksOn).toBe('2026-11-30');
  });

  it('several habits over the cap (from another device): unlocks when enough of them settle', () => {
    const s = storeOf(plan('a', '2026-10-01'), plan('b', '2026-10-02'), plan('c', '2026-10-03'), plan('d', '2026-10-04'));
    expect(limitBlock(s, '2026-10-10', 'sapling')?.unlocksOn).toBe('2026-12-31'); // b settles: 2 young left
    expect(HABIT_SETTLE_DAYS).toBe(90);
  });

  it('periodic acts never count toward habits and never enter the streak', () => {
    const weekly = plan('w', '2026-10-25', 'sadaqah-weekly');
    const s = storeOf(plan('a', '2026-10-25'), plan('b', '2026-10-25'), plan('c', '2026-10-25'), weekly);
    const l = limits(s, '2026-10-28', { isPeriodicAct });
    expect(l.sapling.count).toBe(3);
    expect(l.periodic.count).toBe(1);
    expect(limitBlock(s, '2026-10-28', 'periodic', { isPeriodicAct })).toBeNull();
    // Every habit done on 10-27, the periodic act not: the day is complete only without the periodic act.
    const done: Store = { ...s, plans: s.plans.map((p) => (p.id === 'w' ? p : logDone(p, '2026-10-27', 2))) };
    const opts = { now: Date.parse('2027-01-01T00:00:00Z') };
    expect(streakDay(done, '2026-10-27', opts)).toBe('incomplete');
    expect(streakDay(done, '2026-10-27', { ...opts, isPeriodicAct })).toBe('complete');
    expect(currentStreak(done, '2026-10-27', { ...opts, isPeriodicAct })).toBe(1);
  });

  it('periodic acts: 7, freed only by deleting one', () => {
    // Round 6: plans of one catalog act count once, so seven acts = seven of the member's own periodic acts.
    const plans = Array.from({ length: 7 }, (_, i) => plan(`w${i}`, '2026-01-01', 'custom-periodic'));
    expect(limitBlock(storeOf(...plans), '2026-10-28', 'periodic', { isPeriodicAct })).toEqual({
      kind: 'periodic',
      reason: 'periodic_full',
      count: 7,
      max: 7,
      unlocksOn: null,
      waitingOn: [],
    });
  });
});

describe('«تخفَّف» limit: 3 programs, a new one when every running one has lasted 60 days', () => {
  it('waits for the youngest program to reach 60 days', () => {
    const s: Store = { ...emptyStore(), programs: [program('ghibah', '2026-09-01'), program('kadhib', '2026-10-15')] };
    expect(limitBlock(s, '2026-11-01', 'program')).toEqual({
      kind: 'program',
      reason: 'programs_young',
      count: 2,
      max: 3,
      unlocksOn: '2026-12-14',
      waitingOn: [{ id: 'kadhib', settlesOn: '2026-12-14' }],
    });
    expect(limits(s, '2026-12-14').canAdd('program')).toBe(true);
  });

  it('three running programs: only ending one helps; ended programs do not count', () => {
    const three = [program('a', '2026-01-01'), program('b', '2026-01-01'), program('c', '2026-01-01')];
    const s: Store = { ...emptyStore(), programs: three };
    expect(limitBlock(s, '2026-11-01', 'program')).toMatchObject({ reason: 'programs_full', count: 3, unlocksOn: null });
    const ended: Store = { ...s, programs: [endProgram(three[0]!, T), three[1]!, three[2]!] };
    expect(limits(ended, '2026-11-01').program).toEqual({ count: 2, max: 3, full: false });
    expect(limitBlock(ended, '2026-11-01', 'program')).toBeNull();
  });

  it('the first program can always start', () => {
    expect(limits(emptyStore(), '2026-11-01').canAdd('program')).toBe(true);
  });
});

describe('«حلقة العادة» on a plan', () => {
  const loop = { cue: 'بعد صلاة الفجر في المسجد', craving: 'أن أبدأ يومي بالذكر', routine: 'أذكار الصباح', reward: 'طمأنينة', ifThen: 'إن تأخرت فبعد الإفطار' };

  it('add, update, remove keep the plan valid and stamp updatedAt', () => {
    let p = addHabitLoop(plan('a'), 'loop-1', loop, T2);
    expect(p.updatedAt).toBe(T2);
    expect(p.loops).toEqual([{ id: 'loop-1', ...loop, updatedAt: T2 }]);
    expect(validatePlan(p)).toBeNull();
    p = updateHabitLoop(p, 'loop-1', { reward: 'راحة القلب', ifThen: '' }, T3);
    expect(p.loops?.[0]).toEqual({ id: 'loop-1', cue: loop.cue, craving: loop.craving, routine: loop.routine, reward: 'راحة القلب', updatedAt: T3 });
    expect(() => addHabitLoop(p, 'loop-1', loop, T3)).toThrow('exists');
    expect(() => updateHabitLoop(p, 'nope', {}, T3)).toThrow('No loop');
    p = removeHabitLoop(p, 'loop-1', T3);
    expect(p.loops).toBeUndefined();
  });

  it('validates ids, lengths, the routine and the count', () => {
    const ok = { id: 'x', cue: '', craving: '', routine: 'r', reward: '', updatedAt: T };
    expect(validateHabitLoop(ok)).toBeNull();
    expect(validateHabitLoop({ ...ok, id: 'a b' })).toMatch('loop id');
    expect(validateHabitLoop({ ...ok, routine: '  ' })).toMatch('routine');
    expect(validateHabitLoop({ ...ok, cue: 'x'.repeat(MAX_LOOP_TEXT + 1) })).toMatch('cue');
    expect(validateHabitLoop({ ...ok, obstacle: 5 })).toMatch('obstacle');
    expect(validateHabitLoop({ ...ok, updatedAt: 'yesterday' })).toMatch('updatedAt');
    const many = Array.from({ length: MAX_HABIT_LOOPS + 1 }, (_, i) => ({ ...ok, id: `l${i}` }));
    expect(validatePlan({ ...plan('a'), loops: many })).toMatch('at most');
    expect(validatePlan({ ...plan('a'), loops: [ok, ok] })).toMatch('unique');
  });

  it('is in the canonical content only when present, survives the store and the sync round trip', () => {
    const bare = plan('a');
    expect('loops' in planFields(bare)).toBe(false);
    const p = addHabitLoop(bare, 'loop-1', loop, T2);
    expect(planFields(p).loops).toEqual([{ id: 'loop-1', ...loop, updatedAt: T2 }]);
    const s = upsertPlan(emptyStore(), p, T2);
    expect(parseStore(JSON.parse(serializeStore(s))).plans[0]?.loops).toEqual(p.loops);
    // Out with localChanges, back from the server: the same content, acked.
    const wire = localChanges(s).plans[0] as Record<string, unknown>;
    expect(wire.loops).toEqual(p.loops);
    const after = applyServerChanges(s, { serverTime: T3, settings: null, plans: [wire], logs: [], relatives: [], contacts: [] });
    expect(after.plans[0]?.loops).toEqual(p.loops);
    expect(localChanges(after).plans).toEqual([]);
    // A newer server copy without loops (an older client edited the plan) clears them: last writer wins on the plan.
    const older = { ...wire, loops: null, title: 'x', clientUpdatedAt: T3 };
    expect(applyServerChanges(after, { serverTime: T3, settings: null, plans: [older], logs: [], relatives: [], contacts: [] }).plans[0]?.loops).toBeUndefined();
    // An invalid loop from the server drops the item, never the store.
    const bad = { ...wire, loops: [{ id: 'x' }], clientUpdatedAt: T3 };
    expect(applyServerChanges(after, { serverTime: T3, settings: null, plans: [bad], logs: [], relatives: [], contacts: [] }).plans[0]?.loops).toEqual(p.loops);
  });
});

describe('«حلقة المعصية» inside the sin program', () => {
  const answers = { trigger: 'وحدي ليلًا مع الهاتف', feeling: 'ملل', craving: 'هروب', act: 'تصفح', after: 'ندم', alternative: 'أخرج الهاتف من الغرفة' };

  it('add, update and remove (a removal keeps an empty marker)', () => {
    let p = addSinLoop(program('ghibah', '2026-10-01'), 's1', answers, T);
    expect(activeSinLoops(p)).toEqual([{ id: 's1', ...answers, updatedAt: T }]);
    expect(validateProgram(p)).toBeNull();
    p = updateSinLoop(p, 's1', { alternative: 'أتصل بصديق' }, T2);
    expect(activeSinLoops(p)[0]?.alternative).toBe('أتصل بصديق');
    p = removeSinLoop(p, 's1', T3);
    expect(activeSinLoops(p)).toEqual([]);
    expect(p.loops).toEqual([{ id: 's1', trigger: '', feeling: '', craving: '', act: '', after: '', alternative: '', updatedAt: T3, removedAt: T3 }]);
    expect(() => updateSinLoop(p, 's1', {}, T3)).toThrow('No loop');
  });

  it('validates loops and limits them', () => {
    const ok = { id: 's', ...answers, updatedAt: T };
    expect(validateSinLoop(ok)).toBeNull();
    expect(validateSinLoop({ ...ok, trigger: '', feeling: '', craving: '', act: '', after: '', alternative: '' })).toMatch('at least one');
    expect(validateSinLoop({ ...ok, removedAt: T })).toMatch('no text');
    expect(validateSinLoop({ ...ok, act: 'x'.repeat(301) })).toMatch('act');
    let p = program('ghibah', '2026-10-01');
    for (let i = 0; i < MAX_SIN_LOOPS; i++) p = addSinLoop(p, `s${i}`, answers, T);
    expect(() => addSinLoop(p, 'extra', answers, T)).toThrow(`at most ${MAX_SIN_LOOPS}`);
    expect(() => addSinLoop(endProgram(p, T), 'x', answers, T)).toThrow('ended');
    expect(endProgram(p, T).loops).toBeUndefined();
  });

  it('merges by id: the later edit wins, a removal is not undone by an older copy', () => {
    const base = addSinLoop(program('ghibah', '2026-10-01'), 's1', answers, T);
    const phone = removeSinLoop(base, 's1', T3);
    const laptop = addSinLoop(updateSinLoop(base, 's1', { feeling: 'تعب' }, T2), 's2', answers, T2);
    for (const merged of [mergePrograms([phone], [laptop])[0]!, mergePrograms([laptop], [phone])[0]!]) {
      expect(activeSinLoops(merged).map((l) => l.id)).toEqual(['s2']);
      expect(merged.loops?.find((l) => l.id === 's1')?.removedAt).toBe(T3);
    }
  });

  it('a damaged loop is dropped, never the program; the vault keeps loops', () => {
    const p = addSinLoop(checkIn(program('ghibah', '2026-10-01'), '2026-10-02', 'held', undefined, T), 's1', answers, T);
    const parsed = parsePrograms([{ ...p, loops: [...(p.loops ?? []), { id: 'bad id' }] }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.loops).toEqual(p.loops);
    const created = createVault('a strong privacy code', [p]);
    expect(created.payload.version).toBe(0);
    expect(openPrograms(created.payload, created.key)[0]?.loops).toEqual(p.loops);
  });
});

describe('vault always on: create once, keep the key, autosave', () => {
  it('createVault, keep the key record, reseal with the same salt, unlock with the code', () => {
    const p = program('ghibah', '2026-10-01');
    const created = createVault('a strong privacy code', [p]);
    const record = serializeVaultKey(created.key, created);
    const kept = parseVaultKey(record);
    expect(kept.salt).toBe(created.salt);
    const next = sealVault([checkIn(p, '2026-10-02', 'held', undefined, T)], kept, 1);
    expect(next).toMatchObject({ salt: created.salt, iterations: created.iterations, version: 1, kdf: 'pbkdf2-sha256' });
    expect(unlockVault(next, 'a strong privacy code').programs[0]?.checkIns).toHaveLength(1);
    expect(() => parseVaultKey('{')).toThrow(VaultError);
    expect(() => parseVaultKey(JSON.stringify({ ...JSON.parse(record), iterations: 5 }))).toThrow(VaultError);
  });
});
