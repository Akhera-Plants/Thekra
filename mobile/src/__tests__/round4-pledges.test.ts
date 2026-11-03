/**
 * Owner round 4: «التزام شخصي» per habit (each habit its own make-up deed, added, replaced and removed one habit at a
 * time) and the reminders' wiring for the reviews (the evening review's time, the weekly review's day from the heart).
 */

import { createPlan, emptyHeart, emptyStore, PLEDGE_DEED_INFO, setHeartPrefs, type Plan, type Store } from '@thekra/practice-core';
import { draftReady, pledgeDeedWords, pledgeOfPlan, removePlanPledge, savePlanPledge } from '../lib/practice/pledges';
import { DEFAULT_PREFS, parsePrefs, type PracticePrefs } from '../lib/practice/prefs';
import { notificationPrefsOf, planReminders, type ReminderInput, type ReminderTexts } from '../lib/practice/reminders';

const TODAY = '2026-10-28'; // a Wednesday
let n = 0;
const newId = () => `p${++n}`;
const words = { sadaqah: (text: string) => `أتصدق بـ${text}`, sadaqahPlain: 'أتصدق بصدقة' };

describe('«التزام شخصي»: one deed per habit', () => {
  it('each habit keeps its own deed; saving again replaces only that habit’s', () => {
    let heart = savePlanPledge(emptyHeart(), 'salah', { action: 'birr', text: '' }, TODAY, newId);
    heart = savePlanPledge(heart, 'quran', { action: 'sadaqah', text: ' 20 ريالًا ' }, TODAY, newId);
    expect(heart.pledges).toHaveLength(2);
    expect(pledgeOfPlan(heart, 'salah')?.action).toBe('birr');
    expect(pledgeOfPlan(heart, 'quran')).toMatchObject({ action: 'sadaqah', text: '20 ريالًا' });

    const id = pledgeOfPlan(heart, 'salah')?.id;
    heart = savePlanPledge(heart, 'salah', { action: 'qiyam', text: 'leftover' }, '2026-10-29', newId);
    expect(heart.pledges).toHaveLength(2);
    expect(pledgeOfPlan(heart, 'salah')).toMatchObject({ id, action: 'qiyam', createdOn: '2026-10-29' });
    expect(pledgeOfPlan(heart, 'salah')?.text).toBeUndefined(); // a deed keeps no text
    expect(pledgeOfPlan(heart, 'quran')?.action).toBe('sadaqah');
  });

  it('saving the same pledge again changes nothing (its kept days stay)', () => {
    const heart = savePlanPledge(emptyHeart(), 'salah', { action: 'tasbih', text: '' }, TODAY, newId);
    const kept = { ...heart, pledges: heart.pledges.map((p) => ({ ...p, kept: ['2026-10-27'] })) };
    expect(savePlanPledge(kept, 'salah', { action: 'tasbih', text: '' }, '2026-10-30', newId)).toBe(kept);
  });

  it('removing one habit’s pledge leaves the others', () => {
    let heart = savePlanPledge(emptyHeart(), 'a', { action: 'sawm', text: '' }, TODAY, newId);
    heart = savePlanPledge(heart, 'b', { action: 'custom', text: 'أزور جدتي' }, TODAY, newId);
    heart = removePlanPledge(heart, 'a');
    expect(heart.pledges.map((p) => p.planId)).toEqual(['b']);
    expect(removePlanPledge(heart, 'none')).toBe(heart);
  });

  it('a custom pledge needs its words; no choice cannot be saved', () => {
    expect(draftReady(null)).toBe(false);
    expect(draftReady({ action: 'custom', text: '  ' })).toBe(false);
    expect(draftReady({ action: 'custom', text: 'أقرأ سورة الملك' })).toBe(true);
    expect(draftReady({ action: 'sadaqah', text: '' })).toBe(true);
    expect(draftReady({ action: 'birr', text: '' })).toBe(true);
  });

  it('names a deed by practice-core’s titles in the UI locale', () => {
    const birr = PLEDGE_DEED_INFO.find((d) => d.key === 'birr')!;
    expect(pledgeDeedWords({ action: 'birr' }, 'ar', words)).toBe(birr.titleAr);
    expect(pledgeDeedWords({ action: 'birr' }, 'en', words)).toBe(birr.titleEn);
    expect(pledgeDeedWords({ action: 'rakatain' }, 'ar', words)).toBe(PLEDGE_DEED_INFO.find((d) => d.key === 'rakatain')!.titleAr);
    expect(pledgeDeedWords({ action: 'sadaqah', text: '10' }, 'ar', words)).toBe('أتصدق بـ10');
    expect(pledgeDeedWords({ action: 'sadaqah' }, 'ar', words)).toBe('أتصدق بصدقة');
    expect(pledgeDeedWords({ action: 'custom', text: 'سطري' }, 'en', words)).toBe('سطري');
  });
});

const texts: ReminderTexts = {
  habitBody: (amount) => amount,
  kinshipTitle: 'k',
  kinshipBodyGeneric: (count) => String(count),
  kinshipBodyNames: (names) => names,
  sinBody: 's',
  unitFallback: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' },
  listSeparator: '، ',
  wirdTitle: 'w',
  eveningBody: 'e',
  fridayTitle: 'f',
  fridayBody: 'fb',
  digestBody: (count) => String(count),
};

function store(): Store {
  const plan: Plan = createPlan({
    id: 'p',
    deedSlug: 'quran',
    title: 'ورد',
    unit: 'minutes',
    amount: 2,
    activeDaysPerWeek: 7,
    slots: ['06:00'],
    createdOn: '2026-10-01',
  });
  return { ...emptyStore(), plans: [plan] };
}

function input(prefs: Partial<PracticePrefs>, extra: Partial<ReminderInput> = {}): ReminderInput {
  return {
    store: store(),
    prefs: { ...DEFAULT_PREFS, habitReminders: false, fridayReminder: false, ...prefs },
    habits: [],
    today: TODAY,
    now: '08:00',
    locale: 'ar',
    texts,
    days: 7,
    ...extra,
  };
}

describe('reminders: the reviews’ day and time', () => {
  it('the weekly review rings on the heart’s review day (Friday by default)', () => {
    const friday = planReminders(input({ fridayReminder: true }));
    expect(friday.map((r) => [r.kind, r.date])).toEqual([['friday', '2026-10-30']]);
    const heart = setHeartPrefs(emptyHeart(), { reviewDay: 0 }); // Sunday
    const sunday = planReminders(input({ fridayReminder: true, fridayTime: '20:15' }, { reviewDay: heart.prefs.reviewDay }));
    expect(sunday.map((r) => [r.kind, r.date, r.time])).toEqual([['friday', '2026-11-01', '20:15']]);
    expect(notificationPrefsOf(DEFAULT_PREFS).reviewDay).toBe(5);
    expect(notificationPrefsOf(DEFAULT_PREFS, 3).reviewDay).toBe(3);
  });

  it('the evening review reminder rings at the time chosen for it', () => {
    const list = planReminders(input({ eveningNudge: true, eveningTime: '20:30' }, { days: 1 }));
    expect(list).toEqual([expect.objectContaining({ kind: 'evening', time: '20:30' })]);
  });

  it('the weekly strategy reminder follows its switch, keeping the chosen strategies', () => {
    expect(DEFAULT_PREFS.strategyReminders).toBe(true);
    const prefs = { ...DEFAULT_PREFS, strategies: ['a', 'b'] };
    expect(notificationPrefsOf(prefs).strategies).toEqual(['a', 'b']);
    expect(notificationPrefsOf({ ...prefs, strategyReminders: false }).strategies).toEqual([]);
    expect(parsePrefs(JSON.stringify({ ...prefs, strategyReminders: false })).strategyReminders).toBe(false);
  });
});
