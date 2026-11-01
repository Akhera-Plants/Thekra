/**
 * The side menu (groups, members-only items, the inline-start side in each direction), the Settings groups and the
 * home doors' sizes per screen width.
 */

import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { SIDE_MENU, drawerOffset, drawerWidth, sideMenuAction } from '../lib/nav/side-menu';
import { SETTINGS_GROUPS } from '../lib/settings/groups';
import { SMALL_PHONE, TABLET, doorLayout } from '../lib/home/door-layout';

const lookup = (dict: object, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown> | undefined)?.[part], dict);

describe('side menu', () => {
  const items = SIDE_MENU.flatMap((g) => g.items);

  it('lists the owner’s seven screens once each, in order', () => {
    expect(items.map((i) => lookup(ar, i.labelKey))).toEqual([
      'أعمال دورية',
      'تخفَّف',
      'المحاسبة',
      'استراتيجيات العادات',
      'رفقة',
      'المحفوظات',
      'مواسم الخير',
    ]);
    expect(new Set(items.map((i) => i.path)).size).toBe(items.length);
  });

  it('has a heading and labels in both languages', () => {
    for (const dict of [ar, en]) {
      for (const group of SIDE_MENU) expect(typeof lookup(dict, group.titleKey)).toBe('string');
      for (const entry of items) expect(typeof lookup(dict, entry.labelKey)).toBe('string');
    }
  });

  it('asks a guest to sign in for members-only items, never for «مواسم الخير»', () => {
    const program = items.find((i) => i.key === 'program')!;
    const seasons = items.find((i) => i.key === 'seasons')!;
    expect(sideMenuAction(program, false)).toEqual({ kind: 'signIn', next: '/practice/sin-program' });
    expect(sideMenuAction(program, true)).toEqual({ kind: 'open', href: '/practice/sin-program' });
    expect(sideMenuAction(seasons, false)).toEqual({ kind: 'open', href: '/practice/calendar' });
  });

  it('opens from the right in Arabic and from the left in English', () => {
    expect(drawerOffset(true, 300)).toEqual({ side: 'right', hiddenX: 300 });
    expect(drawerOffset(false, 300)).toEqual({ side: 'left', hiddenX: -300 });
    expect(drawerWidth(360)).toBe(302);
    expect(drawerWidth(1024)).toBe(340);
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
  });
});
