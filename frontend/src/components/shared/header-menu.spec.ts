import { describe, expect, it } from 'vitest';
import { NAV_FEATURES } from '@thekra/practice-core';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { currentHeaderItem, HEADER_MENU, HEADER_MENU_ITEMS } from './header-menu';

describe('header menu (W-10 a: one menu for visitor and member)', () => {
  it('has the two groups in the plan order', () => {
    expect(HEADER_MENU.map((g) => [g.key, g.items.map((i) => i.key)])).toEqual([
      ['doors', ['leave-sin', 'good-deeds', 'branches', 'browse']],
      ['members', ['habits', 'people', 'saved', 'settings', 'circles']],
    ]);
  });

  it('names and places every item exactly as the shared nav map (ar + en)', () => {
    for (const entry of HEADER_MENU_ITEMS) {
      const feature = NAV_FEATURES.find((f) => f.key === entry.key);
      expect(feature, entry.key).toBeDefined();
      expect(entry.href).toBe(feature?.web);
      expect((ar.nav.menuItems as Record<string, string>)[entry.key], `ar ${entry.key}`).toBe(feature?.ar);
      expect((en.nav.menuItems as Record<string, string>)[entry.key], `en ${entry.key}`).toBe(feature?.en);
    }
  });

  it('only «رفقة» has no web page (it opens a note that it lives in the app)', () => {
    expect(HEADER_MENU_ITEMS.filter((i) => i.href === null).map((i) => i.key)).toEqual(['circles']);
  });

  it('marks the deepest matching item', () => {
    expect(currentHeaderItem('/practice')).toBe('habits');
    expect(currentHeaderItem('/practice/review')).toBe('habits');
    expect(currentHeaderItem('/practice/habits/p1')).toBe('habits');
    expect(currentHeaderItem('/practice/people')).toBe('people');
    expect(currentHeaderItem('/practice/leave-sin/moment')).toBe('leave-sin');
    expect(currentHeaderItem('/favorites/reminders')).toBe('saved');
    expect(currentHeaderItem('/settings/notifications')).toBe('settings');
    expect(currentHeaderItem('/good-deeds/dhikr')).toBe('good-deeds');
    expect(currentHeaderItem('/')).toBeNull();
    expect(currentHeaderItem('/sins/ghibah')).toBeNull();
  });
});
