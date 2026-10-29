/**
 * The hub's counted strings resolve through i18next plural rules in both languages (Arabic has zero/one/two/few/many
 * forms), every hub key exists in both files, and no visible string carries an em or en dash.
 */

import i18next from 'i18next';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe('hub strings', () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  it('counts days in Arabic with the right form', () => {
    const t = i18n.getFixedT('ar');
    expect(t('practice.hub.presentDays', { count: 1 })).toBe('حضرت يومًا واحدًا من آخر 30 يومًا');
    expect(t('practice.hub.presentDays', { count: 2 })).toBe('حضرت يومين من آخر 30 يومًا');
    expect(t('practice.hub.presentDays', { count: 5 })).toBe('حضرت 5 أيام من آخر 30 يومًا');
    expect(t('practice.hub.presentDays', { count: 12 })).toBe('حضرت 12 يومًا من آخر 30 يومًا');
    expect(t('practice.hub.relativeOverdue', { count: 0 })).toBe('موعده اليوم');
    expect(t('practice.hub.relativeOverdue', { count: 3 })).toBe('فات موعده منذ 3 أيام');
  });

  it('counts in English', () => {
    const t = i18n.getFixedT('en');
    expect(t('practice.hub.presentDays', { count: 1 })).toBe('Present on 1 of the last 30 days');
    expect(t('practice.hub.presentDays', { count: 0 })).toBe('Nothing logged in the last 30 days yet, and today is a good start.');
    expect(t('practice.hub.habitsCount', { count: 3 })).toBe('3 habits');
  });

  it('counts days and minutes in the practice screens with the right form', () => {
    const ar = i18n.getFixedT('ar');
    expect(ar('kinship.everyDays', { count: 3 })).toBe('كل 3 أيام');
    expect(ar('kinship.everyDays', { count: 14 })).toBe('كل 14 يومًا');
    expect(ar('kinship.overdueBy', { count: 1 })).toBe('تأخّر يومًا واحدًا');
    expect(ar('kinship.overdueBy', { count: 3 })).toBe('تأخّر 3 أيام');
    expect(ar('practice.add.daysCount', { count: 2 })).toBe('يومان');
    expect(ar('practice.monthDays', { done: '4', count: 12 })).toBe('سجّلت في 4 من 12 يومًا');
    expect(ar('practice.duties.minutes', { count: 120 })).toBe('120 دقيقة');
    expect(ar('practice.notify.kinshipBodyGeneric', { count: 1 })).toBe('حان وقت التواصل مع أحد أقاربك');
    const en = i18n.getFixedT('en');
    expect(en('kinship.overdueBy', { count: 1 })).toBe('1 day late');
    expect(en('kinship.overdueBy', { count: 4 })).toBe('4 days late');
    expect(en('practice.monthDays', { done: '4', count: 12 })).toBe('You logged 4 of 12 days');
  });

  it('has every hub key in both languages', () => {
    const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
    const arKeys = new Set(keys(ar.practice.hub).map(base));
    const enKeys = new Set(keys(en.practice.hub).map(base));
    expect([...arKeys].sort()).toEqual([...enKeys].sort());
  });

  it('has no em or en dash in any visible string', () => {
    for (const dict of [ar, en]) {
      const strings = keys(dict).map((k) => k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dict));
      expect(strings.filter((s) => typeof s === 'string' && /[–—]/.test(s))).toEqual([]);
    }
  });
});
