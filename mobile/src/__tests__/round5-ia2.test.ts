/**
 * Owner round 5 (second app agent): «لحظة مجاهدة» acts per sin (F-09), the evidence batches that keep one public
 * request for everyone, «مناسبة قريبة» reminders (F-17), the honest status of «التنبيهات» (F-29 a), and the one-time
 * widget line (F-24 a).
 */

import { emptyStore, NOTIFY_TEXTS, type Store } from '@thekra/practice-core';
import type { CatalogOccasion, MomentTools } from '../lib/practice/catalog-types';
import { allMomentEvidenceIds, EVIDENCE_BATCH, evidenceBatches, momentToolsFor } from '../lib/practice/moment-tools';
import { DEFAULT_PREFS, parsePrefs, type PracticePrefs } from '../lib/practice/prefs';
import { anyReminderOn, OCCASION_ROUTE, planReminders, remindersOn, SIN_REMINDER_TITLE, type ReminderTexts } from '../lib/practice/reminders';
import { loggedDays, shouldShowWidgetIntro, WIDGET_INTRO_AFTER_DAYS } from '../widget/intro';
import { MOMENT_LABEL_FALLBACK, MOMENT_URI, widgetView } from '../widget/snapshot';
import { EMPTY_SNAPSHOT } from '../widget/empty';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const moment: MomentTools = {
  generic: [
    { key: 'istiadha', titleAr: 'استعذ بالله من الشيطان', titleEn: 'Seek refuge', evidence: [id(1), id(2)] },
    { key: 'allah-sees', titleAr: 'تذكّر أن الله يراك', titleEn: 'Allah sees you', evidence: [id(3)] },
  ],
  sins: {
    ghadab: [
      { key: 'istiadha', titleAr: 'استعذ بالله من الشيطان', titleEn: 'Seek refuge', evidence: [id(4)] },
      { key: 'sit-lie-down', titleAr: 'اجلس، فإن لم يذهب فاضطجع', titleEn: 'Sit down', evidence: [id(5)] },
    ],
    ghibah: [{ key: 'speak-good-or-silent', titleAr: 'قل خيرًا أو اصمت', titleEn: 'Speak good', evidence: [id(6), id(1)] }],
  },
  aliases: { 'ghibah-raqamiya': 'ghibah' },
};

describe('«لحظة مجاهدة» acts per sin (F-09)', () => {
  it('gives the sin its own acts, an alias the acts it points to, and every other sin (or none) the generic ones', () => {
    expect(momentToolsFor(moment, 'ghadab')).toEqual({ tools: moment.sins['ghadab'], own: true });
    expect(momentToolsFor(moment, 'ghibah-raqamiya')).toEqual({ tools: moment.sins['ghibah'], own: true });
    expect(momentToolsFor(moment, 'riba')).toEqual({ tools: moment.generic, own: false });
    expect(momentToolsFor(moment, null)).toEqual({ tools: moment.generic, own: false });
    // An API deploy without `moment` yet: no acts, the screen keeps its other tools.
    expect(momentToolsFor(undefined, 'ghadab')).toEqual({ tools: [], own: false });
  });

  it('asks the texts of every act of every sin at once, sorted and unique (the same request for every user)', () => {
    expect(allMomentEvidenceIds(moment)).toEqual([id(1), id(2), id(3), id(4), id(5), id(6)]);
    expect(allMomentEvidenceIds(undefined)).toEqual([]);
  });

  it('splits more than 50 ids into fixed batches the API accepts', () => {
    const ids = Array.from({ length: 57 }, (_, i) => id(i));
    const batches = evidenceBatches(ids);
    expect(batches.map((b) => b.length)).toEqual([EVIDENCE_BATCH, 7]);
    expect(batches.flat()).toEqual(ids);
    expect(evidenceBatches([])).toEqual([]);
  });
});

const texts: ReminderTexts = {
  habitBody: (amount) => `المطلوب اليوم: ${amount}`,
  kinshipTitle: 'صلة الرحم',
  kinshipBodyGeneric: (n) => `حان وقت التواصل مع ${n}`,
  kinshipBodyNames: (names) => `حان وقت التواصل مع: ${names}`,
  sinBody: 'لحظة لنفسك. افتح ذكرى.',
  unitFallback: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' },
  listSeparator: '، ',
  wirdTitle: 'ورد اليوم',
  eveningBody: 'بقي من يومك قليل',
  fridayTitle: 'المحاسبة',
  fridayBody: 'دقيقتان مع نفسك',
  digestBody: (n) => `عندك ${n} أعمال اليوم`,
};

const arafah: CatalogOccasion = {
  key: 'arafah',
  titleAr: 'صيام يوم عرفة (9 ذو الحجة)',
  titleEn: 'Fasting the Day of Arafah (9 Dhu al-Hijja)',
  deed: 'siyam',
  rule: { kind: 'hijriYearly', month: 12, day: 9 },
  basis: 'text',
  evidence: [],
};

// Arafah 1448 falls on 2027-05-15 (backend e2e, Umm al-Qura): the reminder is the evening before.
const EVE = '2027-05-14';
const off: PracticePrefs = { ...DEFAULT_PREFS, habitReminders: false, fridayReminder: false };

describe('«مناسبة قريبة» (F-17): an opt-in reminder the evening before an occasion', () => {
  const plan = (prefs: PracticePrefs, store: Store = emptyStore()) =>
    planReminders({ store, prefs, habits: [], today: EVE, now: '10:00', locale: 'ar', texts, days: 2, occasions: [arafah] });

  it('is off by default and rings at the chosen time with the occasion’s catalog title when on', () => {
    expect(DEFAULT_PREFS.occasionReminders).toBe(false);
    expect(plan(off).filter((r) => r.kind === 'occasion')).toEqual([]);
    const list = plan({ ...off, occasionReminders: true, occasionTime: '20:30' });
    expect(list).toEqual([
      expect.objectContaining({
        kind: 'occasion',
        date: EVE,
        time: '20:30',
        title: NOTIFY_TEXTS.ar.occasionTitle,
        body: NOTIFY_TEXTS.ar.occasionBody(arafah.titleAr),
        route: OCCASION_ROUTE,
      }),
    ]);
    // Never a sin, never the private moment's words.
    expect(list.some((r) => r.title === SIN_REMINDER_TITLE)).toBe(false);
  });

  it('keeps its switch and time across a reload; a bad time falls back', () => {
    const saved = parsePrefs(JSON.stringify({ ...DEFAULT_PREFS, occasionReminders: true, occasionTime: '19:15' }));
    expect(saved).toMatchObject({ occasionReminders: true, occasionTime: '19:15' });
    expect(parsePrefs({ v: 1, occasionTime: '25:00' }).occasionTime).toBe(DEFAULT_PREFS.occasionTime);
  });
});

describe('«التنبيهات» status (F-29 a): only what is true', () => {
  it('counts what rings on the day, and knows when every switch is off', () => {
    expect(remindersOn([{ date: '2026-11-07' }, { date: '2026-11-08' }, { date: '2026-11-07' }], '2026-11-07')).toBe(2);
    expect(anyReminderOn(DEFAULT_PREFS)).toBe(true);
    expect(anyReminderOn({ ...off, kinshipReminders: false, eveningNudge: false, sinReminders: false, occasionReminders: false })).toBe(false);
    expect(anyReminderOn({ ...off, occasionReminders: true })).toBe(true);
  });
});

describe('the wird widget (F-24 a)', () => {
  it('has a generic «لحظة مجاهدة» button: its own deep link, no sin', () => {
    expect(MOMENT_URI).toBe('thekra://practice/moment');
    const view = widgetView(EMPTY_SNAPSHOT, '2026-11-07');
    expect(view.wird.moment).toBe('لحظة مجاهدة');
    // A snapshot saved by an older build has no label: the Arabic words.
    const { moment: _drop, ...older } = EMPTY_SNAPSHOT.labels;
    expect(widgetView({ ...EMPTY_SNAPSHOT, labels: older }, '2026-11-07').wird.moment).toBe(MOMENT_LABEL_FALLBACK);
  });

  it('offers «أضف ورد اليوم إلى شاشتك» once, on Android, after 3 days of logging, when no wird widget is placed', () => {
    const withLogs = (...days: string[]) =>
      ({ plans: [{ log: Object.fromEntries(days.map((d) => [d, 5])) }, { log: { [days[0] ?? '2026-11-01']: 1, '2026-10-01': 0 } }] }) as unknown as Store;
    let store = withLogs('2026-11-01', '2026-11-02');
    expect(loggedDays(store)).toBe(2);
    const state = { os: 'android', days: loggedDays(store), seen: false, placed: false };
    expect(shouldShowWidgetIntro(state)).toBe(false);
    store = withLogs('2026-11-01', '2026-11-02', '2026-11-03');
    expect(loggedDays(store)).toBe(WIDGET_INTRO_AFTER_DAYS);
    const ready = { ...state, days: loggedDays(store) };
    expect(shouldShowWidgetIntro(ready)).toBe(true);
    expect(shouldShowWidgetIntro({ ...ready, seen: true })).toBe(false);
    expect(shouldShowWidgetIntro({ ...ready, placed: true })).toBe(false);
    expect(shouldShowWidgetIntro({ ...ready, os: 'ios' })).toBe(false);
  });
});
