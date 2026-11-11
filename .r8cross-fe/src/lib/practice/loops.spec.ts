import { describe, expect, it } from 'vitest';
import { activeSinLoops, createPlan, emptyStore, startProgram, type Store } from '@thekra/practice-core';
import { cleanHabitLoopInput, cleanSinLoopInput, deleteHabitLoop, deleteSinLoop, saveHabitLoop, saveSinLoop } from './loops';

const blankHabit = { cue: '', craving: '', routine: '', reward: '', obstacle: '', ifThen: '' };
const blankSin = { trigger: '', feeling: '', craving: '', act: '', after: '', alternative: '' };

function store(): Store {
  return {
    ...emptyStore(),
    plans: [createPlan({ id: 'p1', deedSlug: 'quran', title: 'ورد', unit: 'minutes', amount: 5, activeDaysPerWeek: 7, slots: ['06:00'], createdOn: '2026-10-01' })],
    programs: [startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' })],
  };
}

describe('habit loops', () => {
  it('adds, edits (clearing an optional answer) and deletes a loop on the plan', () => {
    const input = cleanHabitLoopInput({ ...blankHabit, cue: ' بعد الفجر ', routine: 'صفحة', obstacle: 'النوم' });
    expect(input).toEqual({ cue: 'بعد الفجر', craving: '', routine: 'صفحة', reward: '', obstacle: 'النوم' });
    let s = saveHabitLoop(store(), 'p1', null, input, 'loop-1');
    expect(s.plans[0]?.loops?.[0]).toMatchObject({ id: 'loop-1', cue: 'بعد الفجر', obstacle: 'النوم' });
    s = saveHabitLoop(s, 'p1', 'loop-1', cleanHabitLoopInput({ ...blankHabit, routine: 'صفحتان' }));
    expect(s.plans[0]?.loops?.[0]?.routine).toBe('صفحتان');
    expect(s.plans[0]?.loops?.[0]?.obstacle).toBeUndefined();
    s = deleteHabitLoop(s, 'p1', 'loop-1');
    expect(s.plans[0]?.loops).toBeUndefined();
  });

  it('rejects a loop without a routine', () => {
    expect(() => saveHabitLoop(store(), 'p1', null, cleanHabitLoopInput(blankHabit), 'x')).toThrow();
  });
});

describe('sin loops', () => {
  it('adds, edits and removes a loop inside the program (a removal leaves a marker)', () => {
    let s = saveSinLoop(store(), 'ghibah', null, cleanSinLoopInput({ ...blankSin, trigger: 'مجلس', alternative: 'أغيّر الحديث' }), 's1');
    expect(activeSinLoops(s.programs[0]!)).toHaveLength(1);
    s = saveSinLoop(s, 'ghibah', 's1', cleanSinLoopInput({ ...blankSin, trigger: 'هاتف' }));
    expect(activeSinLoops(s.programs[0]!)[0]?.trigger).toBe('هاتف');
    s = deleteSinLoop(s, 'ghibah', 's1');
    expect(activeSinLoops(s.programs[0]!)).toHaveLength(0);
    expect(s.programs[0]?.loops?.[0]?.removedAt).toBeDefined();
  });
});
