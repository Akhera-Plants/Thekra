/**
 * شعب الإيمان and the richer home: the catalogue search folding (the site's `foldArabic`), the source strip's ranking
 * (the site's `rankSourceNames`), and the strings both screens read, in both languages.
 */

import i18next from 'i18next';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { foldArabic } from '../lib/topics';
import { FALLBACK_SOURCE_NAMES, rankSourceNames } from '../lib/api/sources';

jest.mock('../lib/api-client', () => ({ apiGet: jest.fn() }));

describe('foldArabic', () => {
  it('finds a title whatever its tashkeel, hamza seats and ta marbuta', () => {
    expect(foldArabic('شُعَب الإيمان')).toBe(foldArabic('شعب الايمان'));
    expect(foldArabic('الصلاة')).toBe('الصلاه');
    expect(foldArabic('  «الحياء»  من الإيمان ')).toBe('الحياء من الايمان');
    expect(foldArabic('Modesty')).toBe('modesty');
  });
});

describe('rankSourceNames', () => {
  const rows = [
    { name: 'Sahih Muslim', nameAr: 'صحيح مسلم', publishedQuoteCount: 40 },
    { name: 'Sahih al-Bukhari', nameAr: 'صحيح البخاري', publishedQuoteCount: 90 },
    { name: 'Unpublished', nameAr: 'غير منشور', publishedQuoteCount: 0 },
    { name: 'Latin only', nameAr: null, publishedQuoteCount: 5 },
    { name: 'Sahih Muslim', nameAr: ' صحيح   مسلم ', publishedQuoteCount: 3 },
  ];

  it('lists published sources, most published first, once each, in the language’s own names', () => {
    expect(rankSourceNames(rows, 'ar')).toEqual(['صحيح البخاري', 'صحيح مسلم']);
    expect(rankSourceNames(rows, 'en')).toEqual(['Sahih al-Bukhari', 'Sahih Muslim', 'Latin only']);
  });

  it('keeps the site’s fallback for each language', () => {
    expect(FALLBACK_SOURCE_NAMES.ar).toContain('القرآن الكريم');
    expect(FALLBACK_SOURCE_NAMES.en).toContain('The Noble Quran');
  });
});

describe('branch and home strings', () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  const keys = [
    'home.branchEntryLabel',
    'home.branchEntryDescription',
    'home.branchCta',
    'home.branchOverline',
    'home.todayHeading',
    'home.sourcesHeading',
    'home.sourcesLead',
    'home.sourcesAria',
    'app.tagline',
    'branches.pageTitle',
    'branches.searchPlaceholder',
    'branches.noResults',
    'branches.noQuotes',
    'branches.quotes',
    'branches.explanations',
    'branches.prev',
    'branches.next',
    'branches.all',
  ];

  it('has every key in both languages, without dashes', () => {
    for (const lng of ['ar', 'en']) {
      const t = i18n.getFixedT(lng);
      for (const key of keys) {
        const value = t(key);
        expect(value).not.toBe(key);
        expect(value).not.toMatch(/[–—]/);
      }
    }
  });

  it('names a branch by its number, in Western digits', () => {
    expect(i18n.getFixedT('ar')('branches.branchFallback', { number: 12 })).toBe('الشعبة 12');
    expect(i18n.getFixedT('en')('branches.branchFallback', { number: 12 })).toBe('Branch 12');
    expect(i18n.getFixedT('ar')('branches.nextLabel', { title: 'الحياء' })).toBe('الشعبة التالية: الحياء');
  });
});
