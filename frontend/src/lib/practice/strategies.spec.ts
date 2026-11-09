import { describe, expect, it } from 'vitest';
import { STRATEGIES } from '@thekra/practice-core';
import { appliesToHabit, listedStrategies, STRATEGY_KINDS, strategyKind, strategyTarget } from './strategies';

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

describe('listedStrategies', () => {
  it('leaves «لا تفوّتها مرتين» out of the list (it shows on the habit row instead)', () => {
    const keys = listedStrategies(STRATEGIES).map((s) => s.key);
    expect(keys).not.toContain('never-twice');
    expect(keys).toHaveLength(STRATEGIES.length - 1);
  });
});

describe('strategy families (round 6, C-18 a)', () => {
  it('gives every practice-core strategy one family, «ترك» strategies never «طبّقها على عادة»', () => {
    for (const strategy of STRATEGIES) {
      expect(STRATEGY_KINDS).toContain(strategyKind(strategy.key));
      expect(appliesToHabit(strategy.key)).toBe(strategyKind(strategy.key) !== 'leave');
    }
    expect(STRATEGIES.filter((s) => strategyKind(s.key) === 'return').map((s) => s.key)).toEqual(['never-twice', 'make-up', 'self-review']);
  });
});
