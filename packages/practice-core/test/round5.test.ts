import { describe, expect, it } from 'vitest';
import {
  addDays,
  alAdhanCalendarUrl,
  alAdhanTimingsUrl,
  applyServerChanges,
  avoidedWordsIn,
  buildSyncRequest,
  canMarkFard,
  chooseMakeUp,
  commitmentRates,
  createPlan,
  DEFAULT_NOTIFICATION_PREFS,
  defaultHomeSections,
  emptyHeart,
  emptyStore,
  excuseOfYesterday,
  exportForSync,
  FARD_EVIDENCE,
  fardEnabled,
  fardOn,
  fardStats,
  featureAtRoute,
  formatPrayerCountdown,
  GLOSSARY,
  heartSlot,
  HOME_SECTION_KEYS,
  HOME_SECTIONS,
  isDefaultHomeSections,
  isRemindableOccasionRule,
  limits,
  localChanges,
  makeIntention,
  makeUpOffer,
  markMakeUpDone,
  meanCommitment,
  moveHomeSection,
  NAV_FEATURES,
  NAV_GROUPS,
  navName,
  nextPrayer,
  nextPrayerLine,
  notificationPlan,
  NOTIFY_TEXTS,
  occasionStarts,
  occurrences,
  parseAlAdhanMeta,
  parseFardMarks,
  parseHeart,
  parseHomeSections,
  parseNotificationPrefs,
  parsePrayerSettings,
  parseStore,
  PLEDGE_ACTIONS,
  PLEDGE_DEED_INFO,
  prayerCacheKey,
  resolveHomeSections,
  saveEvening,
  serializeHeart,
  serializeHomeSections,
  serializeStore,
  setFard,
  setFardTracking,
  setHeartPrefs,
  setHomeSections,
  setHomeSectionVisible,
  settingsContent,
  startEbb,
  toggleExcusedDay,
  upsertPlan,
  usualDeedDue,
  validateHomeSections,
  visibleHomeSections,
  WEB_REDIRECTS,
  currentStreak,
  type AgendaOccasion,
  type HomeSectionPref,
  type Plan,
  type Store,
} from '../src/index.js';

const NOW = '2026-11-07T08:00:00.000Z';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 7, 8, minute)).toISOString();

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'x', title: id, unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-09-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

/** A log of every day from `from` to `to`. */
function everyDay(from: string, to: string, amount = 10): Record<string, number> {
  const log: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) log[d] = amount;
  return log;
}

// ── nav-map ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('nav-map', () => {
  it('has unique keys, both names and a known group for every feature', () => {
    const keys = NAV_FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of NAV_FEATURES) {
      expect(f.key).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(f.ar.trim().length, f.key).toBeGreaterThan(0);
      expect(f.en.trim().length, f.key).toBeGreaterThan(0);
      expect(NAV_GROUPS).toContain(f.group);
      expect(f.web !== null || f.app !== null, f.key).toBe(true);
      if (f.parent !== undefined) expect(keys, f.key).toContain(f.parent);
      if (f.web !== null) expect(f.web.startsWith('/'), f.key).toBe(true);
      if (f.app !== null) expect(f.app.startsWith('/'), f.key).toBe(true);
    }
  });

  it('covers the round-5 tables (web and app)', () => {
    const web = new Set(NAV_FEATURES.map((f) => f.web));
    for (const route of [
      '/practice',
      '/practice/periodic',
      '/practice/review',
      '/practice/record',
      '/practice/habits/[id]',
      '/practice/people',
      '/practice/leave-sin',
      '/favorites',
      '/favorites/reminders',
      '/settings/notifications',
      '/settings/prayer-times',
      '/practice/strategies',
    ]) {
      expect(web.has(route), route).toBe(true);
    }
    for (const key of ['wird', 'periodic', 'review', 'record', 'more', 'circles', 'saved', 'my-reminders', 'browse', 'branches', 'strategies', 'settings', 'account', 'notifications', 'prayer-times', 'appearance', 'about', 'leave-sin', 'people', 'privacy']) {
      expect(NAV_FEATURES.some((f) => f.key === key), key).toBe(true);
    }
    expect(navName('circles', 'ar')).toBe('رفقة');
    expect(NAV_FEATURES.find((f) => f.key === 'circles')?.web).toBeNull();
    expect(featureAtRoute('web', '/practice')?.key).toBe('habits');
    // The app has no settings screen: its rows are the last group of «المزيد».
    expect(featureAtRoute('app', '/more')?.key).toBe('more');
    expect(() => navName('nope', 'ar')).toThrow();
  });

  it('redirects every old web path to a page of the map', () => {
    const web = new Set(NAV_FEATURES.map((f) => f.web));
    for (const r of WEB_REDIRECTS) expect(web.has(r.to), r.from).toBe(true);
  });

  it('glossary: unique keys, names used by the map, no avoided word in any feature name', () => {
    expect(new Set(GLOSSARY.map((t) => t.key)).size).toBe(GLOSSARY.length);
    expect(GLOSSARY.find((t) => t.key === 'texts')?.avoidAr).toContain('اقتباسات');
    for (const f of NAV_FEATURES) expect(avoidedWordsIn(f.ar), f.key).toEqual([]);
    expect(avoidedWordsIn('استكشف النصوص')).toEqual([{ word: 'استكشف', use: 'تصفّح النصوص' }, { word: 'استكشف النصوص', use: 'تصفّح النصوص' }]);
    expect(navName('browse', 'ar')).toBe(GLOSSARY.find((t) => t.key === 'browse')?.ar);
  });
});

// ── Home sections ───────────────────────────────────────────────────────────────────────────────────────────────

describe('home sections', () => {
  it('has the eight sections of the plan, in order, with shared names', () => {
    expect(HOME_SECTION_KEYS).toEqual(['wird', 'daily-text', 'week-branch', 'occasion', 'doors', 'moments', 'featured', 'sources']);
    expect(HOME_SECTIONS.map((s) => s.ar)).toEqual([
      'ورد اليوم',
      'نص اليوم',
      'شعبة الأسبوع',
      'مناسبة قريبة',
      'أبواب الخير',
      'في لحظات مثل هذه',
      'تذكرة مختارة',
      'المصادر',
    ]);
  });

  it('visitor: fixed order without members-only sections; member: defaults until customised', () => {
    expect(visibleHomeSections(null, false)).toEqual(['daily-text', 'occasion', 'doors', 'moments', 'featured', 'sources']);
    expect(visibleHomeSections(undefined, true)).toEqual(['wird', 'daily-text', 'occasion', 'doors', 'moments', 'featured', 'sources']);
  });

  it('parses defensively and resolves new sections into a stored order', () => {
    expect(parseHomeSections('x')).toBeNull();
    expect(parseHomeSections([{ key: 'nope', visible: true }, { key: 'doors' }])).toBeNull();
    const stored = parseHomeSections([
      { key: 'sources', visible: true, extra: 1 },
      { key: 'wird', visible: false },
      { key: 'sources', visible: false },
    ]);
    expect(stored).toEqual([
      { key: 'sources', visible: true },
      { key: 'wird', visible: false },
    ]);
    const full = resolveHomeSections(stored);
    expect(full.map((s) => s.key)).toEqual(['sources', 'wird', 'daily-text', 'week-branch', 'occasion', 'doors', 'moments', 'featured']);
    expect(full.find((s) => s.key === 'week-branch')?.visible).toBe(false);
    expect(JSON.parse(serializeHomeSections(stored))).toEqual(full);
  });

  it('moves and hides; the defaults are stored as absent', () => {
    let list: HomeSectionPref[] = moveHomeSection(null, 'sources', 0);
    expect(list[0]).toEqual({ key: 'sources', visible: true });
    list = setHomeSectionVisible(list, 'moments', false);
    expect(isDefaultHomeSections(list)).toBe(false);
    expect(isDefaultHomeSections(defaultHomeSections())).toBe(true);
    let s = setHomeSections(emptyStore(), list, at(1));
    expect(s.settings.homeSections).toEqual(list);
    expect(s.settings.updatedAt).toBe(at(1));
    s = setHomeSections(s, defaultHomeSections(), at(2));
    expect(s.settings.homeSections).toBeUndefined();
    expect(() => setHomeSections(emptyStore(), [{ key: 'wird', visible: true }, { key: 'wird', visible: false }], at(1))).toThrow();
  });

  it('validates what a client sends', () => {
    expect(validateHomeSections(defaultHomeSections())).toBeNull();
    expect(validateHomeSections([])).not.toBeNull();
    expect(validateHomeSections([{ key: 'wird', visible: 'yes' }])).not.toBeNull();
    expect(validateHomeSections([{ key: 'x', visible: true }])).not.toBeNull();
  });

  it('syncs in the settings: in the wire body and in the canonical content only when set', () => {
    const before = settingsContent({ hijriOffset: 0 });
    expect(before).toBe('{"hijriOffset":0,"reminderTimes":[],"freeMinutesPerDay":null}');
    const list = moveHomeSection(null, 'sources', 0);
    const s = setHomeSections(emptyStore(), list, at(1));
    expect(localChanges(s).settings?.homeSections).toEqual(list);
    expect(settingsContent(s.settings)).toContain('"homeSections"');
    // The other device receives it; jsonb may reorder keys, the content stays canonical.
    const other = applyServerChanges(emptyStore(), {
      serverTime: at(5),
      settings: { hijriOffset: 0, reminderTimes: [], freeMinutesPerDay: null, excusedDays: [], homeSections: list.map((x) => ({ visible: x.visible, key: x.key })), fardTracking: false, clientUpdatedAt: at(1) },
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
    });
    expect(other.settings.homeSections).toEqual(list);
    expect(localChanges(other).settings).toBeUndefined();
    // An invalid list from a server is ignored as a whole (the settings stay).
    const bad = applyServerChanges(other, {
      serverTime: at(6),
      settings: { hijriOffset: 1, reminderTimes: [], freeMinutesPerDay: null, homeSections: [{ key: 'x', visible: true }], clientUpdatedAt: at(4) },
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
    });
    expect(bad.settings.hijriOffset).toBe(0);
    expect(parseStore(serializeStore(other)).settings.homeSections).toEqual(list);
  });
});

// ── الفرائض ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('الفرائض', () => {
  const today = '2026-11-07';

  it('is opt-in and marks each prayer on time, qada or empty', () => {
    let s = emptyStore();
    expect(fardEnabled(s)).toBe(false);
    s = setFardTracking(s, true, at(1));
    expect(fardEnabled(s)).toBe(true);
    s = setFard(s, { date: today, prayer: 'fajr', status: 'qada', today }, at(2));
    s = setFard(s, { date: today, prayer: 'dhuhr', status: 'onTime', today }, at(3));
    expect(fardOn(s, today)).toEqual({ fajr: 'qada', dhuhr: 'onTime', asr: null, maghrib: null, isha: null });
    const same = setFard(s, { date: today, prayer: 'dhuhr', status: 'onTime', today }, at(9));
    expect(same).toBe(s);
    s = setFard(s, { date: today, prayer: 'fajr', status: null, today }, at(4));
    expect(fardOn(s, today).fajr).toBeNull();
    expect(s.fard?.find((m) => m.prayer === 'fajr')).toEqual({ date: today, prayer: 'fajr', status: null, updatedAt: at(4) });
    expect(() => setFard(s, { date: '2026-11-08', prayer: 'asr', status: 'onTime', today }, at(5))).toThrow();
    expect(canMarkFard('2026-10-01', today)).toBe(true);
    // Off keeps the marks.
    const off = setFardTracking(s, false, at(6));
    expect(fardEnabled(off)).toBe(false);
    expect(off.fard).toEqual(s.fard);
    expect(off.settings.fardTracking).toBeUndefined();
  });

  it('stays outside the habit limit and the streak', () => {
    const p = plan('a', { log: everyDay('2026-11-01', '2026-11-06') });
    let s = storeOf(p);
    const limitsBefore = limits(s, today);
    const streakBefore = currentStreak(s, today);
    s = setFardTracking(s, true, at(1));
    for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) s = setFard(s, { date: '2026-11-05', prayer, status: 'qada', today }, at(2));
    expect(JSON.stringify(limits(s, today))).toBe(JSON.stringify(limitsBefore));
    expect(currentStreak(s, today)).toEqual(streakBefore);
  });

  it('counts over 30 days', () => {
    let s = emptyStore();
    for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) s = setFard(s, { date: '2026-11-06', prayer, status: 'onTime', today }, at(1));
    s = setFard(s, { date: '2026-11-07', prayer: 'fajr', status: 'qada', today }, at(2));
    s = setFard(s, { date: '2026-11-07', prayer: 'dhuhr', status: 'onTime', today }, at(3));
    s = setFard(s, { date: '2026-10-01', prayer: 'isha', status: 'qada', today }, at(4));
    const stats = fardStats(s, today);
    expect(stats).toMatchObject({ days: 30, markedDays: 2, allOnTimeDays: 1, onTime: 6, qada: 1 });
    expect(stats.perPrayer.fajr).toEqual({ onTime: 1, qada: 1 });
    expect(fardStats(s, today, 60).qada).toBe(2);
    expect(FARD_EVIDENCE.length).toBeGreaterThan(0);
    for (const id of FARD_EVIDENCE) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('parses defensively; the later version wins', () => {
    expect(parseFardMarks('x')).toEqual([]);
    expect(
      parseFardMarks([
        { date: '2026-11-07', prayer: 'asr', status: 'onTime', updatedAt: at(2) },
        { date: '2026-11-07', prayer: 'asr', status: 'qada', updatedAt: at(1) },
        { date: '2026-11-07', prayer: 'witr', status: 'onTime', updatedAt: at(1) },
        { date: '2026-11-07', prayer: 'fajr', status: 'late', updatedAt: at(1) },
        { date: '2026-13-07', prayer: 'fajr', status: 'qada', updatedAt: at(1) },
      ]),
    ).toEqual([{ date: '2026-11-07', prayer: 'asr', status: 'onTime', updatedAt: at(2) }]);
    // Stores without marks keep their exact shape.
    expect('fard' in parseStore(serializeStore(emptyStore()))).toBe(false);
  });

  it('syncs mark by mark, last writer wins, a cleared mark included', () => {
    let s = setFard(emptyStore(), { date: today, prayer: 'fajr', status: 'onTime', today }, at(1));
    s = setFard(s, { date: today, prayer: 'isha', status: 'qada', today }, at(2));
    const req = buildSyncRequest(s);
    expect(req.changes.fard).toEqual([
      { date: today, prayer: 'fajr', status: 'onTime', clientUpdatedAt: at(1) },
      { date: today, prayer: 'isha', status: 'qada', clientUpdatedAt: at(2) },
    ]);
    expect(exportForSync(s).fard).toHaveLength(2);
    // The server echoes both, and another device cleared fajr later.
    const res = {
      serverTime: at(10),
      settings: null,
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
      fard: [
        { date: today, prayer: 'fajr', status: null, clientUpdatedAt: at(5) },
        { date: today, prayer: 'isha', status: 'qada', clientUpdatedAt: at(2) },
        { date: today, prayer: 'asr', status: 'onTime', clientUpdatedAt: at(3) },
        { date: today, prayer: 'nope', status: 'onTime', clientUpdatedAt: at(3) },
      ],
    };
    const merged = applyServerChanges(s, res);
    expect(fardOn(merged, today)).toEqual({ fajr: null, dhuhr: null, asr: 'onTime', maghrib: null, isha: 'qada' });
    expect(localChanges(merged).fard).toBeUndefined();
    // An older server copy never overwrites a newer local edit; the local one stays pending.
    const local = setFard(merged, { date: today, prayer: 'asr', status: 'qada', today }, at(20));
    const stale = applyServerChanges(local, { ...res, serverTime: at(21), fard: [{ date: today, prayer: 'asr', status: 'onTime', clientUpdatedAt: at(3) }] });
    expect(fardOn(stale, today).asr).toBe('qada');
    expect(localChanges(stale).fard).toEqual([{ date: today, prayer: 'asr', status: 'qada', clientUpdatedAt: at(20) }]);
  });

  it('syncs the switch in the settings', () => {
    const s = setFardTracking(emptyStore(), true, at(1));
    expect(localChanges(s).settings?.fardTracking).toBe(true);
    expect(settingsContent(s.settings)).toContain('"fardTracking":true');
  });
});

// ── Commitment and the heart slot ───────────────────────────────────────────────────────────────────────────────

describe('commitment (moved from the clients)', () => {
  const today = '2026-11-07';

  it('measures the 30 days before the excused day, above 60% only', () => {
    const p = plan('a', { log: everyDay('2026-10-01', '2026-11-05') });
    let s = toggleExcusedDay(storeOf(p), '2026-11-06', today, NOW);
    expect(excuseOfYesterday(s, today)).toBe('excused');
    expect(meanCommitment(commitmentRates(s, '2026-11-06'))).toBe(1);
    expect(usualDeedDue(s, today)).toBe(true);
    // Not on the excused day itself, nor two days later.
    expect(usualDeedDue(s, '2026-11-06')).toBe(false);
    expect(usualDeedDue(s, '2026-11-08')).toBe(false);
    // Half the days logged: below the threshold.
    const half: Record<string, number> = {};
    for (let d = '2026-10-06'; d <= '2026-11-05'; d = addDays(d, 2)) half[d] = 10;
    s = toggleExcusedDay(storeOf(plan('a', { log: half })), '2026-11-06', today, NOW);
    expect(usualDeedDue(s, today)).toBe(false);
  });

  it('counts a heavy day (a habit lightened yesterday)', () => {
    const p = startEbb(plan('a', { log: everyDay('2026-10-01', '2026-11-06') }), '2026-11-06', NOW);
    const s = storeOf(p);
    expect(excuseOfYesterday(s, today)).toBe('heavy');
    expect(usualDeedDue(s, today)).toBe(true);
    expect(usualDeedDue(s, today, { isPeriodicAct: () => true })).toBe(false);
  });
});

describe('heartSlot', () => {
  const today = '2026-11-05'; // Thursday
  const store = storeOf(plan('a', { log: everyDay('2026-10-01', '2026-11-04') }));

  it('one card with a fixed priority: intention → evening → weekly → usual deed → the intention made', () => {
    let heart = setHeartPrefs(emptyHeart(), { intention: true, eveningReview: true, eveningFrom: '18:00' });
    expect(heartSlot(heart, store, today, '07:00')).toEqual({ kind: 'intention', state: 'card' });
    expect(heartSlot(heart, store, today, '13:00')).toBeNull();
    expect(heartSlot(heart, store, today, '18:30')).toEqual({ kind: 'evening' });
    heart = saveEvening(heart, { date: today });
    expect(heartSlot(heart, store, today, '18:30')).toBeNull();
    // Friday: the weekly review, all day.
    expect(heartSlot(heart, store, '2026-11-06', '15:00')).toEqual({ kind: 'weekly', weekOf: '2026-11-06' });
    heart = makeIntention(heart, { date: today, planIds: ['a'] });
    expect(heartSlot(heart, store, today, '07:00')).toEqual({ kind: 'intention', state: 'made' });
    expect(heartSlot(emptyHeart(), store, today, '07:00')).toEqual({ kind: 'intention', state: 'offer' });
  });

  it('«عملك المعتاد يُكتب لك» the morning after an excuse, under the intention card', () => {
    const excused = toggleExcusedDay(store, '2026-11-04', today, NOW);
    const heart = setHeartPrefs(emptyHeart(), { intentionOfferDismissed: true, fridayReview: false });
    expect(heartSlot(heart, excused, today, '08:00')).toEqual({ kind: 'usual-deed', reason: 'excused' });
    expect(heartSlot(heart, excused, today, '12:00')).toBeNull();
    const withIntention = setHeartPrefs(heart, { intention: true });
    expect(heartSlot(withIntention, excused, today, '08:00')).toEqual({ kind: 'intention', state: 'card' });
    const made = makeIntention(withIntention, { date: today, planIds: [] });
    expect(heartSlot(made, excused, today, '08:00')).toEqual({ kind: 'usual-deed', reason: 'excused' });
  });
});

// ── «صلّحها» after two missed days ──────────────────────────────────────────────────────────────────────────────

describe('makeUpOffer', () => {
  const today = '2026-11-07';
  // 18:00 local: yesterday's «قضاء» window (until noon) has closed.
  const now = new Date(2026, 10, 7, 18, 0).getTime();

  it('is due after two asked days missed in a row, for a few days, with the 12 deeds, sadaqah and custom', () => {
    const p = plan('a', { log: everyDay('2026-10-01', '2026-11-04') });
    const s = storeOf(p);
    const offer = makeUpOffer(s, p, today, { now });
    expect(offer).toEqual({ planId: 'a', on: '2026-11-06', actions: PLEDGE_ACTIONS, chosen: null });
    expect(offer?.actions.slice(0, PLEDGE_DEED_INFO.length)).toEqual(PLEDGE_DEED_INFO.map((d) => d.key));
    expect(makeUpOffer(s, p, '2026-11-09', { now: new Date(2026, 10, 9, 18).getTime() })?.on).toBe('2026-11-08');
    // Morning: yesterday can still be logged, so only one sure miss.
    expect(makeUpOffer(s, p, today, { now: new Date(2026, 10, 7, 9).getTime() })).toBeNull();
    // An excused day breaks the run.
    expect(makeUpOffer(toggleExcusedDay(s, '2026-11-05', today, NOW), p, today, { now })).toBeNull();
    // Logged yesterday: nothing.
    const kept = plan('b', { log: everyDay('2026-10-01', '2026-11-06') });
    expect(makeUpOffer(storeOf(kept), kept, today, { now })).toBeNull();
  });

  it('expires a few days after the trigger', () => {
    const p = plan('a', { log: { ...everyDay('2026-10-01', '2026-10-30'), ...everyDay('2026-11-02', '2026-11-07') } });
    // Misses on 31 Oct and 1 Nov; logged since.
    expect(makeUpOffer(storeOf(p), p, '2026-11-03', { now: new Date(2026, 10, 3, 18).getTime() })?.on).toBe('2026-11-01');
    expect(makeUpOffer(storeOf(p), p, '2026-11-05', { now: new Date(2026, 10, 5, 18).getTime() })).toBeNull();
  });

  it('records the chosen deed for the trigger and keeps it on the device', () => {
    const p = plan('a', { log: everyDay('2026-10-01', '2026-11-04') });
    let heart = chooseMakeUp(emptyHeart(), { planId: 'a', on: '2026-11-06', date: today, action: 'istighfar' });
    heart = chooseMakeUp(heart, { planId: 'a', on: '2026-11-06', date: today, action: 'sadaqah', text: ' 5   دنانير ' });
    expect(heart.makeUps).toEqual([{ planId: 'a', on: '2026-11-06', date: today, action: 'sadaqah', text: '5 دنانير' }]);
    heart = markMakeUpDone(heart, 'a', '2026-11-06');
    expect(makeUpOffer(storeOf(p), p, today, { now, heart })?.chosen).toEqual({
      planId: 'a',
      on: '2026-11-06',
      date: today,
      action: 'sadaqah',
      text: '5 دنانير',
      done: true,
    });
    expect(parseHeart(serializeHeart(heart)).makeUps).toEqual(heart.makeUps);
    expect(() => chooseMakeUp(emptyHeart(), { planId: 'a', on: today, date: today, action: 'custom' })).toThrow();
    // Old heart data (pledges, no makeUps) still parses.
    const old = parseHeart({ v: 1, pledges: [{ id: 'g', planId: 'a', action: 'rakatain', createdOn: '2026-10-01', kept: [] }] });
    expect(old.pledges).toHaveLength(1);
    expect(old.makeUps).toBeUndefined();
  });
});

// ── Notifications ───────────────────────────────────────────────────────────────────────────────────────────────

describe('notifications (round 5)', () => {
  const WHITE: AgendaOccasion = { key: 'ayyam-bid', titleAr: 'الأيام البيض', titleEn: 'The white days', deed: 'siyam', rule: { kind: 'hijriMonthDays', days: [13, 14, 15] } };
  const MONTHLY: AgendaOccasion = { key: 'mid', titleAr: 'منتصف الشهر', titleEn: 'Mid-month', deed: 'x', rule: { kind: 'monthlyDay', day: 15 } };
  const WEEKLY: AgendaOccasion = { key: 'ithnayn-khamis', titleAr: 'الاثنين والخميس', titleEn: 'Mon/Thu', deed: 'siyam', rule: { kind: 'weekdays', days: [1, 4] } };

  it('parses old prefs harmlessly and plans no strategy reminder', () => {
    const prefs = parseNotificationPrefs({ strategies: ['company'], strategyTime: '09:00', occasions: true, occasionTime: '19:30' });
    expect(prefs.occasions).toBe(true);
    expect(prefs.occasionTime).toBe('19:30');
    expect(DEFAULT_NOTIFICATION_PREFS.occasions).toBe(false);
    const plan = notificationPlan({ store: emptyStore(), prefs, today: '2026-11-07', now: '08:00', days: 14 });
    expect(plan.some((e) => e.kind === 'strategy')).toBe(false);
  });

  it('«مناسبة قريبة»: the day before a non-weekly occasion starts, at the user’s time, opt-in', () => {
    expect(isRemindableOccasionRule(WEEKLY.rule)).toBe(false);
    expect(isRemindableOccasionRule(WHITE.rule)).toBe(true);
    const store = emptyStore();
    const base = { store, today: '2026-11-07', now: '08:00', days: 40, occasions: [WHITE, MONTHLY, WEEKLY] };
    expect(notificationPlan({ ...base, prefs: DEFAULT_NOTIFICATION_PREFS }).filter((e) => e.kind === 'occasion')).toEqual([]);
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, occasions: true, occasionTime: '20:00' };
    const entries = notificationPlan({ ...base, prefs }).filter((e) => e.kind === 'occasion');
    const whiteStarts = occasionStarts(WHITE, '2026-11-08', '2026-12-17');
    // One reminder per run of white days (not one per day), and the 15th of each month.
    expect(whiteStarts.length).toBeGreaterThan(0);
    const white = occurrences(WHITE.rule, '2026-11-07', '2026-12-17');
    expect(white.length).toBeGreaterThan(whiteStarts.length);
    const expected = new Map<string, string[]>();
    for (const d of whiteStarts) expected.set(addDays(d, -1), [...(expected.get(addDays(d, -1)) ?? []), 'ayyam-bid']);
    for (const d of ['2026-11-15', '2026-12-15']) expected.set(addDays(d, -1), [...(expected.get(addDays(d, -1)) ?? []), 'mid']);
    expect(entries.map((e) => [e.date, e.time, e.occasions])).toEqual(
      [...expected.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, keys]) => [d, '20:00', keys]),
    );
    expect(entries.every((e) => e.occasionDate === addDays(e.date, 1))).toBe(true);
    expect(entries.some((e) => e.occasions?.includes('ithnayn-khamis'))).toBe(false);
    expect(NOTIFY_TEXTS.ar.occasionBody('يوم عرفة')).toBe('غدًا: يوم عرفة');
    // Today's reminder after its time is not planned.
    const late = notificationPlan({ ...base, today: '2026-11-14', now: '21:00', days: 1, prefs });
    expect(late.filter((e) => e.kind === 'occasion')).toEqual([]);
    expect(notificationPlan({ ...base, today: '2026-11-14', now: '19:00', days: 1, prefs }).map((e) => e.key)).toContain('occasion:2026-11-14');
  });

  it('stays outside the daily cap', () => {
    const store = storeOf(...['a', 'b', 'c', 'd', 'e'].map((id) => plan(id, { slots: ['10:00'] })));
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, occasions: true, occasionTime: '20:00' };
    const day = notificationPlan({ store, prefs, today: '2026-11-14', now: '08:00', days: 1, occasions: [MONTHLY] });
    expect(day.map((e) => e.kind)).toEqual(['habit', 'habit', 'habit', 'digest', 'occasion']);
  });
});

// ── Prayer times by city ────────────────────────────────────────────────────────────────────────────────────────

describe('prayer times by city (round 5)', () => {
  const offsets = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

  it('needs only a city; AlAdhan picks the method when none is set', () => {
    const s = parsePrayerSettings({ city: '  عمّان  ' });
    expect(s).toEqual({ city: 'عمّان', offsets });
    expect(alAdhanCalendarUrl(s!, 2026, 11)).toBe(`https://api.aladhan.com/v1/calendarByAddress/2026/11?address=${encodeURIComponent('عمّان')}`);
    expect(alAdhanTimingsUrl({ city: 'Amman', method: 23 }, '2026-11-07')).toBe(
      'https://api.aladhan.com/v1/timingsByAddress/07-11-2026?address=Amman&method=23',
    );
    expect(prayerCacheKey({ city: 'Amman' })).toBe('amman||auto');
    // An older setting keeps its key, so its cache stays valid.
    expect(prayerCacheKey({ city: 'Riyadh', country: 'SA', method: 4 })).toBe('riyadh|SA|4');
  });

  it('reads where AlAdhan found the city and which method it used', () => {
    const ok = {
      code: 200,
      data: { timings: {}, meta: { latitude: 31.95, longitude: 35.93, timezone: 'Asia/Amman', method: { id: 23, name: 'Jordan' } } },
    };
    expect(parseAlAdhanMeta(ok)).toEqual({ timezone: 'Asia/Amman', latitude: 31.95, longitude: 35.93, method: 23 });
    expect(parseAlAdhanMeta({ code: 200, data: [{ meta: { latitude: 1, longitude: 2, timezone: 'UTC', method: { id: 99 } } }] })?.method).toBeNull();
    expect(parseAlAdhanMeta({ code: 400, data: 'Unable to geocode address.' })).toBeNull();
    expect(parseAlAdhanMeta(null)).toBeNull();
  });

  it('nextPrayer: the first prayer after now, tomorrow’s Fajr after Isha', () => {
    const times = { fajr: '04:50', dhuhr: '11:40', asr: '14:45', maghrib: '17:05', isha: '18:25' };
    expect(nextPrayer(times, '13:33')).toEqual({ prayer: 'asr', time: '14:45', inMinutes: 72, tomorrow: false });
    expect(nextPrayerLine(nextPrayer(times, '13:33'), 'ar')).toBe('العصر بعد 1:12');
    expect(nextPrayerLine(nextPrayer(times, '13:33'), 'en')).toBe('Asr in 1:12');
    expect(nextPrayer(times, '14:45').prayer).toBe('maghrib');
    expect(nextPrayer(times, '03:00')).toMatchObject({ prayer: 'fajr', inMinutes: 110, tomorrow: false });
    expect(nextPrayer(times, '22:00', { ...times, fajr: '04:51' })).toEqual({ prayer: 'fajr', time: '04:51', inMinutes: 411, tomorrow: true });
    expect(nextPrayer(times, '22:00').inMinutes).toBe(410);
    expect(formatPrayerCountdown(5)).toBe('0:05');
    expect(() => nextPrayer(times, '25:00')).toThrow();
  });
});
