import { describe, expect, it } from 'vitest';
import {
  checkIn,
  createPlan,
  createRelative,
  dayAgenda,
  emptyStore,
  logContact,
  logDone,
  startProgram,
  upsertPlan,
  upsertRelative,
  weekday,
  type Store,
} from '@thekra/practice-core';
import type { OccasionDate } from '@/lib/types/practice';
import { calendarRange, occasionsByDate } from './calendar';
import { setEbbForAll } from './plans';
import {
  canLogOn,
  compareMonths,
  hijriMonthSpan,
  isDayComplete,
  isFirstRun,
  isInMonth,
  lastOfMonth,
  monthWeeks,
  presenceLevel,
  shiftMonth,
  trackSummary,
  weekOf,
  weekStartFor,
} from './hub';

const T = '2026-10-28T10:00:00.000Z';
const plan = (id: string) =>
  createPlan(
    { id, deedSlug: 'duha', title: 'الضحى', unit: 'count', amount: 2, activeDaysPerWeek: 4, slots: ['09:30'], createdOn: '2026-10-01' },
    T,
  );
const relative = (id: string) =>
  createRelative({ id, name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, T);

function store(): Store {
  return upsertRelative(upsertPlan(emptyStore(), plan('p1'), T), relative('r1'), T);
}

describe('weeks and months', () => {
  it('opens the week on Saturday in Arabic and on Monday in English', () => {
    const ar = weekOf('2026-10-29', weekStartFor('ar'));
    expect(ar[0]).toBe('2026-10-24');
    expect(weekday(ar[0] as string)).toBe(6);
    expect(ar).toHaveLength(7);
    expect(ar).toContain('2026-10-29');
    const en = weekOf('2026-10-29', weekStartFor('en'));
    expect(en[0]).toBe('2026-10-26');
    expect(en[6]).toBe('2026-11-01');
    // The first day of the week is its own week start.
    expect(weekOf('2026-10-24', 6)[0]).toBe('2026-10-24');
  });

  it('moves across years and compares months', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 10 }, -13)).toEqual({ year: 2025, month: 9 });
    expect(compareMonths({ year: 2026, month: 10 }, { year: 2026, month: 11 })).toBe(-1);
    expect(compareMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBe(1);
    expect(lastOfMonth({ year: 2028, month: 2 })).toBe('2028-02-29');
    expect(isInMonth('2026-10-31', { year: 2026, month: 10 })).toBe(true);
    expect(isInMonth('2026-11-01', { year: 2026, month: 10 })).toBe(false);
  });

  it('lays a month out in weeks with blank cells around it', () => {
    // October 2026 starts on a Thursday: five blanks before it when the week opens on Saturday.
    const weeks = monthWeeks({ year: 2026, month: 10 }, 6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0]?.[5]).toBe('2026-10-01');
    const days = weeks.flat().filter((d): d is string => d !== null);
    expect(days).toHaveLength(31);
    expect(days.at(-1)).toBe('2026-10-31');
    // February 2026 with Sunday starts fills exactly four weeks.
    expect(monthWeeks({ year: 2026, month: 2 }, 0)).toHaveLength(4);
  });
});

describe('logging window and presence marks', () => {
  it('allows today and the six days before it, never the future', () => {
    expect(canLogOn('2026-10-29', '2026-10-29')).toBe(true);
    expect(canLogOn('2026-10-23', '2026-10-29')).toBe(true);
    expect(canLogOn('2026-10-22', '2026-10-29')).toBe(false);
    expect(canLogOn('2026-10-30', '2026-10-29')).toBe(false);
  });

  it('marks presence without blame: any amount is partial, nothing asked is no mark', () => {
    const today = '2026-10-29';
    const base = { date: '2026-10-28', asked: true, present: false, share: 0 };
    expect(presenceLevel(undefined, today)).toBe('none');
    expect(presenceLevel(base, today)).toBe('empty');
    expect(presenceLevel({ ...base, present: true }, today)).toBe('partial');
    expect(presenceLevel({ ...base, present: true, share: 0.5 }, today)).toBe('partial');
    expect(presenceLevel({ ...base, present: true, share: 1 }, today)).toBe('full');
    expect(presenceLevel({ ...base, asked: false, share: 1 }, today)).toBe('none');
    expect(presenceLevel({ ...base, date: '2026-10-30' }, today)).toBe('none');
  });

  it('calls a day complete only when it asked for something and all of it is done', () => {
    let s = store();
    expect(isDayComplete(dayAgenda(s, '2026-10-28'))).toBe(false);
    s = {
      ...s,
      plans: s.plans.map((p) => logDone(p, '2026-10-28', 2)),
      relatives: s.relatives.map((r) => logContact(r, '2026-10-28')),
    };
    expect(isDayComplete(dayAgenda(s, '2026-10-28'))).toBe(true);
    expect(isDayComplete([])).toBe(false);
    expect(isDayComplete([{ kind: 'occasion', key: 'k', titleAr: 'ع', titleEn: 'e', deed: 'siyam' }])).toBe(false);
  });
});

describe('tracks', () => {
  it('sees a first visit only when no track has anything', () => {
    expect(isFirstRun(emptyStore())).toBe(true);
    expect(isFirstRun(store())).toBe(false);
    const withProgram = {
      ...emptyStore(),
      programs: [startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, T)],
    };
    expect(isFirstRun(withProgram)).toBe(false);
  });

  it('counts habits, relatives due now and a program, without naming the program', () => {
    let s = store();
    s = {
      ...s,
      programs: [
        checkIn(
          startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, T),
          '2026-10-28',
          'held',
          undefined,
          T,
        ),
      ],
    };
    const summary = trackSummary(s, '2026-10-28');
    expect(summary).toMatchObject({ habits: 1, relatives: 1, relativesDue: 1, hasProgram: true });
    expect(summary.band).not.toBeNull();
    expect(JSON.stringify(summary)).not.toContain('ghibah');
    const contacted = { ...s, relatives: s.relatives.map((r) => logContact(r, '2026-10-28')) };
    expect(trackSummary(contacted, '2026-10-28').relativesDue).toBe(0);
    expect(trackSummary(emptyStore(), '2026-10-28')).toMatchObject({ habits: 0, band: null, relativesDue: 0, hasProgram: false });
  });
});

describe('Hijri month span and the calendar range', () => {
  it('names the Hijri months a Gregorian month covers', () => {
    // 1 October 2026 is in Rabi al-Akhir 1448; 31 October is in Jumada al-Ula 1448 (Umm al-Qura).
    expect(hijriMonthSpan({ year: 2026, month: 10 }, 0)).toEqual({
      from: { year: 1448, month: 4 },
      to: { year: 1448, month: 5 },
    });
  });

  it('starts the calendar at the first of this month and groups occasions per date', () => {
    expect(calendarRange('2026-10-28')).toEqual({ from: '2026-10-01', to: '2027-10-28' });
    const occ = (key: string, date: string): OccasionDate => ({
      key,
      date,
      titleAr: key,
      titleEn: key,
      deed: 'siyam',
      basis: 'text',
      hijri: null,
    });
    const byDate = occasionsByDate([occ('a', '2026-11-02'), occ('b', '2026-11-02'), occ('c', '2026-11-05')]);
    expect(byDate.get('2026-11-02')?.map((o) => o.key)).toEqual(['a', 'b']);
    expect(byDate.get('2026-11-05')).toHaveLength(1);
    expect(byDate.has('2026-11-03')).toBe(false);
  });
});

describe('hub actions helpers', () => {
  it('turns «يومي ثقيل» on and off for every plan at once', () => {
    let s = upsertPlan(store(), plan('p2'), T);
    s = setEbbForAll(s, true, '2026-10-28');
    expect(s.plans.every((p) => p.ebb?.since === '2026-10-28')).toBe(true);
    expect(dayAgenda(s, '2026-10-28').find((i) => i.kind === 'habit')).toMatchObject({ required: 2 });
    s = setEbbForAll(s, false, '2026-10-28');
    expect(s.plans.some((p) => p.ebb)).toBe(false);
  });
});
