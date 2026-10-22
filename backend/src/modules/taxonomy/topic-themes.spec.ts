import {
  chapterTitleFromNote,
  isGenericTitle,
  matchThemeKeys,
  normTheme,
  parseTopicThemes,
  themeHaystack,
} from './topic-themes.js';

const line = (fields: string) => `themes:\n  - { ${fields} }\n`;

describe('normTheme', () => {
  it('folds tashkeel, hamza seats, ta marbuta and punctuation', () => {
    expect(normTheme('الترهيبُ من تركِ الصلاةِ تعمّداً ، وإخراجها')).toBe('الترهيب من ترك الصلاه تعمدا واخراجها');
    expect(normTheme('«عقوبة» تارك الصلاة!')).toBe('عقوبه تارك الصلاه');
  });
});

describe('parseTopicThemes', () => {
  it('reads one flow object per line and normalises match patterns', () => {
    const [theme] = parseTopicThemes(line('topic: tark-as-salah, key: tark-jumua, ar: ترك الجمعة, en: Missing Friday prayer, match: [ترك الجمعة, ترك صلاة الجمعة]'));
    expect(theme).toEqual({
      topic: 'tark-as-salah',
      key: 'tark-jumua',
      ar: 'ترك الجمعة',
      en: 'Missing Friday prayer',
      match: ['ترك الجمعه', 'ترك صلاه الجمعه'],
      order: 0,
    });
  });

  it('keeps commas inside an English label', () => {
    const [theme] = parseTopicThemes(line('topic: a, key: a-b, ar: ص, en: Fear, and hope, match: [x]'));
    expect(theme?.en).toBe('Fear, and hope');
  });

  it('rejects duplicate keys, bad keys, empty match and unknown fields', () => {
    const one = 'topic: a, key: a-b, ar: ص, en: E, match: [x]';
    expect(() => parseTopicThemes(`themes:\n  - { ${one} }\n  - { ${one} }\n`)).toThrow(/duplicate key/);
    expect(() => parseTopicThemes(line('topic: a, key: A_b, ar: ص, en: E, match: [x]'))).toThrow(/bad key/);
    expect(() => parseTopicThemes(line('topic: a, key: a-b, ar: ص, en: E, match: []'))).toThrow(/match is empty/);
    expect(() => parseTopicThemes(line('extra: 1, topic: a, key: a-b, ar: ص, en: E, match: [x]'))).toThrow(/unknown field/);
  });

  it('caps a topic at eight themes', () => {
    const rows = Array.from({ length: 9 }, (_, index) => `  - { topic: a, key: a-${index}, ar: ص, en: E, match: [x] }`).join('\n');
    expect(() => parseTopicThemes(`themes:\n${rows}\n`)).toThrow(/more than 8/);
  });
});

describe('chapterTitleFromNote', () => {
  it('reads the chapter from each note shape', () => {
    expect(chapterTitleFromNote('من باب: الترهيب من ترك الجمعة لغير عذر — صحيح الترغيب والترهيب')).toBe('الترهيب من ترك الجمعة لغير عذر');
    expect(chapterTitleFromNote('أورده الذهبي في باب: الكبيرة الرابعة في ترك الصلاة — الكبائر')).toBe('الكبيرة الرابعة في ترك الصلاة');
    expect(chapterTitleFromNote('من باب: باب فضل صلاة الجماعة ) — صحيح مسلم (باب مشترك)')).toBe('باب فضل صلاة الجماعة )');
    expect(chapterTitleFromNote('رواه مسلم (653) — ورد في باب: الترهيب من ترك حضور الجماعة من صحيح الترغيب والترهيب')).toBe('الترهيب من ترك حضور الجماعة');
    expect(chapterTitleFromNote('The five prayers as expiations.')).toBeNull();
    expect(chapterTitleFromNote(null)).toBeNull();
  });
});

describe('themeHaystack + matchThemeKeys', () => {
  const themes = parseTopicThemes([
    'themes:',
    '  - { topic: t, key: t-iqab, ar: عقوبة تارك الصلاة, en: E, match: [ترك الصلاه] }',
    '  - { topic: t, key: t-jumua, ar: ترك الجمعة, en: E, match: [ترك الجمعه, صلاه الجمعه والجماعه] }',
    '  - { topic: t, key: t-jamaah, ar: ترك الجماعة, en: E, match: [الجماعه والجماعه, صلاه الجمعه والجماعه] }',
    '  - { topic: s, key: s-sidq, ar: الصدق, en: E, match: [الصدق] }',
  ].join('\n'));

  it('uses the parent heading for a bare «فصل»', () => {
    expect(isGenericTitle('فصل')).toBe(true);
    const hay = themeHaystack({ note: 'من باب: فصل — الكبائر', sectionTitle: 'فصل', parentTitles: ['الكبيرة الرابعة في ترك الصلاة', 'الكبائر'] });
    expect(matchThemeKeys(themes, hay)).toEqual(['t-iqab']);
  });

  it('gives a chapter every theme it names', () => {
    const hay = themeHaystack({ note: null, sectionTitle: 'الكبيرة السادسة والستون الإصرار على ترك صلاة الجمعة والجماعة من غير عذر', parentTitles: [] });
    expect(matchThemeKeys(themes, hay)).toEqual(['t-jumua', 't-jamaah']);
  });

  it('matches whole words only and never the book name', () => {
    const charity = themeHaystack({ note: 'من باب: الترغيب في الصدقة — الصدق', sectionTitle: null, parentTitles: [] });
    expect(matchThemeKeys(themes, charity)).toEqual([]);
    const truth = themeHaystack({ note: null, sectionTitle: 'الصدق', parentTitles: [] });
    expect(matchThemeKeys(themes, truth)).toEqual(['s-sidq']);
  });
});
