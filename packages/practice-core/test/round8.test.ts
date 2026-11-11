import { describe, expect, it } from 'vitest';
import {
  cleanNote,
  createPlan,
  emptyHeart,
  emptyStore,
  eveningOf,
  parseHeart,
  periodAnswers,
  reviewSteps,
  REVIEW_NOTE_MAX,
  REVIEW_STEP_ROWS,
  saveEvening,
  saveWeeklyReview,
  serializeHeart,
  setReflection,
  upsertPlan,
  weeklyOf,
  type Plan,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';

function plan(id: string): Plan {
  return createPlan({ id, deedSlug: 'x', title: id, unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-10-01' }, NOW);
}

describe('round 8: review forms', () => {
  it('cleans own-words fields (single spaces, 280 characters, empty dropped)', () => {
    expect(cleanNote('  قيام   الليل \n أعانني  ')).toBe('قيام الليل أعانني');
    expect(cleanNote('   ')).toBeUndefined();
    expect(cleanNote(3)).toBeUndefined();
    expect(cleanNote('ا'.repeat(500))).toHaveLength(REVIEW_NOTE_MAX);
  });

  it('saves and reads the weekly fields, many steps, the heart note', () => {
    const data = saveWeeklyReview(
      emptyHeart(),
      {
        weekOf: '2026-10-30',
        steady: [],
        weak: [],
        helped: ' الصحبة ',
        hard: 'السهر',
        change: 'أنام مبكرًا',
        heart: 'middle',
        heartNote: 'متعب قليلًا',
        steps: [
          { planId: 'a', choice: 'lighten' },
          { planId: 'b', choice: 'keep' },
          { planId: 'a', choice: 'increase' },
        ],
      },
      NOW,
    );
    const w = weeklyOf(parseHeart(serializeHeart(data)), '2026-10-30');
    expect(w).toMatchObject({ helped: 'الصحبة', hard: 'السهر', change: 'أنام مبكرًا', heartNote: 'متعب قليلًا', heart: 'middle' });
    expect(w?.steps).toEqual([
      { planId: 'a', choice: 'lighten' },
      { planId: 'b', choice: 'keep' },
    ]);
    expect(w?.step).toEqual({ planId: 'a', choice: 'lighten' });
  });

  it('saves an empty form: no fields, still a review', () => {
    const data = saveWeeklyReview(emptyHeart(), { weekOf: '2026-10-30', steady: [], weak: [], helped: '  ', hard: '', change: undefined }, NOW);
    const w = weeklyOf(data, '2026-10-30');
    expect(w).toBeDefined();
    expect(w).not.toHaveProperty('helped');
    expect(w).not.toHaveProperty('steps');
  });

  it('caps the steps at the listed rows', () => {
    const steps = ['a', 'b', 'c', 'd', 'e'].map((planId) => ({ planId, choice: 'keep' as const }));
    const w = weeklyOf(saveWeeklyReview(emptyHeart(), { weekOf: '2026-10-30', steady: [], weak: [], steps }, NOW), '2026-10-30');
    expect(w?.steps).toHaveLength(REVIEW_STEP_ROWS);
  });

  it('still reads an old review with a single step', () => {
    const old = { v: 1, weekly: [{ weekOf: '2026-10-23', steady: [], weak: [], step: { planId: 'a', choice: 'keep' }, heart: 'present', savedAt: NOW }] };
    const w = weeklyOf(parseHeart(old), '2026-10-23');
    expect(w && reviewSteps(w)).toEqual([{ planId: 'a', choice: 'keep' }]);
    expect(w?.helped).toBeUndefined();
  });

  it('saves the evening fields and keeps old evenings readable', () => {
    let data = saveEvening(emptyHeart(), { date: '2026-10-28', kept: 'yes', helped: 'الأذكار', hard: ' ', tomorrow: 'أبكّر في النوم' });
    data = parseHeart(serializeHeart(data));
    expect(eveningOf(data, '2026-10-28')).toEqual({ date: '2026-10-28', kept: 'yes', helped: 'الأذكار', tomorrow: 'أبكّر في النوم' });
    expect(parseHeart({ v: 1, evenings: [{ date: '2026-10-27', kept: 'no' }] }).evenings).toEqual([{ date: '2026-10-27', kept: 'no' }]);
  });

  it('collects the week\'s daily answers as chips, newest first, each once', () => {
    let store = upsertPlan(upsertPlan(emptyStore(), plan('a'), NOW), plan('b'), NOW);
    store = setReflection(store, { planId: 'a', date: '2026-10-26', today: '2026-10-30', helped: 'الصحبة', hard: 'التعب' }, NOW);
    store = setReflection(store, { planId: 'b', date: '2026-10-28', today: '2026-10-30', helped: 'الصحبة', hard: 'السهر' }, NOW);
    store = setReflection(store, { planId: 'a', date: '2026-10-10', today: '2026-10-30', helped: 'قديم' }, NOW);
    expect(periodAnswers(store, '2026-10-24', '2026-10-30')).toEqual({ helped: ['الصحبة'], hard: ['السهر', 'التعب'] });
  });
});
