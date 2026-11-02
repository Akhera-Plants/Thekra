/**
 * «عاداتي» (owner, 2026-11-01): the action at the end of each habit row, the «تخفَّف» rows (stage and days held,
 * nothing that names the sin), and «وضع رمضان» only in Ramadan.
 */

import { addDays, startProgram, checkIn, toHijri, type HabitItem } from '@thekra/practice-core';
import { habitDayAction, habitNeedsFix, programRows } from '../lib/practice/my-habits';
import { ramadanSeasonUntil, showRamadanBlock } from '../lib/practice/plan-view';

const item = (over: Partial<HabitItem> = {}): HabitItem => ({
  kind: 'habit',
  planId: 'p1',
  required: 2,
  done: 0,
  remaining: 2,
  complete: false,
  ...over,
});

describe('habit row action', () => {
  it('asks to log when due and not done, shows done, stays quiet off-day, resumes when paused', () => {
    expect(habitDayAction({ paused: false, due: item() })).toBe('log');
    expect(habitDayAction({ paused: false, due: item({ done: 1, remaining: 1 }) })).toBe('log');
    expect(habitDayAction({ paused: false, due: item({ done: 2, remaining: 0, complete: true }) })).toBe('done');
    expect(habitDayAction({ paused: false, offDay: item() })).toBe('quiet');
    expect(habitDayAction({ paused: false, offDay: item({ complete: true }) })).toBe('done');
    expect(habitDayAction({ paused: true, due: item() })).toBe('resume');
    expect(habitDayAction({ paused: false })).toBeNull();
  });
});

describe('«تخفَّف» rows in «عاداتي»', () => {
  const today = '2026-11-01';
  const older = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' });
  const newer = checkIn(startProgram({ sinSlug: 'nazar', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }), today, 'held');

  it('lists the programs oldest first with their stage and days held', () => {
    const rows = programRows([newer, older], today);
    expect(rows.map((r) => r.startedOn)).toEqual(['2026-10-01', '2026-10-20']);
    expect(rows[0]!.stage).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.stages).toBeGreaterThanOrEqual(rows[0]!.stage);
    expect(rows[1]!.held).toBe(1);
    expect(rows[1]!.checkedIn).toBe(true);
    expect(rows[0]!.checkedIn).toBe(false);
  });

  it('offers «صلّحها» after a weak day or a slip, until today is held (owner round 3)', () => {
    const weak = checkIn(older, '2026-10-31', 'weak');
    expect(programRows([weak], today)[0]!.needsFix).toBe(true);
    expect(programRows([checkIn(weak, today, 'held')], today)[0]!.needsFix).toBe(false);
    expect(programRows([newer], today)[0]!.needsFix).toBe(false);
    expect(habitNeedsFix({ paused: false, missedYesterday: true, doneToday: 0 })).toBe(true);
    expect(habitNeedsFix({ paused: false, missedYesterday: true, doneToday: 2 })).toBe(false);
    expect(habitNeedsFix({ paused: true, missedYesterday: true, doneToday: 0 })).toBe(false);
    expect(habitNeedsFix({ paused: false, missedYesterday: false, doneToday: 0 })).toBe(false);
  });

  it('never carries the sin in anything the row could show or read aloud', () => {
    const text = JSON.stringify(programRows([newer, older], today));
    expect(text).not.toContain('ghibah');
    expect(text).not.toContain('nazar');
  });
});

describe('«وضع رمضان»', () => {
  it('has no season outside Ramadan (no 30-day stand-in)', () => {
    expect(ramadanSeasonUntil('2026-11-01', 0)).toBeNull();
    expect(showRamadanBlock(null, false)).toBe(false);
    // A season still running from before stays reachable, so it can be ended.
    expect(showRamadanBlock(null, true)).toBe(true);
  });

  it('runs to the last day of Ramadan (Umm al-Qura with the user’s offset)', () => {
    // Find a day inside Ramadan 1448 without hard-coding the calendar.
    let day = '2027-01-15';
    while (toHijri(day, 0).month !== 9) day = addDays(day, 1);
    const until = ramadanSeasonUntil(day, 0);
    expect(until).not.toBeNull();
    expect(toHijri(until!, 0).month).toBe(9);
    expect(toHijri(addDays(until!, 1), 0).month).toBe(10);
    expect(showRamadanBlock(until, false)).toBe(true);
  });
});
