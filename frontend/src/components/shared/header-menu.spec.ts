import { describe, expect, it } from 'vitest';
import { NAV_FEATURES, WEB_ACCOUNT_MENU, WEB_HEADER } from '@thekra/practice-core';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { currentHeaderItem, HEADER_ACCOUNT, HEADER_LINKS, HEADER_MENU_ITEMS, HEADER_MORE, isMoreCurrent } from './header-menu';

describe('header (round 6, C-07 b / C-05 a)', () => {
  it('has the links, «المزيد» and the account menu in the shared order', () => {
    expect(HEADER_LINKS.map((i) => i.key)).toEqual([...WEB_HEADER.links]);
    expect(HEADER_LINKS.map((i) => i.key)).toEqual(['home', 'good-deeds', 'sins', 'branches', 'habits']);
    expect(HEADER_MORE.map((i) => i.key)).toEqual(['strategies', 'saved', 'circles']);
    expect(HEADER_ACCOUNT.map((i) => i.key)).toEqual([...WEB_ACCOUNT_MENU]);
  });

  it('never repeats an item between the header and «المزيد», and keeps settings out of both', () => {
    const links = new Set(HEADER_LINKS.map((i) => i.key as string));
    for (const entry of HEADER_MORE) expect(links.has(entry.key)).toBe(false);
    expect(HEADER_MENU_ITEMS.map((i) => i.key as string)).not.toContain('settings');
    expect(HEADER_MENU_ITEMS.map((i) => i.key as string)).not.toContain('browse');
  });

  it('names and places every item exactly as the shared nav map (ar + en)', () => {
    for (const entry of [...HEADER_MENU_ITEMS, ...HEADER_ACCOUNT]) {
      const feature = NAV_FEATURES.find((f) => f.key === entry.key);
      expect(feature, entry.key).toBeDefined();
      expect(entry.href?.replace(/#.*$/, '') ?? null).toBe(feature?.web);
      expect((ar.nav.menuItems as Record<string, string>)[entry.key], `ar ${entry.key}`).toBe(feature?.ar);
      expect((en.nav.menuItems as Record<string, string>)[entry.key], `en ${entry.key}`).toBe(feature?.en);
    }
  });

  it('names the feature «صحبة» everywhere: «رفقة» is gone from the copy (owner round 7, D1)', () => {
    expect(JSON.stringify(ar)).not.toMatch(/رفق(ة|ت|ات)/);
    expect(ar.nav.menuItems.circles).toBe('صحبة');
  });

  it('only «صحبة» has no web page (it opens a note that it lives in the app)', () => {
    expect(HEADER_MENU_ITEMS.filter((i) => i.href === null).map((i) => i.key)).toEqual(['circles']);
  });

  it('marks the deepest matching item', () => {
    expect(currentHeaderItem('/')).toBe('home');
    expect(currentHeaderItem('/practice')).toBe('habits');
    expect(currentHeaderItem('/practice/review')).toBe('habits');
    expect(currentHeaderItem('/practice/habits/p1')).toBe('habits');
    expect(currentHeaderItem('/practice/leave-sin/moment')).toBe('habits');
    expect(currentHeaderItem('/practice/strategies')).toBe('strategies');
    expect(currentHeaderItem('/favorites/reminders')).toBe('saved');
    expect(currentHeaderItem('/good-deeds/dhikr')).toBe('good-deeds');
    expect(currentHeaderItem('/sins/ghibah')).toBe('sins');
    expect(currentHeaderItem('/settings/notifications')).toBeNull();
    expect(isMoreCurrent('saved')).toBe(true);
    expect(isMoreCurrent('habits')).toBe(false);
  });
});
