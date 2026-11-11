import { describe, expect, it } from 'vitest';
import { createPlan, STRATEGIES, strategyAppliesToHabit } from '@thekra/practice-core';
import { applySuggestion, quoted, strategyTarget, type SuggestionWords } from './strategies';

describe('strategyTarget', () => {
  it('maps every strategy to a page of the site', () => {
    for (const strategy of STRATEGIES) {
      const { href } = strategyTarget(strategy.action);
      const path = typeof href === 'string' ? href : href.pathname;
      expect(path.startsWith('/'), strategy.key).toBe(true);
    }
  });

  it('turns on the evening review or the pledges only for those strategies', () => {
    expect(strategyTarget('evening').heart).toEqual({ eveningReview: true });
    expect(strategyTarget('pledges')).toEqual({ href: '/practice/review' });
    expect(strategyTarget('add')).toEqual({ href: { pathname: '/practice', query: { add: '1' } } });
    expect(strategyTarget('moment').heart).toBeUndefined();
  });
});

// The families and the unlisted «لا تفوّتها مرتين» are tested in practice-core (test/round6.test.ts).

describe('«طبّقها على عادة» (round 7, C2)', () => {
  const base = createPlan(
    { id: 'p1', deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['05:30'], createdOn: '2026-10-01' },
    '2026-11-10T08:00:00.000Z',
  );
  const words: SuggestionWords = { amount: (n) => `${n} دقائق`, prayer: (p) => (p === 'fajr' ? 'الفجر' : p) };
  const t = (key: string, values?: Record<string, string>) => `${key}|${Object.values(values ?? {}).join(',')}`;

  it('offers an answer built from the habit itself', () => {
    expect(applySuggestion('start-tiny', { ...base, minimum: 2 }, words, t)).toBe('items.start-tiny.suggest|2 دقائق');
    expect(applySuggestion('if-then', { ...base, minimum: 2 }, words, t)).toBe('items.if-then.suggest|2 دقائق');
    expect(applySuggestion('make-up', base, words, t)).toBe('items.make-up.suggest|');
  });

  it('ties to the prayer the habit already follows, and offers nothing it cannot know', () => {
    expect(applySuggestion('anchor-prayer', { ...base, slotAnchors: ['after-fajr'] }, words, t)).toBe('items.anchor-prayer.suggest|الفجر');
    expect(applySuggestion('anchor-prayer', base, words, t)).toBe('');
    expect(applySuggestion('prepare-place', base, words, t)).toBe('');
    expect(applySuggestion('bundle', base, words, t)).toBe('');
  });

  it('has a suggestion or a hint for every strategy applied to a habit', () => {
    for (const strategy of STRATEGIES) {
      if (strategyAppliesToHabit(strategy.key)) expect(['start-tiny', 'anchor-prayer', 'if-then', 'prepare-place', 'make-up', 'bundle']).toContain(strategy.key);
    }
  });
});

describe('quoted (round 7, C2)', () => {
  it('quotes a habit name once', () => {
    expect(quoted('ورد القرآن', false)).toBe('«ورد القرآن»');
    expect(quoted('«سبحان الله وبحمده» صباحًا ومساءً', false)).toBe('«سبحان الله وبحمده» صباحًا ومساءً');
    expect(quoted('Quran wird', true)).toBe('“Quran wird”');
  });
});
