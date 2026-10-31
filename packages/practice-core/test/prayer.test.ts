import { describe, expect, it } from 'vitest';
import {
  addMyReminder,
  alAdhanCalendarUrl,
  applyServerChanges,
  buildSyncRequest,
  clonePlan,
  createPlan,
  dailyPick,
  DEFAULT_ANCHOR_TIMES,
  DEFAULT_NOTIFICATION_PREFS,
  defaultMethodForCountry,
  emptyStore,
  mergePrayerCache,
  monthsToFetch,
  MY_REMINDERS_MAX,
  myReminderError,
  notificationPlan,
  parseAlAdhan,
  parseMyReminders,
  parsePrayerCache,
  parsePrayerSettings,
  parseResolvedAnchorTimes,
  parseTodayTextSource,
  planFields,
  planSlotTimes,
  prayerCacheStale,
  prayerLookup,
  prayerTimesOn,
  reminderSlots,
  resolveAnchor,
  resolvedAnchorTimes,
  seasonsOfGood,
  slotChoices,
  slotsFromChoices,
  upsertPlan,
  validatePlan,
  type PrayerSettings,
  type PrayerTimes,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';
const TIMES: PrayerTimes = { fajr: '04:40', dhuhr: '11:45', asr: '14:55', maghrib: '17:20', isha: '18:50' };
const SETTINGS: PrayerSettings = { city: 'Riyadh', country: 'SA', method: 4, offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } };

function anchoredPlan() {
  return createPlan(
    {
      id: 'p1',
      deedSlug: 'dhikr',
      title: 'Adhkar',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 7,
      ...slotsFromChoices(['after-fajr', '13:00']),
      createdOn: '2026-10-01',
    },
    NOW,
  );
}

describe('prayer anchors', () => {
  it('resolves anchors from prayer times and falls back to defaults', () => {
    expect(resolveAnchor('after-fajr', TIMES)).toBe('05:00');
    expect(resolveAnchor('after-isha', TIMES)).toBe('19:10');
    expect(resolveAnchor('before-sleep', TIMES)).toBe('21:30'); // isha + 2h = 20:50, clamped up
    expect(resolveAnchor('before-sleep', { ...TIMES, isha: '21:30' })).toBe('22:45'); // clamped down
    expect(resolveAnchor('after-maghrib')).toBe(DEFAULT_ANCHOR_TIMES['after-maghrib']);
  });

  it('stores an anchored slot with its default time and resolves it per day', () => {
    const plan = anchoredPlan();
    expect(plan.slots).toEqual([DEFAULT_ANCHOR_TIMES['after-fajr'], '13:00']);
    expect(plan.slotAnchors).toEqual(['after-fajr', null]);
    expect(validatePlan(plan)).toBeNull();
    expect(planSlotTimes(plan, TIMES)).toEqual(['05:00', '13:00']);
    expect(reminderSlots(plan, TIMES)).toEqual(['05:00', '13:00']);
    expect(slotChoices(plan)).toEqual(['after-fajr', '13:00']);
    expect(clonePlan(plan).slotAnchors).toEqual(['after-fajr', null]);
  });

  it('leaves slotAnchors out when nothing is anchored, so older canonical content is unchanged', () => {
    const fixed = createPlan(
      { id: 'p2', deedSlug: 'x', title: 'x', unit: 'count', amount: 1, activeDaysPerWeek: 7, ...slotsFromChoices(['09:00']), createdOn: '2026-10-01' },
      NOW,
    );
    expect(fixed.slotAnchors).toBeUndefined();
    expect('slotAnchors' in planFields(fixed)).toBe(false);
    expect(planFields(anchoredPlan()).slotAnchors).toEqual(['after-fajr', null]);
  });

  it('rejects anchors that do not line up with the slots', () => {
    expect(validatePlan({ ...anchoredPlan(), slotAnchors: ['after-fajr'] })).toMatch(/slotAnchors/);
    expect(validatePlan({ ...anchoredPlan(), slotAnchors: ['noon', null] })).toMatch(/slotAnchors/);
  });

  it('round-trips anchors through the sync wire', () => {
    const store = upsertPlan(emptyStore(), anchoredPlan(), NOW);
    const req = buildSyncRequest(store);
    const wire = req.changes.plans[0] as Record<string, unknown>;
    expect(wire.slotAnchors).toEqual(['after-fajr', null]);
    const res = { serverTime: '2026-10-28T08:00:01.000Z', settings: null, plans: req.changes.plans, logs: [], relatives: [], contacts: [] };
    const next = applyServerChanges(emptyStore(), res);
    expect(next.plans[0]?.slotAnchors).toEqual(['after-fajr', null]);
  });

  it('notifies at the resolved anchor time, even inside the quiet hours', () => {
    const store = upsertPlan(emptyStore(), anchoredPlan(), NOW);
    const entries = notificationPlan({
      store,
      prefs: DEFAULT_NOTIFICATION_PREFS,
      today: '2026-10-28',
      now: '00:00',
      days: 1,
      prayerTimesOn: () => ({ ...TIMES, fajr: '03:50' }),
      defaultSlotsOf: () => ['13:00'],
    });
    expect(entries.map((e) => e.time)).toEqual(['04:10', '13:00']);
  });
});

describe('prayer settings and AlAdhan', () => {
  it('defaults the method by country and clamps offsets', () => {
    expect(defaultMethodForCountry('sa')).toBe(4);
    expect(defaultMethodForCountry('EG')).toBe(5);
    expect(defaultMethodForCountry('ZZ')).toBe(3);
    expect(parsePrayerSettings({ city: ' Cairo ', country: 'eg', offsets: { fajr: 200, isha: -3 } })).toEqual({
      city: 'Cairo',
      country: 'EG',
      method: 5,
      offsets: { fajr: 60, dhuhr: 0, asr: 0, maghrib: 0, isha: -3 },
    });
    expect(parsePrayerSettings({ city: '', country: 'EG' })).toBeNull();
    expect(parsePrayerSettings({ city: 'x', country: 'Egypt' })).toBeNull();
  });

  it('builds the calendar URL and the months to fetch', () => {
    expect(alAdhanCalendarUrl(SETTINGS, 2026, 11)).toBe('https://api.aladhan.com/v1/calendarByCity/2026/11?city=Riyadh&country=SA&method=4');
    expect(monthsToFetch('2026-10-20')).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
    ]);
    expect(monthsToFetch('2026-12-01')).toEqual([{ year: 2026, month: 12 }]);
  });

  it('parses calendar and single-day responses, skipping bad days', () => {
    const day = (date: string, fajr = '04:51 (+03)') => ({
      timings: { Fajr: fajr, Sunrise: '06:10 (+03)', Dhuhr: '11:40 (+03)', Asr: '14:50 (+03)', Maghrib: '17:15 (+03)', Isha: '18:45 (+03)' },
      date: { gregorian: { date } },
    });
    expect(parseAlAdhan({ data: [day('01-11-2026'), day('02-11-2026', 'bad')] })).toEqual({
      '2026-11-01': { fajr: '04:51', dhuhr: '11:40', asr: '14:50', maghrib: '17:15', isha: '18:45' },
    });
    expect(Object.keys(parseAlAdhan({ data: day('03-11-2026') }))).toEqual(['2026-11-03']);
    expect(parseAlAdhan(null)).toEqual({});
  });

  it('caches 30 days, applies offsets and notices stale caches', () => {
    const fetched: Record<string, PrayerTimes> = {};
    for (let d = 1; d <= 30; d++) fetched[`2026-11-${String(d).padStart(2, '0')}`] = TIMES;
    fetched['2026-10-31'] = TIMES;
    const cache = mergePrayerCache(null, SETTINGS, fetched, '2026-11-01');
    expect(Object.keys(cache.days)).toHaveLength(30);
    expect(cache.days['2026-10-31']).toBeUndefined();
    expect(parsePrayerCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
    expect(prayerCacheStale(cache, SETTINGS, '2026-11-01')).toBe(false);
    expect(prayerCacheStale(cache, SETTINGS, '2026-11-26')).toBe(true);
    expect(prayerCacheStale(cache, { ...SETTINGS, city: 'Jeddah' }, '2026-11-01')).toBe(true);
    const withOffset = { ...SETTINGS, offsets: { ...SETTINGS.offsets, fajr: 5 } };
    expect(prayerTimesOn(cache, withOffset, '2026-11-02')?.fajr).toBe('04:45');
    expect(prayerTimesOn(cache, SETTINGS, '2026-12-25')).toBeUndefined();
    const resolved = resolvedAnchorTimes(prayerLookup(cache, SETTINGS), '2026-11-29', 5);
    expect(Object.keys(resolved)).toEqual(['2026-11-29', '2026-11-30']);
    expect(parseResolvedAnchorTimes(resolved)).toEqual(resolved);
    expect(parseResolvedAnchorTimes({ '2026-11-29': { 'after-fajr': '25:00' } })).toEqual({});
  });
});

describe('my reminders and the daily text', () => {
  it('validates lines and the list size', () => {
    let list = addMyReminder([], '  اذكر   الله  ', 'a', NOW);
    expect(list[0]?.text).toBe('اذكر الله');
    expect(myReminderError(list, 'اذكر الله')).toBe('duplicate');
    expect(myReminderError(list, ' ')).toBe('empty');
    expect(myReminderError(list, 'x'.repeat(121))).toBe('tooLong');
    for (let i = 0; i < MY_REMINDERS_MAX - 1; i++) list = addMyReminder(list, `line ${i}`, `id${i}`, NOW);
    expect(myReminderError(list, 'one more')).toBe('full');
    expect(() => addMyReminder(list, 'one more', 'z', NOW)).toThrow('full');
    expect(parseMyReminders([...list, { id: 'q', text: 'extra' }, 'junk'])).toHaveLength(MY_REMINDERS_MAX);
  });

  it('picks the same item all day and the next one tomorrow', () => {
    const items = ['a', 'b', 'c'];
    expect(dailyPick(items, '2026-10-28')).toBe(dailyPick(items, '2026-10-28'));
    expect(dailyPick(items, '2026-10-29')).not.toBe(dailyPick(items, '2026-10-28'));
    expect(dailyPick([], '2026-10-28')).toBeUndefined();
  });

  it('parses the text source', () => {
    expect(parseTodayTextSource({ kind: 'set', slug: 'ayat-al-raja' })).toEqual({ kind: 'set', slug: 'ayat-al-raja' });
    expect(parseTodayTextSource({ kind: 'set', slug: 'Bad Slug' })).toEqual({ kind: 'seasons' });
    expect(parseTodayTextSource({ kind: 'mine' })).toEqual({ kind: 'mine' });
    expect(parseTodayTextSource('x')).toEqual({ kind: 'seasons' });
  });

  it('finds today’s occasion and the next one', () => {
    const occasions = [
      { key: 'monday', titleAr: 'الاثنين', titleEn: 'Monday', deed: 'fasting', rule: { kind: 'weekdays' as const, days: [1] } },
      { key: 'friday', titleAr: 'الجمعة', titleEn: 'Friday', deed: 'kahf', rule: { kind: 'weekdays' as const, days: [5] } },
    ];
    const r = seasonsOfGood(occasions, '2026-10-26'); // a Monday
    expect(r.today.map((o) => o.key)).toEqual(['monday']);
    expect(r.next).toMatchObject({ date: '2026-10-30', inDays: 4 });
    expect(r.next?.occasion.key).toBe('friday');
  });
});
