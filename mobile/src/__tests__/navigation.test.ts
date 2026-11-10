/**
 * Round 5 (§1 IA): the three tabs and every row of «المزيد» carry the names of the shared navigation map
 * (practice-core `NAV_FEATURES`) in Arabic and English, and their routes; the tab bar's pill (the current tab only);
 * the home doors' sizes per screen width.
 */

import { APP_MORE, NAV_FEATURES, navFeature, navName } from '@thekra/practice-core';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { MORE_MENU, TABS, moreAction } from '../lib/nav/more-menu';
import { TAB_PILL, tabIconLook } from '../lib/nav/tab-bar';
import { HABITS_TABS, HABITS_TAB_FEATURE, parseHabitsTab } from '../lib/practice/hub-view';
import { HABITS_TABS as CORE_HABITS_TABS } from '@thekra/practice-core';
import { light } from '../theme/palette';
import { SMALL_PHONE, TABLET, doorLayout } from '../lib/home/door-layout';

const lookup = (dict: object, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown> | undefined)?.[part], dict);

describe('names and places follow the navigation map', () => {
  const items = MORE_MENU.flatMap((g) => g.items);

  it('names the three tabs as the map does, in both languages', () => {
    expect(TABS.map((tab) => tab.key)).toEqual(['home', 'habits', 'more']);
    for (const tab of TABS) {
      expect(lookup(ar, tab.labelKey)).toBe(navName(tab.key, 'ar'));
      expect(lookup(en, tab.labelKey)).toBe(navName(tab.key, 'en'));
    }
    expect(navFeature('habits')?.app).toBe('/habits');
    expect(navFeature('more')?.app).toBe('/more');
  });

  it('names every «المزيد» row as the map does and opens the map’s app route', () => {
    for (const item of items) {
      const f = navFeature(item.key);
      expect(f).toBeDefined();
      expect(lookup(ar, item.labelKey)).toBe(f!.ar);
      expect(lookup(en, item.labelKey)).toBe(f!.en);
      expect(item.path).toBe(f!.app);
    }
    // The settings group heading is the map's «الإعدادات».
    const settings = MORE_MENU.find((g) => g.key === 'settings')!;
    expect(lookup(ar, settings.titleKey)).toBe(navName('settings', 'ar'));
    expect(lookup(en, settings.titleKey)).toBe(navName('settings', 'en'));
  });

  it('lists the plan’s groups in order, each screen once, the settings rows last', () => {
    // Round 6 (practice-core APP_MORE): the web «المزيد» + «بستان العادات», then the settings rows; no «تصفّح النصوص», no people page.
    expect(items.map((i) => i.key)).toEqual([
      'strategies',
      'saved',
      'circles',
      'garden',
      'account',
      'privacy',
      'notifications',
      'prayer-times',
      'appearance',
      'about',
    ]);
    expect(items.map((i) => i.key)).toEqual([...APP_MORE.mine, ...APP_MORE.settings]);
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
    // Every app feature of the map's settings group has a row (none is lost with the old settings tab).
    for (const f of NAV_FEATURES.filter((x) => x.group === 'settings' && x.parent === 'settings' && x.app)) {
      expect(items.some((i) => i.key === f.key)).toBe(true);
    }
  });

  it('names the five «عاداتي» tabs as the map does; `?tab=` opens one, old links still land, anything else «اليوم»', () => {
    // Round 6 (§2): «اليوم · العادات · الأعمال الدورية · محاسبتي · سجلّي», in the map's order (HABITS_TABS there).
    expect(HABITS_TABS.map((tab) => HABITS_TAB_FEATURE[tab])).toEqual([...CORE_HABITS_TABS]);
    for (const tab of HABITS_TABS) {
      const f = navFeature(HABITS_TAB_FEATURE[tab])!;
      expect(f.app).toBe(`/habits?tab=${tab}`);
      expect(lookup(ar, `habitsTab.tabs.${tab}`)).toBe(f.ar);
      expect(lookup(en, `habitsTab.tabs.${tab}`)).toBe(f.en);
    }
    expect(parseHabitsTab('review')).toBe('review');
    expect(parseHabitsTab(['record'])).toBe('record');
    expect(parseHabitsTab('habits')).toBe('habits');
    // Links from earlier builds and notifications.
    expect(parseHabitsTab('wird')).toBe('today');
    expect(parseHabitsTab('people')).toBe('periodic');
    expect(parseHabitsTab('stats')).toBe('today');
    expect(parseHabitsTab(undefined)).toBe('today');
    // «صلة الرحم والأحباب» opens inside «الأعمال الدورية», never a tab of its own.
    expect(navFeature('silat')?.app).toBe('/habits?tab=periodic');
  });

  it('asks a guest to sign in for members-only rows, never for reading or account rows', () => {
    // Round 6: «أهلي وناسي» and «تصفّح النصوص» are gone from the map.
    const saved = items.find((i) => i.key === 'saved')!;
    const about = items.find((i) => i.key === 'about')!;
    const account = items.find((i) => i.key === 'account')!;
    expect(moreAction(saved, false)).toEqual({ kind: 'signIn', next: '/favorites' });
    expect(moreAction(saved, true)).toEqual({ kind: 'open', href: '/favorites' });
    expect(moreAction(about, false)).toEqual({ kind: 'open', href: '/settings/about' });
    expect(moreAction(account, false)).toEqual({ kind: 'open', href: '/settings/account' });
    expect(items.some((i) => (i.key as string) === 'browse' || (i.key as string) === 'people')).toBe(false);
  });
});

describe('tab bar', () => {
  it('draws the soft pill behind the current tab only, the same for every tab', () => {
    expect(tabIconLook(true, light)).toEqual({ pill: light.primarySoft, strokeWidth: 1.8 });
    expect(tabIconLook(false, light)).toEqual({ pill: 'transparent', strokeWidth: 1.4 });
    // One rule, so no tab (formerly «ورد اليوم») keeps a pill while another is current.
    const tabs = TABS.map((tab) => tab.name);
    const current = 'habits';
    expect(tabs.filter((tab) => tabIconLook(tab === current, light).pill !== 'transparent')).toEqual(['habits']);
    expect(TAB_PILL.width).toBeGreaterThan(TAB_PILL.height);
  });
});

describe('home doors', () => {
  it('steps down on small phones, keeps one column on phones and two on tablets', () => {
    const small = doorLayout(SMALL_PHONE - 40);
    const phone = doorLayout(390);
    const tablet = doorLayout(TABLET + 168);
    expect(small.columns).toBe(1);
    expect(small.titleSize).toBeLessThan(phone.titleSize);
    expect(small.padding).toBeLessThan(phone.padding);
    expect(phone.columns).toBe(1);
    expect(tablet.columns).toBe(2);
    expect(doorLayout(1280).maxWidth).toBeLessThan(1280);
    for (const l of [small, phone, tablet]) expect(l.titleLine / l.titleSize).toBeGreaterThanOrEqual(1.5);
    // The plant has its own square, smaller on small phones, and always leaves most of the width to the words.
    expect(small.art).toBeLessThan(phone.art);
    for (const [w, l] of [[320, small], [390, phone], [768, tablet]] as const) expect(l.art).toBeLessThan((w / l.columns) * 0.3);
  });
});
