/** Phase 5 on the app: every strategy opens a screen, opt-in switches only for theirs, and the new prefs parse. */

import { DEFAULT_NOTIFICATION_PREFS, STRATEGIES } from '@thekra/practice-core';
import { parsePrefs, DEFAULT_PREFS } from '../lib/practice/prefs';
import { notificationPrefsOf } from '../lib/practice/reminders';
import { listedStrategies, strategyTarget } from '../lib/practice/strategies';

describe('strategies', () => {
  it('maps every listed strategy to an app route, «أتبِع السيئةَ الحسنة» to the deeds list, never «تخفَّف»', () => {
    for (const s of listedStrategies()) {
      const target = strategyTarget(s.action, s.key);
      if (s.key === 'follow-good') {
        expect(target.kind).toBe('deeds');
        continue;
      }
      if (target.kind !== 'screen') throw new Error(s.key);
      const path = typeof target.href === 'string' ? target.href : (target.href as { pathname: string }).pathname;
      expect(path.startsWith('/')).toBe(true);
    }
    const heart = (action: Parameters<typeof strategyTarget>[0]) => {
      const target = strategyTarget(action);
      return target.kind === 'screen' ? target.heart : undefined;
    };
    expect(heart('evening')).toEqual({ eveningReview: true });
    // Round 5 (F-08 a): no pledge set-up any more; «إذا… فإني…» lives in each habit's «عدّل».
    expect(heart('pledges')).toBeUndefined();
    expect(heart('add')).toBeUndefined();
  });

  it('does not list «لا تفوّتها مرتين» (it appears the day after a missed habit)', () => {
    expect(listedStrategies().map((s) => s.key)).not.toContain('never-twice');
    expect(listedStrategies()).toHaveLength(STRATEGIES.length - 1);
  });

  it('keeps no strategy reminder prefs any more (round 5, F-12 a)', () => {
    expect(DEFAULT_PREFS).not.toHaveProperty('strategies');
    const prefs = parsePrefs({ v: 1, strategies: ['company', 'nope', 'start-tiny'], strategyTime: '09:30' });
    expect(prefs).not.toHaveProperty('strategies');
    expect(notificationPrefsOf(prefs)).toMatchObject({ strategies: [], strategyTime: DEFAULT_NOTIFICATION_PREFS.strategyTime });
  });
});
