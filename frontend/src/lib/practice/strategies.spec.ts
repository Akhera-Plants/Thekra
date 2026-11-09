import { describe, expect, it } from 'vitest';
import { STRATEGIES, strategyAppliesToHabit } from '@thekra/practice-core';
import { APPLY_FIELD, applyStrategyDraft, exampleAnswer, strategyTarget } from './strategies';

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

describe('«طبّقها على عادة» (C-18 a)', () => {
  const empty = { cue: '', craving: '', routine: '', reward: '', obstacle: '', ifThen: '' };

  it('has a loop question for every strategy that applies to a habit', () => {
    for (const strategy of STRATEGIES) {
      if (strategyAppliesToHabit(strategy.key)) expect(APPLY_FIELD[strategy.key], strategy.key).toBeDefined();
    }
  });

  it('fills the strategy question with its example, without the «مثال:» lead', () => {
    expect(exampleAnswer('مثال: دقيقتان من القرآن بدل جزء كامل.')).toBe('دقيقتان من القرآن بدل جزء كامل.');
    expect(exampleAnswer('Example: two minutes of Quran.')).toBe('two minutes of Quran.');
    expect(applyStrategyDraft('start-tiny', empty, 'مثال: دقيقتان.').routine).toBe('دقيقتان.');
  });

  it('never replaces a written answer, and leaves a leaving strategy alone', () => {
    expect(applyStrategyDraft('start-tiny', { ...empty, routine: 'صفحة' }, 'مثال: دقيقتان.').routine).toBe('صفحة');
    expect(applyStrategyDraft('block-sin', empty, 'مثال: احذف التطبيق.')).toEqual(empty);
  });
});
