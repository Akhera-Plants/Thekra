import { describe, expect, it } from 'vitest';
import { createPlan, emptyStore, logDone, upsertPlan, type Store } from '@thekra/practice-core';
import type { Habit } from '../src/catalog.js';
import { fetchReminderSets, parseReminderSetsCache, type ReminderSetLite } from '../src/cache.js';
import { translator } from '../src/i18n.js';
import { newTabModel, pickNewTabText } from '../src/newtab-model.js';
import { toQuoteLite } from '../src/quotes.js';
import { defaultPrefs, parsePrefs, type Prefs } from '../src/state.js';

const t = translator('ar');
const NOW = '2026-10-28T08:00:00.000Z';
const TODAY = '2026-10-28';
const Q1 = '93f7d1ab-b6f7-4521-bae8-f37cc1ff06a2';

const quote = toQuoteLite({
  id: Q1,
  type: 'HADITH',
  textAr: 'نص من القاعدة',
  hadith: { reference: 'صحيح مسلم 720' },
  isAthar: false,
})!;

const habit = { key: 'duha', titleAr: 'صلاة الضحى', titleEn: 'Duha prayer', evidence: [Q1], defaultRule: { kind: 'daily' } } as unknown as Habit;
const sets: ReminderSetLite[] = [{ slug: 'al-tawba', titleAr: 'التوبة', titleEn: 'Repentance', items: [quote] }];

function store(): Store {
  const plan = createPlan({ id: '11111111-1111-4111-8111-111111111111', habitKey: 'duha', deedSlug: 'nawafil', title: 'x', unit: 'times', amount: 1, activeDaysPerWeek: 7, slots: ['09:30'], createdOn: '2026-10-01' }, NOW);
  return upsertPlan(emptyStore(), logDone(plan, TODAY, 1), NOW);
}

const model = (prefs: Partial<Prefs>) =>
  newTabModel({ store: store(), prefs: { ...defaultPrefs(), ...prefs }, catalog: [habit], quotes: { [Q1]: quote }, sets, today: TODAY, now: new Date(2026, 9, 28, 9), t });

describe('new-tab page', () => {
  it('shows the date, the habits with done marks and the streak', () => {
    const m = model({ newTabSource: { kind: 'set', slug: 'al-tawba' } });
    expect(m.off).toBe(false);
    expect(m.date).toContain('2026');
    expect(m.date).not.toMatch(/[٠-٩]/);
    expect(m.habits).toEqual([{ title: 'صلاة الضحى', done: true }]);
    expect(m.streak).toBeGreaterThanOrEqual(1);
    expect(m.text).toEqual({ text: '«نص من القاعدة»', source: 'صحيح مسلم 720' });
    expect(m.hijri).toBeNull();
  });

  it('turned off: only the date', () => {
    const m = model({ newTab: false, showHijri: true });
    expect(m).toMatchObject({ off: true, text: null, habits: [], hasPlans: false });
    expect(m.date).toBeTruthy();
  });

  it('picks from «تذكيراتي» or a habit’s evidence, and nothing for an unknown set', () => {
    const base = { catalog: [habit], quotes: { [Q1]: quote }, sets, today: TODAY, t };
    expect(pickNewTabText({ ...base, prefs: { ...defaultPrefs(), myReminders: [{ id: 'a', text: 'اذكر الله', createdAt: '' }] } })).toEqual({ text: 'اذكر الله', source: '' });
    expect(pickNewTabText({ ...base, prefs: { ...defaultPrefs(), newTabSource: { kind: 'habit', habitKey: 'duha' } } })?.source).toBe('صحيح مسلم 720');
    expect(pickNewTabText({ ...base, prefs: { ...defaultPrefs(), newTabSource: { kind: 'set', slug: 'missing' } } })).toBeNull();
    expect(pickNewTabText({ ...base, prefs: defaultPrefs() })).toBeNull();
  });

  it('keeps only extension sources in prefs (never seasons or saved)', () => {
    expect(parsePrefs({ newTabSource: { kind: 'saved' } }).newTabSource).toEqual({ kind: 'mine' });
    expect(parsePrefs({ newTabSource: { kind: 'habit', habitKey: 'duha' } }).newTabSource).toEqual({ kind: 'habit', habitKey: 'duha' });
    expect(parsePrefs({ newTab: false }).newTab).toBe(false);
    expect(parsePrefs({}).newTab).toBe(true);
  });

  it('fetches and caches the published reminder sets', async () => {
    const fetchFn = async (url: string) => {
      expect(url).toBe('https://thekra.vercel.app/v1/reminder-sets?lang=ar');
      return { ok: true, status: 200, json: async () => ({ data: [{ slug: 'al-tawba', titleAr: 'التوبة', titleEn: 'Repentance', items: [{ id: Q1, type: 'HADITH', textAr: 'نص', hadith: { reference: 'مسلم 1' } }] }, { slug: 'Bad', titleAr: 'x', titleEn: 'x', items: [] }] }) };
    };
    const cache = await fetchReminderSets(fetchFn, 1, 'ar');
    expect(cache.sets.map((s) => s.slug)).toEqual(['al-tawba']);
    expect(parseReminderSetsCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
  });
});
