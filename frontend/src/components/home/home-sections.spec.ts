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

// Owner round 6 (§1, §2, C-01d, C-01f, C-01j): the old words are gone from the website's copy (the glossary terms of
// practice-core nav-map `GLOSSARY` replace them; the app checks the same list in round6-reading.test.ts).
describe('round-6 wording', () => {
  const RETIRED = ['فاتتك', 'أقل ما يمكن', 'ترك معصية', 'أهلي وناسي', 'تصفّح النصوص', 'أوقِف مؤقتًا', 'أوقف مؤقتًا', 'موقوفة مؤقتًا'];
  it('uses none of the retired words in ar.json', () => {
    const text = JSON.stringify(ar);
    for (const word of RETIRED) expect(text.includes(word), word).toBe(false);
  });
});
