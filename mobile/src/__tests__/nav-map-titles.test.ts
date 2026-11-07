/**
 * Owner round 5 (F-34 a, round plan §1 «Shared map»): the titles of the settings screens, «المحفوظات» and its tabs,
 * «تخفَّف», «لحظة مجاهدة» and «استراتيجيات العادات» are the names of practice-core `NAV_FEATURES`, in Arabic and in
 * English, and each sits at the app route the map gives. A rename that is not made in the map first fails here.
 */

import { navFeature } from '@thekra/practice-core';
import ar from '@/lib/i18n/ar.json';
import en from '@/lib/i18n/en.json';
import { favoritesTab } from '@/lib/saved-tabs';

// Node's fs and path through Jest (the app's tsconfig has no Node types); jest runs from mobile/.
const { existsSync, readFileSync } = jest.requireActual<{ existsSync: (p: string) => boolean; readFileSync: (p: string, enc: 'utf8') => string }>('fs');
const { join } = jest.requireActual<{ join: (...parts: string[]) => string }>('path');
const { cwd } = jest.requireActual<{ cwd: () => string }>('process');
const APP = join(cwd(), 'app');

function message(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  return typeof node === 'string' ? node : undefined;
}

/** The screen file of an app href without its query (`/settings/notifications` → app/settings/notifications.tsx). */
function screenFile(href: string): string {
  const path = href.split('?')[0]!;
  return join(APP, `${path}.tsx`);
}

// [feature key, the i18n key of the screen's title, the file that shows that title (relative to app/)]
const TITLES: readonly [string, string, string][] = [
  ['account', 'settings.groups.account', 'settings/account.tsx'],
  ['notifications', 'settings.groups.notifications', 'settings/notifications.tsx'],
  ['appearance', 'settings.groups.appearance', 'settings/appearance.tsx'],
  ['about', 'settings.about', 'settings/about.tsx'],
  ['saved', 'favorites.title', 'favorites.tsx'],
  ['saved-texts', 'favorites.tabTexts', 'favorites.tsx'],
  ['my-reminders', 'myReminders.title', 'favorites.tsx'],
  ['leave-sin', 'sinProgram.title', 'practice/sin-program.tsx'],
  ['moment', 'sinProgram.moment.title', 'practice/moment.tsx'],
  ['strategies', 'practice.strategies.title', 'practice/strategies.tsx'],
];

describe('nav-map: screen titles (round 5, F-34 a)', () => {
  it.each(TITLES)('%s is titled as the map names it, in Arabic and English', (key, i18nKey, file) => {
    const feature = navFeature(key);
    expect(feature).toBeDefined();
    expect(message(ar, i18nKey)).toBe(feature!.ar);
    expect(message(en, i18nKey)).toBe(feature!.en);
    // The screen really uses that key (not a look-alike string).
    expect(readFileSync(join(APP, file), 'utf8')).toContain(`t('${i18nKey}')`);
  });

  it.each(['account', 'notifications', 'appearance', 'about', 'saved', 'leave-sin', 'moment', 'strategies'])(
    '%s has a screen at the app route of the map',
    (key) => {
      const app = navFeature(key)?.app;
      expect(app).toBeTruthy();
      expect(existsSync(screenFile(app!))).toBe(true);
    },
  );

  it('opens «المحفوظات» on the tab the map names (and the older ?part=mine on «تذكيراتي»)', () => {
    const tabOf = (key: string) => new URLSearchParams(navFeature(key)!.app!.split('?')[1]).get('tab') ?? undefined;
    expect(favoritesTab({ tab: tabOf('saved-texts') })).toBe('texts');
    expect(favoritesTab({ tab: tabOf('my-reminders') })).toBe('reminders');
    expect(favoritesTab({ part: 'mine' })).toBe('reminders');
    expect(favoritesTab({})).toBe('texts');
    // The old route redirects into the same tab.
    expect(readFileSync(join(APP, 'practice/my-reminders.tsx'), 'utf8')).toContain("params: { tab: 'reminders' }");
  });
});
