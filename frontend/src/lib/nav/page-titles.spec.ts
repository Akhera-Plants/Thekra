import { describe, expect, it } from 'vitest';
import { navFeature } from '@thekra/practice-core';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { SAVED_TAB_ROUTES } from './saved-tabs';
import { strategyTarget } from '@/lib/practice/strategies';

type Messages = typeof ar;

/** Reads a dotted message key (`a.b.c`) of one language. */
function message(messages: Messages, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);
}

/**
 * The page titles and the settings rows of the round-5 pages (owner round 5, F-34 a / W-11 c): each one is the shared
 * navigation map's name of its feature, in Arabic and in English, so the website and the app cannot drift apart again.
 * Feature key → the message key the page shows as its title (or row label).
 */
const TITLES: Record<string, string> = {
  'leave-sin': 'leaveSin.title',
  moment: 'leaveSin.moment.title',
  notifications: 'practice.notify.title',
  settings: 'settings.pageTitle',
  saved: 'favorites.pageTitle',
  'saved-texts': 'favorites.tabs.texts',
  'my-reminders': 'favorites.tabs.reminders',
  branches: 'branches.pageTitle',
  strategies: 'practice.strategies.title',
  // «الإعدادات» rows, in the app's order.
  account: 'settings.rows.account',
  'prayer-times': 'settings.rows.prayerTimes',
  appearance: 'settings.rows.appearance',
  about: 'settings.rows.about',
};

describe('page titles follow the shared navigation map (ar + en)', () => {
  for (const [key, messageKey] of Object.entries(TITLES)) {
    it(key, () => {
      const feature = navFeature(key);
      expect(feature, key).toBeDefined();
      expect(message(ar, messageKey), `ar ${messageKey}`).toBe(feature?.ar);
      expect(message(en, messageKey), `en ${messageKey}`).toBe(feature?.en);
    });
  }

  it('names the «التنبيهات» row as its page', () => {
    expect(ar.settings.rows.notifications).toBe(navFeature('notifications')?.ar);
    expect(en.settings.rows.notifications).toBe(navFeature('notifications')?.en);
  });
});

describe('links of these pages use the map’s routes', () => {
  it('opens each «المحفوظات» tab at its own address', () => {
    expect(SAVED_TAB_ROUTES).toEqual({ texts: navFeature('saved-texts')?.web, reminders: navFeature('my-reminders')?.web });
  });

  it('sends «جرّبها» of the strategies to round-5 places only', () => {
    // Round 6: «أهلي وناسي» is gone; «تفقّد صديق» opens «صلة الرحم والأحباب» inside the periodic acts.
    const webRoutes = new Set(['/practice', '/practice/record', '/practice/review', '/practice/periodic', '/practice/leave-sin', '/practice/leave-sin/moment']);
    for (const action of ['add', 'habits', 'wird', 'record', 'seasons', 'moment', 'leaveSin', 'friends', 'pledges', 'evening'] as const) {
      const { href } = strategyTarget(action);
      expect(webRoutes.has(typeof href === 'string' ? href : href.pathname), action).toBe(true);
    }
    expect(strategyTarget('moment').href).toBe(navFeature('moment')?.web);
    expect(strategyTarget('leaveSin').href).toBe(navFeature('leave-sin')?.web);
  });
});
