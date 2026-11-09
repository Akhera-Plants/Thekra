import { describe, expect, it } from 'vitest';
import { STRATEGIES } from '@thekra/practice-core';
import { strategyTarget } from './strategies';

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
