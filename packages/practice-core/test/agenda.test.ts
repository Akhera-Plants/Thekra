import { describe, expect, it } from 'vitest';
import {
  checkIn,
  createPlan,
  createRelative,
  dayAgenda,
  emptyStore,
  logContact,
  logDone,
  monthSummary,
  plansNotAskedOn,
  presence,
  startProgram,
  upsertPlan,
  upsertRelative,
  type AgendaOccasion,
  type Plan,
  type Rule,
  type Store,
} from '../src/index.js';

const T = '2026-10-28T10:00:00.000Z';
const plan = (id: string, createdOn = '2026-10-01') =>
  createPlan({ id, deedSlug: 'duha', title: 'الضحى', unit: 'count', amount: 2, activeDaysPerWeek: 4, slots: ['09:30'], createdOn }, T);

function store(): Store {
  let s = upsertPlan(emptyStore(), plan('p1'), T);
  s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, T), T);
  return s;
}

describe('dayAgenda', () => {
  it('lists the day across tracks: occasions first, then habits, relatives, the generic check-in last', () => {
    let s = store();
    s = { ...s, programs: [checkIn(startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, T), '2026-10-28', 'held', undefined, T)] };
    const monday: AgendaOccasion = { key: 'monday', titleAr: 'صيام الاثنين', titleEn: 'Monday fast', deed: 'siyam', rule: { kind: 'weekdays', days: [1] } };
    const items = dayAgenda(s, '2026-10-26', { occasions: [monday] });
    expect(items.map((i) => i.kind)).toEqual(['occasion', 'habit', 'relative', 'program']);
    expect(items[3]).toEqual({ kind: 'program', done: false });
    expect(dayAgenda(s, '2026-10-28').find((i) => i.kind === 'program')).toEqual({ kind: 'program', done: true });
    expect(JSON.stringify(items)).not.toContain('ghibah');
  });

  it('a habit shows what is left; any amount counts and a full amount completes it', () => {
    const s = { ...store(), plans: [logDone(plan('p1'), '2026-10-28', 1)] };
    expect(dayAgenda(s, '2026-10-28').find((i) => i.kind === 'habit')).toMatchObject({ required: 2, done: 1, remaining: 1, complete: false });
    expect(dayAgenda(s, '2026-09-30').some((i) => i.kind === 'habit')).toBe(false);
  });

  it('lists a habit only on its own days: its rule, else the catalog rule, else every day (isPlanDueOn)', () => {
    // 2026-10-26 is a Monday, 2026-10-27 a Tuesday.
    const monThu: Rule = { kind: 'weekdays', days: [1, 4] };
    const own = { ...plan('own'), rule: monThu };
    const fromCatalog: Plan = { ...plan('cat'), habitKey: 'fast-mon-thu' };
    const daily = plan('daily');
    const s = { ...store(), plans: [own, fromCatalog, daily] };
    const defaultRuleOf = (p: Plan) => (p.habitKey === 'fast-mon-thu' ? monThu : undefined);
    const habitIds = (date: string) =>
      dayAgenda(s, date, { defaultRuleOf }).flatMap((i) => (i.kind === 'habit' ? [i.planId] : []));
    expect(habitIds('2026-10-26')).toEqual(['own', 'cat', 'daily']);
    expect(habitIds('2026-10-27')).toEqual(['daily']);
    expect(plansNotAskedOn(s, '2026-10-27', { defaultRuleOf }).map((p) => p.id)).toEqual(['own', 'cat']);
    // Without the catalog lookup a plan without its own rule is asked for every day.
    expect(dayAgenda(s, '2026-10-27').flatMap((i) => (i.kind === 'habit' ? [i.planId] : []))).toEqual(['cat', 'daily']);
    // A day it does not ask for is not missed: presence counts only what was asked.
    const off = presence(s, '2026-10-27', '2026-10-27', { defaultRuleOf })[0];
    expect(off?.share).toBe(0);
    const logged = { ...s, plans: [own, fromCatalog, logDone(daily, '2026-10-27', 2)] };
    expect(presence(logged, '2026-10-27', '2026-10-27', { defaultRuleOf })[0]).toMatchObject({ present: true, share: 0.5 });
  });

  it('a relative is due until contacted, then shows as done that day and leaves the next days', () => {
    let s = store();
    expect(dayAgenda(s, '2026-10-28').find((i) => i.kind === 'relative')).toMatchObject({ done: false, overdueDays: 0 });
    s = { ...s, relatives: s.relatives.map((r) => logContact(r, '2026-10-28')) };
    expect(dayAgenda(s, '2026-10-28').find((i) => i.kind === 'relative')).toMatchObject({ done: true });
    expect(dayAgenda(s, '2026-10-29').some((i) => i.kind === 'relative')).toBe(false);
    expect(dayAgenda(s, '2026-11-06').find((i) => i.kind === 'relative')).toMatchObject({ done: false, overdueDays: 2 });
  });
});

describe('presence and monthSummary', () => {
  it('counts any amount as presence and never a run length', () => {
    const s = { ...store(), plans: [logDone(logDone(plan('p1'), '2026-10-27', 1), '2026-10-28', 2)] };
    const days = presence(s, '2026-10-26', '2026-10-28');
    expect(days.map((d) => d.present)).toEqual([false, true, true]);
    expect(days[2]?.share).toBe(0.5);
    const month = monthSummary(s, '2026-10-28');
    expect(month.presentDays).toBe(2);
    expect(month.band).not.toBeNull();
    expect(Object.keys(month)).not.toContain('streak');
  });

  it('without plans there is no band', () => {
    expect(monthSummary(emptyStore(), '2026-10-28')).toEqual({ presentDays: 0, adherence: null, band: null });
  });
});
