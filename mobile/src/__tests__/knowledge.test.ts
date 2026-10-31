/** Phase 5 on the app: every strategy opens a screen, opt-in switches only for theirs, and the new prefs parse. */

import { DEFAULT_NOTIFICATION_PREFS, STRATEGIES } from '@thekra/practice-core';
import { parsePrefs, DEFAULT_PREFS } from '../lib/practice/prefs';
import { notificationPrefsOf } from '../lib/practice/reminders';
import { strategyTarget } from '../lib/practice/strategies';

describe('strategies', () => {
  it('maps every strategy to an app route', () => {
    for (const s of STRATEGIES) {
      const { href } = strategyTarget(s.action);
      const path = typeof href === 'string' ? href : (href as { pathname: string }).pathname;
      expect(path.startsWith('/')).toBe(true);
    }
    expect(strategyTarget('evening').heart).toEqual({ eveningReview: true });
    expect(strategyTarget('pledges').heart).toEqual({ pledges: true });
    expect(strategyTarget('add').heart).toBeUndefined();
  });

  it('keeps the chosen strategies and their time in the prefs, opt-in by default', () => {
    expect(DEFAULT_PREFS.strategies).toEqual([]);
    const prefs = parsePrefs({ v: 1, strategies: ['company', 'nope', 'start-tiny'], strategyTime: '09:30' });
    expect(prefs.strategies).toEqual(['start-tiny', 'company']);
    expect(notificationPrefsOf(prefs)).toMatchObject({ strategies: ['start-tiny', 'company'], strategyTime: '09:30' });
    expect(parsePrefs({ v: 1, strategyTime: 'x' }).strategyTime).toBe(DEFAULT_NOTIFICATION_PREFS.strategyTime);
  });
});
