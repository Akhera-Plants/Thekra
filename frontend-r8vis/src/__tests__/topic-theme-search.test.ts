import { describe, expect, it } from 'vitest';
import { foldArabic, namesMatch, parseThemeParam, searchTopicThemes } from '@/lib/search/topic-themes';
import type { TopicThemeIndexEntry } from '@/lib/types/api';

const entry = (over: Partial<TopicThemeIndexEntry> & Pick<TopicThemeIndexEntry, 'key' | 'ar' | 'en'>): TopicThemeIndexEntry => ({
  terms: [],
  topic: { slug: 'tark-as-salah', side: 'AVOID' },
  pages: { sins: 'tark-as-salah', goodDeeds: 'salah' },
  pageTitleAr: 'الصلاة',
  pageTitleEn: 'Guarding the prayers',
  ...over,
});

const index: TopicThemeIndexEntry[] = [
  entry({ key: 'tark-salah-iqab', ar: 'عقوبة تارك الصلاة', en: 'The warning to whoever abandons prayer', terms: ['ترك الصلاه'] }),
  entry({ key: 'tark-jumua', ar: 'ترك الجمعة', en: 'Missing Friday prayer', terms: ['ترك الجمعه'] }),
  entry({ key: 'tark-jamaah', ar: 'ترك الجماعة', en: 'Staying away from congregation', terms: ['تارك الجماعه'] }),
  entry({ key: 'salah-muhafaza', ar: 'ثواب المحافظة على الصلاة', en: 'The reward of guarding the prayers', topic: { slug: 'salah', side: 'DO' } }),
  entry({ key: 'dhikr-fadl', ar: 'فضل ذكر الله', en: 'Remembering Allah', topic: { slug: 'dhikr', side: 'DO' }, pages: { sins: null, goodDeeds: 'dhikr' }, pageTitleAr: 'ذكر الله', pageTitleEn: 'Dhikr' }),
];

describe('searchTopicThemes', () => {
  it('finds «عقوبة تارك الصلاة» with or without tashkeel and opens the chip', () => {
    for (const query of ['عقوبة تارك الصلاة', 'عُقوبةُ تاركِ الصلاة', 'عقوبه تارك الصلاه']) {
      const [hit] = searchTopicThemes(index, query, 'sins', 'ar');
      expect(hit).toEqual({ key: 'tark-salah-iqab', label: 'عقوبة تارك الصلاة', pageTitle: 'الصلاة', href: '/sins/tark-as-salah?theme=tark-salah-iqab' });
    }
  });

  it('finds «ترك الجمعة» only', () => {
    expect(searchTopicThemes(index, 'ترك الجمعة', 'sins', 'ar').map((hit) => hit.key)).toEqual(['tark-jumua']);
  });

  it('matches chapter phrases («تارك الجماعة») and English labels', () => {
    expect(searchTopicThemes(index, 'تارك الجماعة', 'sins', 'ar').map((hit) => hit.key)).toEqual(['tark-jamaah']);
    const [hit] = searchTopicThemes(index, 'friday', 'sins', 'en');
    expect(hit?.label).toBe('Missing Friday prayer');
  });

  it('keeps each catalogue on its own pages; a pair theme opens on this side of the pair', () => {
    expect(searchTopicThemes(index, 'المحافظة على الصلاة', 'sins', 'ar')[0]?.href).toBe('/sins/tark-as-salah?theme=salah-muhafaza');
    expect(searchTopicThemes(index, 'المحافظة على الصلاة', 'good-deeds', 'ar')[0]?.href).toBe('/good-deeds/salah?theme=salah-muhafaza');
    expect(searchTopicThemes(index, 'ذكر الله', 'sins', 'ar')).toEqual([]);
  });

  it('ignores stop words and empty queries', () => {
    expect(searchTopicThemes(index, 'من في', 'sins', 'ar')).toEqual([]);
    expect(searchTopicThemes(index, '   ', 'sins', 'ar')).toEqual([]);
  });
});

describe('foldArabic / parseThemeParam', () => {
  it('folds the same way as the backend', () => {
    expect(foldArabic('«الصلاةُ» على النبيّ')).toBe('الصلاه علي النبي');
  });

  it('accepts slug keys only', () => {
    expect(parseThemeParam('tark-jumua')).toBe('tark-jumua');
    expect(parseThemeParam(['tark-jumua', 'x'])).toBe('tark-jumua');
    expect(parseThemeParam('<script>')).toBeNull();
    expect(parseThemeParam('Tark')).toBeNull();
    expect(parseThemeParam(undefined)).toBeNull();
  });
});

describe('namesMatch (catalogue search, audit B08)', () => {
  const sin = ['النظر إلى المحرمات', 'Looking at the forbidden', 'غضّ البصر', 'Lowering the gaze'];

  it('finds «غضّ البصر» with or without the shadda', () => {
    expect(namesMatch(sin, foldArabic('غض البصر'))).toBe(true);
    expect(namesMatch(sin, foldArabic('غضّ البصر'))).toBe(true);
  });

  it('ignores tatweel, repeated spaces, hamza seats and case', () => {
    expect(namesMatch(sin, foldArabic('غـض   البصر'))).toBe(true);
    expect(namesMatch(sin, foldArabic('النظر الى المحرمات'))).toBe(true);
    expect(namesMatch(sin, foldArabic('LOWERING'))).toBe(true);
  });

  it('matches nothing unrelated, and everything for an empty query', () => {
    expect(namesMatch(sin, foldArabic('الغيبة'))).toBe(false);
    expect(namesMatch(sin, foldArabic('  '))).toBe(true);
  });
});
