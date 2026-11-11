import { describe, expect, it } from 'vitest';
import { HABITS_TABS as NAV_HABITS_TABS, NAV_FEATURES } from '@thekra/practice-core';
import ar from '../../../../../messages/ar.json';
import en from '../../../../../messages/en.json';
import { HABITS_TABS, habitsTabOf } from './habits-tabs';

describe('«عاداتي» tabs', () => {
  it('are the nav map tabs of «عاداتي», in its order, named as there (ar + en)', () => {
    const tabs = NAV_HABITS_TABS.map((key) => NAV_FEATURES.find((f) => f.key === key));
    expect(tabs.every(Boolean)).toBe(true);
    expect(HABITS_TABS.map((t) => [t.key, t.href])).toEqual(tabs.map((f) => [f?.key, f?.web]));
    expect(HABITS_TABS.map((t) => t.key)).toEqual(['today', 'my-habits', 'periodic', 'review', 'record']);
    for (const f of tabs) {
      if (!f) continue;
      expect((ar.nav.menuItems as Record<string, string>)[f.key]).toBe(f.ar);
      expect((en.nav.menuItems as Record<string, string>)[f.key]).toBe(f.en);
    }
  });

  it('marks the tab of a path; a habit page sits under «العادات»', () => {
    expect(habitsTabOf('/practice')).toBe('today');
    expect(habitsTabOf('/practice/habits')).toBe('my-habits');
    expect(habitsTabOf('/practice/habits/abc')).toBe('my-habits');
    expect(habitsTabOf('/practice/periodic')).toBe('periodic');
    expect(habitsTabOf('/practice/review')).toBe('review');
    expect(habitsTabOf('/practice/record')).toBe('record');
    expect(habitsTabOf('/practice/people')).toBeNull();
    expect(habitsTabOf('/practice/strategies')).toBeNull();
  });
});
