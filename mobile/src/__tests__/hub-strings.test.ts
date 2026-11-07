/**
 * The counted strings of «ورد اليوم» and «عاداتي» resolve through i18next plural rules in both languages (Arabic has
 * zero/one/two/few/many forms), the screens carry the owner's names, every key exists in both files, and no visible
 * string carries an em or en dash.
 */

import i18next from 'i18next';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe('practice strings', () => {
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

  it('counts the streak, the longest one and the periodic acts with the right form', () => {
    const ar = i18n.getFixedT('ar');
    expect(ar('practice.wird.streakLabel', { count: 0 })).toBe('لا مداومة بعد');
    expect(ar('practice.wird.streakLabel', { count: 2 })).toBe('مداومة يومين');
    expect(ar('practice.wird.streakLabel', { count: 5 })).toBe('مداومة 5 أيام');
    expect(ar('record.longest', { count: 1 })).toBe('أطول مداومة: يوم واحد');
    expect(ar('record.longest', { count: 14 })).toBe('أطول مداومة: 14 يومًا');
    expect(ar('record.periodicCount', { count: 3 })).toBe('3 أعمال');
    // Owner round 5, A-23: «ليست مطلوبة اليوم» (round 3's «اليوم استراحة…» read as a day off the deed).
    expect(ar('practice.wird.notDueToday', { count: 1 })).toBe('ليست مطلوبة اليوم');
    expect(ar('practice.wird.notDueToday', { count: 3 })).toBe('ليست مطلوبة اليوم (3)');
    const en = i18n.getFixedT('en');
    expect(en('practice.wird.streakLabel', { count: 1 })).toBe('1-day streak');
    expect(en('record.longest', { count: 7 })).toBe('Longest streak: 7 days');
  });

  it('names the screens and the private program as the owner chose, never naming a sin', () => {
    const ar = i18n.getFixedT('ar');
    // Round 5 (§1 IA): one «عاداتي» tab, «ورد اليوم» its first segment, «المزيد» the third tab.
    expect(ar('tabs.habits')).toBe('عاداتي');
    expect(ar('habitsTab.tabs.wird')).toBe('ورد اليوم');
    expect(ar('practice.wird.title')).toBe('ورد اليوم');
    expect(ar('tabs.more')).toBe('المزيد');
    expect(ar('record.title')).toBe('عاداتي');
    expect(ar('home.entryTitle')).toBe('أبواب الخير');
    expect(ar('home.sinEntryLabel')).toBe('تخفَّف من معصية');
    expect(ar('sinProgram.categoryQuestion')).toBe('هل فيها حقٌّ لأحد من الناس؟');
    expect(ar('practice.periodic.title')).toBe('أعمال دورية');
    expect(ar('practice.hub.habitsTrack')).toBe('عاداتي');
    expect(ar('sinProgram.title')).toBe('تخفَّف');
    expect(ar('settings.showHijri')).toBe('إظهار التاريخ الهجري');
    const visible = keys(ar).map((k) => k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], ar));
    expect(visible.filter((v) => typeof v === 'string' && v.includes('ترك المعصية'))).toEqual([]);
  });

  it('counts «تخفَّف» days without a resetting streak, in both languages', () => {
    const ar = i18n.getFixedT('ar');
    expect(ar('sinProgram.counters.held', { n: '12', total: '30' })).toBe('ثبتّ 12 من 30');
    expect(ar('sinProgram.counters.sinceRepentance', { count: 0 })).toBe('آخر توبة: اليوم');
    expect(ar('sinProgram.counters.sinceRepentance', { count: 2 })).toBe('منذ آخر توبة: يومان');
    expect(ar('sinProgram.counters.sinceRepentance', { count: 5 })).toBe('منذ آخر توبة: 5 أيام');
    expect(ar('sinProgram.counters.sinceStart', { count: 14 })).toBe('منذ البداية: 14 يومًا');
    const en = i18n.getFixedT('en');
    expect(en('sinProgram.counters.sinceRepentance', { count: 0 })).toBe('Last repentance: today');
    expect(en('sinProgram.counters.sinceRepentance', { count: 3 })).toBe('Since the last repentance: 3 days');
  });

  it('names «لحظة مجاهدة» (owner round 3) and keeps it generic', () => {
    expect(i18n.getFixedT('ar')('sinProgram.moment.title')).toBe('لحظة مجاهدة');
    expect(i18n.getFixedT('en')('sinProgram.moment.title')).toBe('A moment of striving');
    const all = JSON.stringify(ar);
    expect(all).not.toContain('لحظة ضعف');
    expect(all).not.toContain('وقعت');
    expect(all).not.toContain('على جهازك فقط');
    expect(all).not.toContain('عذر أمس');
    expect(all).not.toContain('الميزان');
  });

  it('every interpolation uses i18next braces (no raw «{n} من {max}»), outside the widget templates', () => {
    const { widget: _arWidget, ...arRest } = ar as Record<string, unknown>;
    const { widget: _enWidget, ...enRest } = en as Record<string, unknown>;
    const single = /(?<!\{)\{[a-zA-Z]+\}(?!\})/;
    for (const [lang, file] of [['ar', arRest], ['en', enRest]] as const) {
      const bad = keys(file).filter((k) => single.test(String(k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], file))));
      expect(`${lang}: ${bad.join(', ')}`).toBe(`${lang}: `);
    }
    expect(i18n.getFixedT('ar')('myReminders.count', { n: 2, max: 20 })).toBe('2 من 20');
  });

  it('has every key in both languages', () => {
    const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
    const arKeys = new Set(keys(ar).map(base));
    const enKeys = new Set(keys(en).map(base));
    expect([...arKeys].sort()).toEqual([...enKeys].sort());
  });

  it('has no em or en dash in any visible string', () => {
    for (const dict of [ar, en]) {
      const strings = keys(dict).map((k) => k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dict));
      expect(strings.filter((s) => typeof s === 'string' && /[–—]/.test(s))).toEqual([]);
    }
  });
});
