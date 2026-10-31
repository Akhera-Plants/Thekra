import { describe, expect, it } from 'vitest';
import { createRelative, logDone, startProgram, checkIn, startEbb, type Plan } from '@thekra/practice-core';
import type { OccasionDate, PracticeCatalog, PracticeHabit, PracticeOccasion } from '@/lib/types/practice';
import { calendarRange, computeOccasionDates, groupOccasions, occasionsIcs } from './calendar';
import { editRelative, kinshipEvents, rhythmOf, rhythmRule } from './kinship';
import {
  editPlan,
  lowerAmounts,
  MONTH_DAYS,
  PROGRESS_DAYS,
  planFromHabit,
  planReminderEvents,
  planToday,
  progressDays,
  ramadanEnd,
} from './plans';
import { allProgramEvidenceIds, chosenPath, programView } from './programs';

const habit: PracticeHabit = {
  key: 'quran-wird',
  titleAr: 'ورد القرآن',
  titleEn: 'Daily Quran reading',
  deed: 'quran',
  unit: 'minutes',
  unitLabelAr: 'دقيقة',
  unitLabelEn: 'minutes',
  start: { far: 2, near: 10 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['06:00', '21:00'],
  basis: 'organizational',
  evidence: ['q1'],
};

const occ = (key: string, date: string): OccasionDate => ({
  key,
  date,
  titleAr: key,
  titleEn: key,
  deed: 'siyam',
  basis: 'text',
  hijri: null,
});

describe('calendar view-model', () => {
  it('groups a run of days into one row and orders rows by the next date', () => {
    const rows = groupOccasions(
      [occ('b', '2026-11-02'), occ('a', '2026-10-27'), occ('a', '2026-11-05'), occ('a', '2026-11-06'), occ('a', '2026-11-08')],
      '2026-10-28',
    );
    expect(rows.map((r) => [r.key, r.date, r.until, r.daysAway])).toEqual([
      ['b', '2026-11-02', '2026-11-02', 5],
      ['a', '2026-11-05', '2026-11-06', 8],
    ]);
    expect(rows[1]?.dates).toEqual(['2026-11-05', '2026-11-06', '2026-11-08']);
  });

  it('computes the white days on the device with the Hijri offset', () => {
    const white: PracticeOccasion = {
      key: 'ayyam-bid',
      titleAr: 'الأيام البيض',
      titleEn: 'White days',
      deed: 'siyam',
      rule: { kind: 'hijriMonthDays', days: [13, 14, 15] },
      basis: 'text',
      evidence: [],
    };
    const { from } = calendarRange('2026-10-28');
    const dates = computeOccasionDates([white], from, '2026-11-30', 0).map((d) => d.date);
    // 17 Jumada al-Ula 1448 = 2026-10-28, so 13–15 Jumada al-Akhira are 2026-11-23…25.
    expect(dates).toEqual(['2026-11-23', '2026-11-24', '2026-11-25']);
    const shifted = computeOccasionDates([white], from, '2026-11-30', -1).map((d) => d.date);
    expect(shifted).toEqual(['2026-11-24', '2026-11-25', '2026-11-26']);
  });

  it('writes an all-day calendar file with one event per date', () => {
    const rows = groupOccasions([occ('a', '2026-11-05'), occ('a', '2026-11-06')], '2026-10-28');
    const ics = occasionsIcs(
      rows,
      'en',
      'Thekra',
      (deed) => `https://example.test/good-deeds/${deed}`,
      new Date('2026-10-28T00:00:00Z'),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261105');
  });
});

describe('plan view-model', () => {
  const today = '2026-10-28';

  it('starts from the catalog amount for the distance and keeps two slots', () => {
    const plan = planFromHabit(habit, { distance: 'far', slots: ['21:00', '06:00'], activeDaysPerWeek: 3 }, today);
    expect(plan.amount).toBe(2);
    expect(plan.slots).toEqual(['06:00', '21:00']);
    expect(plan.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(plan.habitKey).toBe('quran-wird');
  });

  it('adds partial amounts and never asks for more the next day', () => {
    let plan = planFromHabit(habit, { distance: 'near', slots: ['06:00', '21:00'], activeDaysPerWeek: 3 }, today);
    plan = logDone(plan, today, 4);
    const view = planToday(plan, today, 7 * 60);
    expect(view).toMatchObject({ required: 10, done: 4, remaining: 6, isPartial: true, isDue: true, nextSlot: '21:00' });
    expect(planToday(plan, '2026-10-29', 0).required).toBe(10);
  });

  it('offers no increase before the hold period and lightens on an ebb', () => {
    const plan = planFromHabit(habit, { distance: 'near', slots: ['06:00'], activeDaysPerWeek: 3 }, today);
    expect(planToday(plan, today, 0).canIncrease).toBe(false);
    expect(planToday(startEbb(plan, today), today, 0).required).toBe(2);
  });

  it('suggests a smaller amount after a week with nothing logged', () => {
    const plan: Plan = { ...planFromHabit(habit, { distance: 'near', slots: ['06:00'], activeDaysPerWeek: 3 }, '2026-10-01') };
    const view = planToday(plan, today, 0);
    expect(view.isRelapse).toBe(true);
    expect(view.relapseTo).toBe(3);
    expect(view.band).toBe('gentle');
    expect(progressDays(plan, today)).toHaveLength(30);
  });

  it('builds reminders for every slot over 30 days', () => {
    const plan = planFromHabit(habit, { distance: 'far', slots: ['06:00', '21:00'], activeDaysPerWeek: 3 }, today);
    const events = planReminderEvents([plan], new Map([[habit.key, habit]]), today, 'en', 0);
    expect(events).toHaveLength(60);
    expect(events[0]).toMatchObject({ date: today, time: '06:00', title: 'Daily Quran reading' });
  });

  it('shows as many progress dots as the «last 30 days» count says, and counts the same days', () => {
    expect(PROGRESS_DAYS).toBe(MONTH_DAYS);
    expect(MONTH_DAYS).toBe(30);
    let plan = planFromHabit(habit, { distance: 'far', slots: ['06:00'], activeDaysPerWeek: 3 }, '2026-08-01');
    // Day 29 back is inside the 30-day window, day 30 back is outside it.
    for (const d of ['2026-09-28', '2026-09-29', '2026-10-15', today]) plan = logDone(plan, d, 1);
    const days = progressDays(plan, today);
    expect(days).toHaveLength(30);
    expect(days[0]?.date).toBe('2026-09-29');
    expect(days.filter((d) => d.done)).toHaveLength(3);
    expect(planToday(plan, today, 0).doneDaysInMonth).toBe(3);
  });

  it('knows the end of Ramadan only inside Ramadan', () => {
    expect(ramadanEnd(today, 0)).toBeNull();
    // 1 Ramadan 1447 = 2026-02-18; 29 or 30 days later the month ends.
    const end = ramadanEnd('2026-03-01', 0);
    expect(end === '2026-03-18' || end === '2026-03-19').toBe(true);
  });
});

describe('habit schedule (isPlanDueOn)', () => {
  // 2026-10-28 is a Wednesday; 2026-10-30 is a Friday.
  const fridayHabit: PracticeHabit = {
    ...habit,
    key: 'qiyam-last-third',
    titleEn: 'Night prayer',
    unit: 'times',
    start: { far: 1, near: 1 },
    defaultRule: { kind: 'weekdays', days: [5] },
    defaultSlots: ['04:00'],
  };
  const make = () => planFromHabit(fridayHabit, { distance: 'far', slots: ['04:00'], activeDaysPerWeek: 2 }, '2026-10-01');
  const schedule = { fallback: fridayHabit.defaultRule, hijriOffset: 0 };

  it('asks for a Friday-only habit on Fridays only, through the catalog default rule', () => {
    const wed = planToday(make(), '2026-10-28', 23 * 60, schedule);
    expect(wed).toMatchObject({ isDueToday: false, isDue: false, nextSlot: null });
    const fri = planToday(make(), '2026-10-30', 5 * 60, schedule);
    expect(fri).toMatchObject({ isDueToday: true, isDue: true });
  });

  it('lets the plan’s own rule win over the catalog rule, and is daily without either', () => {
    const daily: Plan = { ...make(), rule: { kind: 'daily' } };
    expect(planToday(daily, '2026-10-28', 0, schedule).isDueToday).toBe(true);
    expect(planToday(make(), '2026-10-28', 0).isDueToday).toBe(true);
  });

  it('still counts what is logged on a day the habit is not asked for', () => {
    const view = planToday(logDone(make(), '2026-10-28', 1), '2026-10-28', 0, schedule);
    expect(view).toMatchObject({ isDueToday: false, done: 1, isComplete: true });
  });

  it('builds calendar reminders on the same days the today list asks for', () => {
    const habits = new Map([[fridayHabit.key, fridayHabit]]);
    const events = planReminderEvents([make()], habits, '2026-10-28', 'ar', 0);
    expect(events.map((e) => e.date)).toEqual(['2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20']);
    const own = planReminderEvents([{ ...make(), rule: { kind: 'weekdays', days: [3] } }], habits, '2026-10-28', 'ar', 0);
    expect(own[0]?.date).toBe('2026-10-28');
  });

  it('keeps «يومي ثقيل» to its own day', () => {
    const plan = planFromHabit(habit, { distance: 'near', slots: ['06:00'], activeDaysPerWeek: 3 }, '2026-10-01');
    const heavy = startEbb(plan, '2026-10-27');
    expect(planToday(heavy, '2026-10-27', 0).required).toBe(2);
    expect(planToday(heavy, '2026-10-28', 0).required).toBe(10);
  });
});

describe('editing a habit', () => {
  const today = '2026-10-28';
  const now = '2026-10-28T10:00:00.000Z';
  const base = () => planFromHabit(habit, { distance: 'near', slots: ['06:00', '21:00'], activeDaysPerWeek: 3 }, '2026-09-01');

  it('changes times and active days and stamps updatedAt', () => {
    const edited = editPlan(base(), { slots: ['22:00', '05:30', '22:00'], activeDaysPerWeek: 5, amount: 10 }, today, now);
    expect(edited).toMatchObject({ slots: ['05:30', '22:00'], activeDaysPerWeek: 5, amount: 10, updatedAt: now });
    expect(edited.amountChangedOn).toBe('2026-09-01');
  });

  it('lowers the amount through decreaseTo, which restarts the hold', () => {
    const edited = editPlan(base(), { slots: ['06:00', '21:00'], activeDaysPerWeek: 3, amount: 5 }, today, now);
    expect(edited).toMatchObject({ amount: 5, amountChangedOn: today, updatedAt: now });
  });

  it('never raises the amount (that stays with the step rule) and leaves an unchanged plan alone', () => {
    expect(() => editPlan(base(), { slots: ['06:00'], activeDaysPerWeek: 3, amount: 15 }, today, now)).toThrow(RangeError);
    const plan = base();
    expect(editPlan(plan, { slots: ['21:00', '06:00'], activeDaysPerWeek: 3, amount: 10 }, today, now)).toBe(plan);
  });

  it('refuses an edit without any time', () => {
    expect(() => editPlan(base(), { slots: [], activeDaysPerWeek: 3, amount: 10 }, today, now)).toThrow(RangeError);
  });

  it('offers the current amount and the ladder values below it', () => {
    expect(lowerAmounts(base())).toEqual([10, 7, 5, 3, 2, 1]);
  });
});

describe('kinship helpers', () => {
  it('edits name, relation and rhythm, keeping contacts and an unchanged rule', () => {
    const now = '2026-10-29T08:00:00.000Z';
    const rel = { ...createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: rhythmRule('weekly', 5, '2026-10-01') }), history: ['2026-10-20'], lastContactedOn: '2026-10-20' };
    const renamed = editRelative(rel, { name: ' خالتي سعاد ', relation: 'خالة', rhythm: 'weekly', weekday: 5 }, '2026-10-29', now);
    expect(renamed).toMatchObject({ name: 'خالتي سعاد', relation: 'خالة', rule: rel.rule, history: ['2026-10-20'], updatedAt: now });
    const monthly = editRelative(rel, { name: 'خالتي', relation: '', rhythm: 'monthly', weekday: 5 }, '2026-10-29', now);
    expect(monthly.rule).toEqual({ kind: 'everyNDays', n: 30, anchor: '2026-10-29' });
    expect(editRelative(rel, { name: 'خالتي', relation: '', rhythm: 'weekly', weekday: 5 }, '2026-10-29', now)).toBe(rel);
  });

  it('keeps a custom rule and refuses contact details on edit', () => {
    const rel = createRelative({ id: 'r2', name: 'عمي', relation: '', rule: { kind: 'weekdays', days: [1, 4] } });
    expect(editRelative(rel, { name: 'عمي', relation: 'عم', rhythm: 'custom', weekday: 5 }, '2026-10-29').rule).toEqual(rel.rule);
    expect(() => editRelative(rel, { name: '0791234567', relation: '', rhythm: 'custom', weekday: 5 }, '2026-10-29')).toThrow(RangeError);
  });

  it('maps presets to rules and back', () => {
    expect(rhythmOf(rhythmRule('biweekly', 5, '2026-10-28'))).toEqual({ rhythm: 'biweekly', weekday: 5 });
    expect(rhythmOf(rhythmRule('monthly', 5, '2026-10-28'))).toEqual({ rhythm: 'monthly', weekday: null });
  });

  it('exports generic titles unless names are chosen', () => {
    const rel = createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: rhythmRule('weekly', 5, '2026-10-28') });
    const events = kinshipEvents([rel], '2026-10-28', () => 'صلة رحم');
    expect(events[0]).toMatchObject({ date: '2026-10-30', title: 'صلة رحم', time: '18:00' });
    expect(events.every((e) => !e.title.includes('خالتي'))).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(12);
  });
});

describe('sin program helpers', () => {
  const sinPrograms: PracticeCatalog['sinPrograms'] = {
    review: 'pending',
    common: {
      willQuestionAr: '؟',
      willQuestionEn: '?',
      stageMinDays: 7,
      stages: {
        harms: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' },
        alternatives: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' },
        environment: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' },
        limits: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' },
        restore_rights: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', evidence: ['r'] },
        leave: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' },
      },
      afterFall: { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', evidence: ['f', 'a'] },
      helpAr: '',
      helpEn: '',
    },
    programs: [
      {
        sin: 'x',
        category: 'haqq_allah',
        gradualAllowed: true,
        help: false,
        actionsAr: [],
        actionsEn: [],
        alternatives: [],
        evidence: ['b', 'a'],
      },
      {
        sin: 'y',
        category: 'haqq_ibad',
        gradualAllowed: false,
        help: false,
        actionsAr: [],
        actionsEn: [],
        alternatives: [],
        evidence: ['c'],
      },
    ],
  };

  it('asks for the same evidence set whatever program is open', () => {
    expect(allProgramEvidenceIds(sinPrograms)).toEqual(['a', 'b', 'c', 'f', 'r']);
  });

  it('allows gradual only when the catalog allows it and leaving at once is very hard', () => {
    const [allah, ibad] = sinPrograms.programs as [(typeof sinPrograms.programs)[0], (typeof sinPrograms.programs)[0]];
    expect(chosenPath(allah, true)).toBe('gradual');
    expect(chosenPath(allah, false)).toBe('cut');
    expect(chosenPath(ibad, true)).toBe('cut');
    expect(chosenPath({ ...allah, gradualAllowed: false }, true)).toBe('cut');
  });

  it('counts check-ins without streaks and lists the restore-rights stage for people’s rights', () => {
    let program = startProgram({ sinSlug: 'y', category: 'haqq_ibad', hardToLeaveAtOnce: true, startedOn: '2026-10-20' });
    program = checkIn(program, '2026-10-27', 'weak');
    program = checkIn(program, '2026-10-28', 'fell_repented', 'ملاحظة');
    const view = programView(program, '2026-10-28');
    expect(view.stages).toContain('restore_rights');
    expect(view.summary).toMatchObject({ held: 0, weak: 1, fell_repented: 1, daysCheckedIn: 2 });
    expect(view.today).toMatchObject({ value: 'fell_repented', note: 'ملاحظة' });
    expect(view.recent.map((c) => c.date)).toEqual(['2026-10-28', '2026-10-27']);
  });
});
