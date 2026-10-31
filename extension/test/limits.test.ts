import { createPlan, emptyStore, pausePlan, upsertPlan, type Plan, type Store } from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import type { Habit } from '../src/catalog.js';
import { draftLimitError } from '../src/limits.js';
import { localInstant, shouldNotify, upcomingReminders } from '../src/scheduler.js';

const TODAY = '2026-10-28';
const habit = (key: string, kind?: 'periodic'): Habit => ({
  key,
  ...(kind ? { kind } : {}),
  titleAr: key,
  titleEn: key,
  deed: 'quran',
  unit: 'minutes',
  unitLabelAr: 'دقيقة',
  unitLabelEn: 'minutes',
  start: { far: 2, near: 5 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['09:00'],
  basis: 'organizational',
  evidence: [],
});
const catalog = [habit('a'), habit('b'), habit('c'), habit('d'), habit('w', 'periodic')];
const plan = (key: string, slots = ['09:00', '21:00']): Plan =>
  createPlan({ id: `id-${key}`, habitKey: key, deedSlug: 'quran', title: key, unit: 'minutes', amount: 5, activeDaysPerWeek: 4, slots, createdOn: '2026-10-01' });
const storeOf = (...plans: Plan[]): Store => plans.reduce((s, p) => upsertPlan(s, p), emptyStore());

describe('limits in the extension (practice-core)', () => {
  it('refuses a fourth sapling, allows a periodic act beside three, and a paused plan does not count', () => {
    const three = storeOf(plan('a'), plan('b'), plan('c'));
    expect(draftLimitError(three, new Set(['a', 'b', 'c', 'd']), catalog, TODAY)).toBe('errorLimitSapling');
    expect(draftLimitError(three, new Set(['a', 'b', 'c', 'w']), catalog, TODAY)).toBeNull();
    expect(draftLimitError(three, new Set(['a', 'b', 'c']), catalog, TODAY)).toBeNull();
    const paused = storeOf(plan('a'), plan('b'), pausePlan(plan('c'), TODAY));
    expect(draftLimitError(paused, new Set(['a', 'b', 'c', 'd']), catalog, TODAY)).toBeNull();
  });

  it('a paused plan gets no reminder and no notification; an established one reminds in its first slot only', () => {
    const now = new Date(localInstant(TODAY, '08:00'));
    const paused = pausePlan(plan('a'), TODAY);
    expect(upcomingReminders({ plans: [paused], quietDays: [], hijriOffset: 0, now }, 3)).toEqual([]);
    expect(shouldNotify(paused, TODAY, now)).toBe(false);
    const established = { ...plan('b'), establishedOn: '2026-10-20' };
    const times = upcomingReminders({ plans: [established], quietDays: [], hijriOffset: 0, now }, 3).map((r) => r.time);
    expect(times).toEqual(['09:00', '09:00', '09:00']);
  });
});
