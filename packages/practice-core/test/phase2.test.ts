import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyServerChanges,
  canExcuse,
  canMakeUp,
  correctLog,
  countsOn,
  createPlan,
  createRelative,
  currentStreak,
  dayAgenda,
  dueList,
  emptyStore,
  establishPlan,
  graduationReady,
  isExcused,
  isPaused,
  isPausedOn,
  isRelativeOpen,
  LIMITS,
  limits,
  localChanges,
  logContact,
  logDone,
  logForDay,
  longestStreak,
  makeUpDeadline,
  MAX_EXCUSED_DAYS,
  parseStore,
  pausePlan,
  periodicActs,
  planAsksOn,
  planFields,
  relativeFields,
  reminderSlots,
  resumePlan,
  settingsContent,
  sickRule,
  startEbb,
  startProgram,
  streakDay,
  streakDisplay,
  toggleExcusedDay,
  unestablishPlan,
  upsertPlan,
  upsertRelative,
  validatePlan,
  validateRelative,
  type Plan,
  type Store,
} from '../src/index.js';

const T = '2026-10-28T10:00:00.000Z';
const plan = (id: string, createdOn = '2026-10-20'): Plan =>
  createPlan({ id, deedSlug: 'duha', title: id, unit: 'count', amount: 5, activeDaysPerWeek: 7, slots: ['21:00', '09:30'], createdOn }, T);
const storeOf = (...plans: Plan[]): Store => plans.reduce((s, p) => upsertPlan(s, p, T), emptyStore());
const logOn = (p: Plan, ...dates: string[]) => dates.reduce((acc, d) => logDone(acc, d, 1), p);
/** A clock long after every test date: no day is still open for «قضاء». */
const LATE = { now: Date.parse('2027-06-01T00:00:00Z') };

describe('pause and resume', () => {
  it('a paused plan asks for nothing from pausedOn on, keeps its log, and asks again after resuming', () => {
    const p = pausePlan(logOn(plan('a'), '2026-10-21'), '2026-10-25', T);
    expect(isPaused(p)).toBe(true);
    expect(p.log['2026-10-21']).toBe(1);
    expect(planAsksOn(p, '2026-10-24')).toBe(true);
    expect(planAsksOn(p, '2026-10-25')).toBe(false);
    const r = resumePlan(p, '2026-10-28', T);
    expect(isPaused(r)).toBe(false);
    expect(isPausedOn(r, '2026-10-27')).toBe(true);
    expect(planAsksOn(r, '2026-10-27')).toBe(false);
    expect(planAsksOn(r, '2026-10-28')).toBe(true);
    expect(validatePlan(r)).toBeNull();
    expect(validatePlan({ ...r, pausedOn: undefined })).toMatch(/resumedOn/);
  });

  it('the paused days stay out of the streak after resuming', () => {
    const a = resumePlan(pausePlan(logOn(plan('a', '2026-10-20'), '2026-10-20', '2026-10-21'), '2026-10-22', T), '2026-10-26', T);
    const b = logOn(plan('b', '2026-10-20'), '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25');
    const s = storeOf(logOn(a, '2026-10-26'), logOn(b, '2026-10-26'));
    expect(currentStreak(s, '2026-10-26', LATE)).toBe(7);
  });

  it('reminders: none while paused, one slot once established, else every slot sorted', () => {
    expect(reminderSlots(plan('a'))).toEqual(['09:30', '21:00']);
    expect(reminderSlots(pausePlan(plan('a'), '2026-10-25', T))).toEqual([]);
    expect(reminderSlots(establishPlan(plan('a'), '2026-10-25', T))).toEqual(['09:30']);
    expect(reminderSlots(unestablishPlan(establishPlan(plan('a'), '2026-10-25', T), T))).toEqual(['09:30', '21:00']);
  });

  it('a paused plan is not in the day, not an off-day row, and not a periodic act', () => {
    const weekly = { ...pausePlan(plan('w'), '2026-10-25', T), rule: { kind: 'weekdays' as const, days: [5] } };
    const s = storeOf(pausePlan(plan('a'), '2026-10-25', T), weekly);
    expect(dayAgenda(s, '2026-10-28')).toEqual([]);
    expect(periodicActs(s, '2026-10-28')).toEqual([]);
  });
});

describe('graduation', () => {
  const old = (adherenceDays: number) => {
    let p = plan('a', '2026-08-01'); // 88 days before 2026-10-28
    for (let i = 1; i <= adherenceDays; i++) p = logDone(p, addDays('2026-10-28', -i), 1);
    return p;
  };

  it('is ready at ≥ 66 days and ≥ 80% over the last 30 full days, never for a young, paused or established plan', () => {
    expect(graduationReady(old(24), '2026-10-28')).toBe(true);
    expect(graduationReady(old(23), '2026-10-28')).toBe(false);
    expect(graduationReady({ ...old(30), createdOn: '2026-08-24' }, '2026-10-28')).toBe(false); // 65 days
    expect(graduationReady(pausePlan(old(30), '2026-10-28', T), '2026-10-28')).toBe(false);
    expect(graduationReady(establishPlan(old(30), '2026-10-28', T), '2026-10-28')).toBe(false);
  });
});

describe('limits', () => {
  const isPeriodicAct = (p: Plan) => p.habitKey === 'sadaqah-weekly';

  it('counts young habits (established or not) without paused or periodic plans', () => {
    const s = storeOf(
      plan('a'),
      plan('b'),
      establishPlan(plan('c'), '2026-10-28', T),
      pausePlan(plan('d'), '2026-10-28', T),
      { ...plan('e'), habitKey: 'sadaqah-weekly' },
    );
    const l = limits(s, '2026-10-28', { isPeriodicAct });
    // Marking «راسخة» no longer frees a place before 90 days (owner, 2026-11-01).
    expect(l.sapling).toEqual({ count: 3, max: 3, full: true });
    expect(l.canAdd('sapling')).toBe(false);
    expect(l.graduationReady).toEqual([]);
    const fewer = limits(storeOf(plan('a'), plan('b'), pausePlan(plan('d'), '2026-10-28', T)), '2026-10-28', { isPeriodicAct });
    expect(fewer.sapling).toEqual({ count: 2, max: 3, full: false });
    expect(fewer.canAdd('sapling')).toBe(true);
  });

  it('a people list is one periodic act, however many people; adding to a list in use is always allowed', () => {
    let s = storeOf({ ...plan('e'), habitKey: 'sadaqah-weekly' });
    const rule = { kind: 'everyNDays' as const, n: 7, anchor: '2026-10-28' };
    for (const [id, circle] of [['r1', 'kin'], ['r2', 'kin'], ['r3', 'parents'], ['r4', 'neighbors'], ['r5', 'friends'], ['r6', 'sick']] as const) {
      s = upsertRelative(s, createRelative({ id, name: id, relation: '', rule, circle }, T), T);
    }
    const l = limits(s, '2026-10-28', { isPeriodicAct });
    expect(l.periodic.count).toBe(6);
    expect(LIMITS.periodic).toBe(7);
    expect(l.canAdd('periodic')).toBe(true);
    const seven = limits(upsertPlan(s, { ...plan('g'), habitKey: 'sadaqah-weekly' }, T), '2026-10-28', { isPeriodicAct });
    expect(seven.periodic.full).toBe(true);
    expect(seven.canAdd('periodic')).toBe(false);
    expect(seven.canAdd('periodic', { circle: 'kin' })).toBe(true);
  });

  it('«تخفَّف»: a new program only when every running one has lasted 60 days', () => {
    let s = emptyStore();
    s = { ...s, programs: [startProgram({ sinSlug: 'ghibah', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, T)] };
    expect(limits(s, '2026-10-02').canAdd('program')).toBe(false);
    expect(limits(s, '2026-11-29').canAdd('program')).toBe(false); // 59 days
    expect(limits(s, '2026-11-30').canAdd('program')).toBe(true); // 60 days
  });
});

describe('people circles', () => {
  const rule = { kind: 'everyNDays' as const, n: 7, anchor: '2026-10-28' };

  it('kin is the default and is not written; an unknown circle is invalid', () => {
    const kin = createRelative({ id: 'r', name: 'خالتي', relation: 'خالة', rule }, T);
    expect(kin.circle).toBeUndefined();
    expect(relativeFields(kin)).toEqual({ name: 'خالتي', relation: 'خالة', rule });
    expect(relativeFields(createRelative({ id: 'r', name: 'جاري', relation: '', rule, circle: 'neighbors' }, T)).circle).toBe('neighbors');
    expect(validateRelative({ ...kin, circle: 'colleagues' })).toMatch(/circle/);
  });

  it('a sick person is due every day until visited once, then leaves the day and the due list', () => {
    let s = upsertRelative(emptyStore(), createRelative({ id: 's', name: 'أبو محمد', relation: '', rule: sickRule('2026-10-26'), circle: 'sick' }, T), T);
    expect(dayAgenda(s, '2026-10-28').map((i) => i.kind)).toEqual(['relative']);
    s = { ...s, relatives: s.relatives.map((r) => logContact(r, '2026-10-28')) };
    expect(isRelativeOpen(s.relatives[0]!)).toBe(false);
    expect(dayAgenda(s, '2026-10-28')).toEqual([{ kind: 'relative', relativeId: 's', done: true, overdueDays: 0 }]);
    expect(dayAgenda(s, '2026-10-29')).toEqual([]);
    expect(dueList(s.relatives, '2026-10-29')).toEqual({ overdue: [], thisWeek: [], later: [] });
    expect(periodicActs(s, '2026-10-29')).toEqual([]);
  });
});

describe('excused days', () => {
  it('toggles today or an earlier day within 90 days, never a future day; keeps at most 60', () => {
    let s = toggleExcusedDay(emptyStore(), '2026-10-28', '2026-10-28', T);
    expect(isExcused(s, '2026-10-28')).toBe(true);
    s = toggleExcusedDay(s, '2026-10-28', '2026-10-28', T);
    expect(isExcused(s, '2026-10-28')).toBe(false);
    expect(canExcuse('2026-10-29', '2026-10-28')).toBe(false);
    expect(canExcuse(addDays('2026-10-28', -89), '2026-10-28')).toBe(true);
    expect(canExcuse(addDays('2026-10-28', -90), '2026-10-28')).toBe(false);
    for (let i = 0; i < 70; i++) s = toggleExcusedDay(s, addDays('2026-10-28', -i), '2026-10-28', T);
    expect(s.settings.excusedDays).toHaveLength(MAX_EXCUSED_DAYS);
    expect(s.settings.excusedDays?.[MAX_EXCUSED_DAYS - 1]).toBe('2026-10-28');
    expect(parseStore(JSON.parse(JSON.stringify(s))).settings.excusedDays).toEqual(s.settings.excusedDays);
  });

  it('an excused day neither breaks nor adds to the streak, and is not «missed yesterday»', () => {
    const a = logOn(plan('a', '2026-10-24'), '2026-10-24', '2026-10-25', '2026-10-27');
    let s = storeOf(a);
    expect(currentStreak(s, '2026-10-27', LATE)).toBe(1);
    s = toggleExcusedDay(s, '2026-10-26', '2026-10-27', T);
    expect(streakDay(s, '2026-10-26', LATE)).toBe('skipped');
    expect(currentStreak(s, '2026-10-27', LATE)).toBe(3);
    const t = toggleExcusedDay(storeOf(plan('b', '2026-10-24')), '2026-10-27', '2026-10-28', T);
    expect(dayAgenda(t, '2026-10-28')[0]).toEqual({ kind: 'habit', planId: 'b', required: 5, done: 0, remaining: 5, complete: false });
  });

  it('settings content stays the old one without excused days, and syncs them both ways', () => {
    expect(settingsContent({ hijriOffset: 0, reminderTimes: [] })).toBe('{"hijriOffset":0,"reminderTimes":[],"freeMinutesPerDay":null}');
    const s = toggleExcusedDay(emptyStore(), '2026-10-27', '2026-10-28', T);
    expect(localChanges(s).settings?.excusedDays).toEqual(['2026-10-27']);
    const back = applyServerChanges(emptyStore(), {
      serverTime: '2026-10-28T11:00:00.000Z',
      settings: { hijriOffset: 0, reminderTimes: [], freeMinutesPerDay: null, excusedDays: ['2026-10-26'], clientUpdatedAt: T },
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
    });
    expect(back.settings.excusedDays).toEqual(['2026-10-26']);
    // An older server without the field: none.
    const old = applyServerChanges(emptyStore(), {
      serverTime: '2026-10-28T11:00:00.000Z',
      settings: { hijriOffset: 1, reminderTimes: [], freeMinutesPerDay: null, clientUpdatedAt: T },
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
    });
    expect(old.settings).toEqual({ hijriOffset: 1, updatedAt: T });
  });
});

describe('streak mercy', () => {
  it('«قضاء»: yesterday can be made up until noon (local) today; a later fix is kept but does not count', () => {
    const deadline = makeUpDeadline('2026-10-27');
    expect(new Date(deadline).getHours()).toBe(12);
    expect(new Date(deadline).getDate()).toBe(28);
    expect(canMakeUp('2026-10-27', '2026-10-28', deadline - 1)).toBe(true);
    expect(canMakeUp('2026-10-27', '2026-10-28', deadline)).toBe(false);
    expect(canMakeUp('2026-10-26', '2026-10-28', deadline - 1)).toBe(false);

    const before = new Date(deadline - 60_000).toISOString();
    const after = new Date(deadline + 60_000).toISOString();
    const inTime = logForDay(plan('a'), '2026-10-27', 1, '2026-10-28', before);
    expect(inTime.logCorrectedAt).toBeUndefined();
    expect(countsOn(inTime, '2026-10-27')).toBe(true);
    const late = logForDay(plan('a'), '2026-10-27', 1, '2026-10-28', after);
    expect(late.log['2026-10-27']).toBe(1);
    expect(countsOn(late, '2026-10-27')).toBe(false);
    // A same-day undo stays inside the window.
    expect(countsOn(logDone(correctLog(plan('a'), '2026-10-27', 0, '2026-10-27T10:00:00.000Z'), '2026-10-27', 1), '2026-10-27')).toBe(true);
  });

  it('an incomplete yesterday does not end the run while it can still be made up', () => {
    const a = logOn(plan('a', '2026-10-24'), '2026-10-24', '2026-10-25', '2026-10-26');
    const s = storeOf(a);
    const deadline = makeUpDeadline('2026-10-27');
    expect(currentStreak(s, '2026-10-28', { now: deadline - 1 })).toBe(3);
    expect(currentStreak(s, '2026-10-28', { now: deadline + 1 })).toBe(0);
    expect(longestStreak(s, '2026-10-28', { now: deadline + 1 })).toBe(3);
  });

  it('heavy-day minimum counts', () => {
    const a = logOn(startEbb(plan('a', '2026-10-27'), '2026-10-27', T), '2026-10-27');
    expect(streakDay(storeOf(a, plan('b', '2026-10-27')), '2026-10-27', LATE)).toBe('complete');
  });

  it('never shows 0 as a failure', () => {
    expect(streakDisplay(3, 5)).toEqual({ kind: 'current', current: 3, longest: 5 });
    expect(streakDisplay(0, 5)).toEqual({ kind: 'fresh', longest: 5 });
    expect(streakDisplay(0, 0)).toEqual({ kind: 'none' });
  });

  it('«لا تفوّتها مرتين»: a habit asked and missed yesterday goes first, with its minimum', () => {
    const missed = plan('missed', '2026-10-20');
    const kept = logOn(plan('kept', '2026-10-20'), '2026-10-27');
    const items = dayAgenda(storeOf(kept, missed), '2026-10-28');
    expect(items[0]).toEqual({ kind: 'habit', planId: 'missed', required: 5, done: 0, remaining: 5, complete: false, missedYesterday: true, minimum: 2 });
    expect(items[1]).toMatchObject({ planId: 'kept' });
    expect(items[1]).not.toHaveProperty('missedYesterday');
    // A plan created today missed nothing.
    expect(dayAgenda(storeOf(plan('new', '2026-10-28')), '2026-10-28')[0]).not.toHaveProperty('missedYesterday');
  });
});

describe('sync of the phase-2 fields', () => {
  it('older plans keep their canonical content; new fields travel only when set', () => {
    const p = plan('a');
    expect(Object.keys(planFields(p))).not.toContain('pausedOn');
    const paused = pausePlan(establishPlan(p, '2026-10-27', T), '2026-10-28', T);
    expect(planFields(paused)).toMatchObject({ pausedOn: '2026-10-28', establishedOn: '2026-10-27' });
  });

  it('round-trips pausedOn, resumedOn, establishedOn and circle through a server response; null means unset', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const rid = '00000000-0000-4000-8000-000000000002';
    const base = {
      id,
      habitKey: null,
      deedSlug: 'duha',
      title: 'a',
      unit: 'count',
      amount: 1,
      ceiling: null,
      activeDaysPerWeek: 7,
      slots: ['09:00'],
      rule: null,
      createdOn: '2026-10-01',
      amountChangedOn: '2026-10-01',
      ebbSince: null,
      season: null,
      clientUpdatedAt: T,
      deletedAt: null,
    };
    const response = {
      serverTime: '2026-10-28T11:00:00.000Z',
      settings: null,
      plans: [{ ...base, pausedOn: '2026-10-20', resumedOn: '2026-10-25', establishedOn: null }],
      logs: [],
      relatives: [
        { id: rid, name: 'جاري', relation: '', rule: { kind: 'everyNDays', n: 30, anchor: '2026-10-01' }, circle: 'neighbors', lastContactedOn: null, clientUpdatedAt: T, deletedAt: null },
      ],
      contacts: [],
    };
    const s = applyServerChanges(emptyStore(), response);
    expect(s.plans[0]).toMatchObject({ pausedOn: '2026-10-20', resumedOn: '2026-10-25' });
    expect(s.plans[0]).not.toHaveProperty('establishedOn');
    expect(s.relatives[0]?.circle).toBe('neighbors');
    // Acked: nothing to send back.
    expect(localChanges(s)).toEqual({ plans: [], logs: [], relatives: [], contacts: [] });
    const out = localChanges(s, { includeAcked: true });
    expect(out.plans[0]).toMatchObject({ pausedOn: '2026-10-20', resumedOn: '2026-10-25' });
    expect(out.relatives[0]).toMatchObject({ circle: 'neighbors' });
  });
});
