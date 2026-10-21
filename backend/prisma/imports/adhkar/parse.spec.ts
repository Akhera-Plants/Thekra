import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeHeadingTitle, parseAdhkar } from './parse.js';

const CORPUS = join(import.meta.dirname, '../../../.corpus');

describe('parseAdhkar', () => {
  const text = readFileSync(join(CORPUS, '0676Nawawi.Adhkar.Shamela0001956-ara1'), 'utf8');
  const sections = parseAdhkar(text);
  const hadith = sections.flatMap((section) => section.items.filter((item) => item.kind === 'HADITH'));

  // Anchor 1 — the muqaddima's first numbered narration (### | 1 -).
  it('starts with narration 1 «من دعا إلى هدى» from Sahih Muslim', () => {
    expect(hadith[0]?.hadithNumber).toBe(1);
    expect(hadith[0]?.text).toContain('من دعا إلى هدى');
    expect(hadith[0]?.text).toContain('صحيح مسلم');
  });

  // Anchor 2 — a known bab (printed as «(باب ما يقول إذا استيقظ من منامه)»)
  // and its first narration, 36, «يعقد الشيطان على قافية رأس أحدكم».
  it('opens باب ما يقول إذا استيقظ من منامه with narration 36', () => {
    const bab = sections.find((section) => section.titleAr === 'باب ما يقول إذا استيقظ من منامه');
    expect(bab?.level).toBe('BAB');
    const first = bab?.items.find((item) => item.kind === 'HADITH');
    expect(first?.hadithNumber).toBe(36);
    expect(first?.text).toContain('يعقد الشيطان على قافية رأس أحدكم');
  });

  // Anchor 3 — a kitab heading plus overall shape (18 كتاب, 1251 numbered narrations).
  it('reads كتاب تلاوة القرآن as a KITAB and the full narration run', () => {
    const kitab = sections.find((section) => section.titleAr === 'كتاب تلاوة القرآن');
    expect(kitab?.level).toBe('KITAB');
    expect(sections.filter((section) => section.level === 'KITAB').length).toBe(18);
    expect(hadith.length).toBe(1251);
    expect(hadith.every((item) => item.hadithNumber != null)).toBe(true);
  });

  it('strips (…) and [فصل] wrappers from headings', () => {
    expect(normalizeHeadingTitle('(باب ما يقول إذا لبس ثوبه)')).toBe('باب ما يقول إذا لبس ثوبه');
    expect(normalizeHeadingTitle('[فصل] في آداب الختم وما يتعلق به:')).toBe('فصل في آداب الختم وما يتعلق به');
  });
});
