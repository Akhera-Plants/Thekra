/**
 * The side menu (groups, members-only items, the inline-end side in each direction), the tab bar's pill (the current
 * tab only), the Settings groups and the home doors' sizes per screen width.
 */

import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { SIDE_MENU, drawerOffset, drawerWidth, sideMenuAction } from '../lib/nav/side-menu';
import { TAB_PILL, tabIconLook } from '../lib/nav/tab-bar';
import { light } from '../theme/palette';
import { SETTINGS_GROUPS } from '../lib/settings/groups';
import { SMALL_PHONE, TABLET, doorLayout } from '../lib/home/door-layout';

const lookup = (dict: object, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown> | undefined)?.[part], dict);

describe('side menu', () => {
  const items = SIDE_MENU.flatMap((g) => g.items);

  it('lists the owner’s screens once each, in order: «تخفَّف» out, «استكشف النصوص» and «مواسم الخير» in', () => {
    expect(items.map((i) => lookup(ar, i.labelKey))).toEqual([
      'أعمال دورية',
      'المحاسبة',
      'استراتيجيات العادات',
      'رفقة',
      'استكشف النصوص',
      'المحفوظات',
      'مواسم الخير',
    ]);
    expect(items.some((i) => i.path === '/practice/sin-program')).toBe(false);
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
  });

  it('has a heading and labels in both languages', () => {
    for (const dict of [ar, en]) {
      for (const group of SIDE_MENU) expect(typeof lookup(dict, group.titleKey)).toBe('string');
      for (const entry of items) expect(typeof lookup(dict, entry.labelKey)).toBe('string');
    }
  });

  it('asks a guest to sign in for members-only items, never for «استكشف النصوص» or «مواسم الخير»', () => {
    const reviews = items.find((i) => i.key === 'reviews')!;
    const seasons = items.find((i) => i.key === 'seasons')!;
    const browse = items.find((i) => i.key === 'browse')!;
    expect(sideMenuAction(reviews, false)).toEqual({ kind: 'signIn', next: '/practice/reviews' });
    expect(sideMenuAction(reviews, true)).toEqual({ kind: 'open', href: '/practice/reviews' });
    expect(sideMenuAction(seasons, false)).toEqual({ kind: 'open', href: '/practice/calendar' });
    expect(sideMenuAction(browse, false)).toEqual({ kind: 'open', href: '/browse' });
  });

  it('opens on the menu button’s side: the left in Arabic, the right in English', () => {
    expect(drawerOffset(true, 300)).toEqual({ side: 'left', hiddenX: -300 });
    expect(drawerOffset(false, 300)).toEqual({ side: 'right', hiddenX: 300 });
    expect(drawerWidth(360)).toBe(302);
    expect(drawerWidth(1024)).toBe(340);
  });
});

describe('tab bar', () => {
  it('draws the soft pill behind the current tab only, the same for every tab', () => {
    expect(tabIconLook(true, light)).toEqual({ pill: light.primarySoft, strokeWidth: 1.8 });
    expect(tabIconLook(false, light)).toEqual({ pill: 'transparent', strokeWidth: 1.4 });
    // One rule, so no tab (formerly «ورد اليوم») keeps a pill while another is current.
    const tabs = ['index', 'habits', 'record', 'settings'];
    const current = 'record';
    expect(tabs.filter((tab) => tabIconLook(tab === current, light).pill !== 'transparent')).toEqual(['record']);
    expect(TAB_PILL.width).toBeGreaterThan(TAB_PILL.height);
  });
});

describe('settings groups', () => {
  it('is a short list of distinct groups, each named in both languages', () => {
    expect(SETTINGS_GROUPS.length).toBeLessThanOrEqual(7);
    expect(new Set(SETTINGS_GROUPS.map((g) => g.key)).size).toBe(SETTINGS_GROUPS.length);
    for (const dict of [ar, en]) for (const group of SETTINGS_GROUPS) expect(typeof lookup(dict, group.titleKey)).toBe('string');
    expect(SETTINGS_GROUPS.map((g) => lookup(ar, g.titleKey))).toEqual([
      'الحساب',
      'التنبيهات والتذكير',
      'أوقات الصلاة',
      'الخصوصية والتشفير',
      'اللغة والمظهر',
      'عن التطبيق',
    ]);
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
