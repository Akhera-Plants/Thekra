import { createPlan, emptyStore, logDone, upsertPlan, type Store } from '@thekra/practice-core';
import { buildWidgetSnapshot, parseWidgetSnapshot, widgetView, type WidgetLabels } from '../widget/snapshot';
import { EMPTY_SNAPSHOT } from '../widget/empty';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

const NOW = '2026-10-28T08:00:00.000Z';
const TODAY = '2026-10-26'; // a Monday
const labels: WidgetLabels = EMPTY_SNAPSHOT.labels;

function store(): Store {
  const a = createPlan({ id: 'a', deedSlug: 'dhikr', title: 'أذكار', unit: 'count', amount: 1, activeDaysPerWeek: 7, slots: ['07:00'], createdOn: '2026-10-01' }, NOW);
  const b = createPlan({ id: 'b', deedSlug: 'quran', title: 'قرآن', unit: 'minutes', amount: 5, activeDaysPerWeek: 7, slots: ['21:00'], createdOn: '2026-10-01' }, NOW);
  return [logDone(a, TODAY, 1), b].reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

const occasions = [{ key: 'friday', titleAr: 'يوم الجمعة', titleEn: 'Friday', deed: 'jumua', rule: { kind: 'weekdays' as const, days: [5] } }];

function snapshot(source: Parameters<typeof buildWidgetSnapshot>[0]['source'], texts = [{ text: 'نص', attribution: 'البخاري' }]) {
  return buildWidgetSnapshot({
    store: store(),
    today: TODAY,
    planDays: {},
    occasions,
    titleOf: (id) => (id === 'a' ? 'أذكار' : 'قرآن'),
    source,
    texts,
    labels,
    locale: 'ar',
  });
}

describe('home-screen widget snapshot', () => {
  it('lists today’s habits with done marks and «بقي n»', () => {
    const s = snapshot({ kind: 'mine' });
    expect(s.items).toEqual([
      { title: 'أذكار', done: true },
      { title: 'قرآن', done: false },
    ]);
    expect(s.remaining).toBe(1);
    const view = widgetView(s, TODAY);
    expect(view.streak.line).toBe('بقي 1');
    expect(view.wird.items).toHaveLength(2);
  });

  it('shows no stale done marks on a later day, but keeps rotating the text', () => {
    const s = snapshot({ kind: 'mine' }, [
      { text: 'أ', attribution: '' },
      { text: 'ب', attribution: '' },
    ]);
    const later = widgetView(s, '2026-10-27');
    expect(later.wird.items).toEqual([]);
    expect(later.wird.line).toBe(labels.openApp);
    expect(later.text.body).not.toBe(widgetView(s, TODAY).text.body);
  });

  it('«مواسم الخير»: today’s date and the next occasion', () => {
    const s = snapshot({ kind: 'seasons' });
    expect(s.texts).toEqual([]);
    const view = widgetView(s, TODAY);
    // Round 5 (F-17): the source is «اليوم والمناسبة القريبة», no «مواسم الخير» page any more.
    expect(view.text.title).toBe('اليوم والمناسبة القريبة · 26 أكتوبر');
    expect(view.text.body).toBe('القادم: يوم الجمعة، 30 أكتوبر');
    expect(widgetView(s, '2026-10-30').text.body).toContain('اليوم: يوم الجمعة');
  });

  it('round-trips through storage and rejects junk', () => {
    const s = snapshot({ kind: 'set', slug: 'al-tawba' });
    expect(parseWidgetSnapshot(JSON.stringify(s))).toEqual(s);
    expect(parseWidgetSnapshot('{')).toBeNull();
    expect(parseWidgetSnapshot(null)).toBeNull();
  });

  it('has the same widget words in Arabic and English', () => {
    expect(Object.keys(ar.widget).sort()).toEqual(Object.keys(en.widget).sort());
    expect(ar.widget.months.split(',')).toHaveLength(12);
    expect(en.widget.months.split(',')).toHaveLength(12);
    expect(Object.keys(ar.prayerTimes).sort()).toEqual(Object.keys(en.prayerTimes).sort());
    expect(Object.keys(ar.dailyText).sort()).toEqual(Object.keys(en.dailyText).sort());
    expect(Object.keys(ar.myReminders).sort()).toEqual(Object.keys(en.myReminders).sort());
  });
});
