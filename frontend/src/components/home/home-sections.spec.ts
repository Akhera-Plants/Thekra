import { describe, expect, it } from 'vitest';
import { HOME_SECTIONS } from '@thekra/practice-core';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

describe('«خصّص الرئيسية» names (shared with the app through practice-core home.ts)', () => {
  it('names every section as the core does, in ar and en', () => {
    for (const section of HOME_SECTIONS) {
      expect((ar.home.customize.sections as Record<string, string>)[section.key], section.key).toBe(section.ar);
      expect((en.home.customize.sections as Record<string, string>)[section.key], section.key).toBe(section.en);
    }
  });
});
