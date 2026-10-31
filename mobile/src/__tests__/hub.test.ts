/**
 * «عاداتي» hub helpers: presence marks (any amount counts, never a run length), the logging window, finishing a day,
 * occasion days and the track counts.
 */

import {
  createPlan,
  createRelative,
  dayAgenda,
  emptyStore,
  logContact,
  logDone,
  startProgram,
  upsertPlan,
  upsertRelative,
  type AgendaOccasion,
  type DayPresence,
  type Store,
} from '@thekra/practice-core';
import { canLogOn, dueNowCount, finishedDay, hasStarted, isDayComplete, occasionDates, presenceMark } from '../lib/practice/hub';

const T = '2026-10-28T10:00:00.000Z';
const day = (over: Partial<DayPresence>): DayPresence => ({ date: '2026-10-28', asked: true, present: false, share: 0, ...over });
const plan = (id: string) =>
  createPlan({ id, deedSlug: 'duha', title: 'الضحى', unit: 'count', amount: 2, activeDaysPerWeek: 4, slots: ['09:30'], createdOn: '2026-10-01' }, T);

function store(): Store {
  let s = upsertPlan(emptyStore(), plan('p1'), T);
  s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, T), T);
  return s;
}

describe('presenceMark', () => {
  it('fills a fully done day, rings a partial one, leaves an empty one', () => {
    expect(presenceMark(day({ present: true, share: 1 }))).toBe('full');
    expect(presenceMark(day({ present: true, share: 0 }))).toBe('partial');
    expect(presenceMark(day({ present: true, share: 0.5 }))).toBe('partial');
    expect(presenceMark(day({}))).toBe('none');
  });

  it('a day that asked nothing is empty unless something was done', () => {
    expect(presenceMark(day({ asked: false, share: 1 }))).toBe('none');
    expect(presenceMark(day({ asked: false, share: 1, present: true }))).toBe('full');
  });
});

describe('canLogOn', () => {
  it('allows today and the 6 days before, never the future', () => {
    expect(canLogOn('2026-10-29', '2026-10-29')).toBe(true);
    expect(canLogOn('2026-10-23', '2026-10-29')).toBe(true);
    expect(canLogOn('2026-10-22', '2026-10-29')).toBe(false);
    expect(canLogOn('2026-10-30', '2026-10-29')).toBe(false);
  });
});

describe('finishing a day', () => {
  it('only the edit that closes the last open task finishes the day', () => {
    const s = store();
    expect(isDayComplete(dayAgenda(s, '2026-10-28'))).toBe(false);
    const habitDone: Store = { ...s, plans: [logDone(plan('p1'), '2026-10-28', 2)] };
    expect(finishedDay(s, habitDone, '2026-10-28')).toBe(false);
    const allDone: Store = { ...habitDone, relatives: habitDone.relatives.map((r) => logContact(r, '2026-10-28')) };
    expect(finishedDay(habitDone, allDone, '2026-10-28')).toBe(true);
    expect(isDayComplete(dayAgenda(allDone, '2026-10-28'))).toBe(true);
    expect(finishedDay(allDone, allDone, '2026-10-28')).toBe(false);
  });

  it('a habit not asked for that day (its catalog rule) does not keep the day open', () => {
    // 2026-10-28 is a Wednesday; the catalog asks for this habit on Monday and Thursday only.
    const planDays = { defaultRuleOf: () => ({ kind: 'weekdays' as const, days: [1, 4] }) };
    const s = store();
    const contacted: Store = { ...s, relatives: s.relatives.map((r) => logContact(r, '2026-10-28')) };
    expect(isDayComplete(dayAgenda(contacted, '2026-10-28', planDays))).toBe(true);
    expect(finishedDay(s, contacted, '2026-10-28', planDays)).toBe(true);
    expect(finishedDay(s, contacted, '2026-10-28')).toBe(false);
  });

  it('a day with nothing to do is not «complete»', () => {
    expect(isDayComplete([])).toBe(false);
  });
});

describe('occasionDates', () => {
  it('marks every day a rule fires in the range', () => {
    const monday: AgendaOccasion = { key: 'monday', titleAr: 'صيام الاثنين', titleEn: 'Monday fast', deed: 'siyam', rule: { kind: 'weekdays', days: [1] } };
    expect([...occasionDates([monday], '2026-10-01', '2026-10-31', 0)]).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });
});

describe('tracks', () => {
  it('counts relatives due now and knows when nothing was started', () => {
    expect(dueNowCount(store().relatives, '2026-10-28')).toBe(1);
    expect(hasStarted(emptyStore())).toBe(false);
    expect(hasStarted(store())).toBe(true);
    const withProgram = { ...emptyStore(), programs: [startProgram({ sinSlug: 'x', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, T)] };
    expect(hasStarted(withProgram)).toBe(true);
  });
});
