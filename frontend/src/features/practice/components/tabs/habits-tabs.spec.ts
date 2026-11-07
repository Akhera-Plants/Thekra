import { describe, expect, it } from 'vitest';
import { NAV_FEATURES } from '@thekra/practice-core';
import ar from '../../../../../messages/ar.json';
import en from '../../../../../messages/en.json';
import { HABITS_TABS, habitsTabOf } from './habits-tabs';

describe('«عاداتي» tabs', () => {
  it('are the nav map tabs of «عاداتي», named as there (ar + en)', () => {
    const tabs = NAV_FEATURES.filter((f) => f.parent === 'habits' && ['wird', 'periodic', 'review', 'record'].includes(f.key));
    expect(HABITS_TABS.map((t) => [t.key, t.href])).toEqual(tabs.map((f) => [f.key, f.web]));
    for (const f of tabs) {
      expect((ar.nav.menuItems as Record<string, string>)[f.key]).toBe(f.ar);
      expect((en.nav.menuItems as Record<string, string>)[f.key]).toBe(f.en);
    }
  });

  it('marks the tab of a path', () => {
    expect(habitsTabOf('/practice')).toBe('wird');
    expect(habitsTabOf('/practice/review')).toBe('review');
    expect(habitsTabOf('/practice/record')).toBe('record');
    expect(habitsTabOf('/practice/people')).toBeNull();
  });
});
