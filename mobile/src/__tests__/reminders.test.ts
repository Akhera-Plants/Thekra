/**
 * Notification scheduler (pure): practice-core plans + prefs → the list of {date, time, title, body}
 * the app hands to expo-notifications. Also the privacy rules: sin-program reminders always carry the
 * generic title «تذكرة من ذكرى» and never the sin; kinship names only when the user opts in.
 */

import {
  addDays,
  checkIn,
  createPlan,
  createRelative,
  emptyStore,
  logDone,
  startEbb,
  startProgram,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import type { CatalogHabit } from '../lib/practice/catalog-types';
import { DEFAULT_PREFS, type PracticePrefs } from '../lib/practice/prefs';
import {
  MAX_PENDING,
  REMINDER_DAYS,
  SIN_REMINDER_TITLE,
  planDueOn,
  planReminders,
  type ReminderInput,
  type ReminderTexts,
} from '../lib/practice/reminders';

const TODAY = '2026-10-28'; // a Wednesday

const texts: ReminderTexts = {
  habitBody: (amount) => `المطلوب اليوم: ${amount}`,
  kinshipTitle: 'صلة الرحم',
  kinshipBodyGeneric: (n) => `حان وقت التواصل مع ${n} من أقاربك`,
  kinshipBodyNames: (names) => `حان وقت التواصل مع: ${names}`,
  sinBody: 'لحظة لنفسك. افتح ذكرى.',
  unitFallback: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' },
  listSeparator: '، ',
  wirdTitle: 'ورد اليوم',
  eveningBody: 'بقي من يومك قليل، ودقيقة واحدة تحفظ مداومتك',
  fridayTitle: 'المحاسبة',
  fridayBody: 'دقيقتان مع نفسك',
  digestBody: (n) => `عندك ${n} أعمال اليوم`,
};

const quran: CatalogHabit = {
  key: 'quran-wird',
  titleAr: 'ورد القرآن',
  titleEn: 'Daily Quran reading',
  deed: 'quran',
  unit: 'minutes',
  unitLabelAr: 'دقيقة',
  unitLabelEn: 'minutes',
  start: { far: 2, near: 10 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['06:00', '21:00'],
  basis: 'organizational',
  evidence: [],
};

const duha: CatalogHabit = {
  ...quran,
  key: 'duha',
  titleAr: 'صلاة الضحى',
  titleEn: 'Duha prayer',
  unit: 'times',
  unitLabelAr: 'ركعتان',
  unitLabelEn: "two rak'ahs",
  defaultRule: { kind: 'weekdays', days: [1, 4] }, // Monday, Thursday
  defaultSlots: ['09:30'],
};

function plan(habit: CatalogHabit, amount: number, slots: string[]): Plan {
  return createPlan({
    id: habit.key,
    deedSlug: habit.deed,
    title: habit.titleAr,
    unit: habit.unit,
    amount,
    activeDaysPerWeek: 3,
    slots,
    createdOn: '2026-10-01',
  });
}

function input(store: Store, prefs: Partial<PracticePrefs> = {}, extra: Partial<ReminderInput> = {}): ReminderInput {
  return {
    store,
    // The Friday review reminder is on by default; most cases here look at one track at a time.
    prefs: { ...DEFAULT_PREFS, habitReminders: true, fridayReminder: false, ...prefs },
    habits: [quran, duha],
    today: TODAY,
    now: '08:00',
    locale: 'ar',
    texts,
    ...extra,
  };
}

const simple = (list: ReturnType<typeof planReminders>) => list.map(({ date, time, title, body }) => ({ date, time, title, body }));

describe('planReminders — pause, «راسخة», sick', () => {
  it('a paused plan reminds of nothing; an established one only in its first slot; resumed days remind again', () => {
    const base = plan(quran, 2, ['21:00', '06:00']);
    expect(planReminders(input({ ...emptyStore(), plans: [{ ...base, pausedOn: '2026-10-20' }] }))).toEqual([]);
    const established = planReminders(input({ ...emptyStore(), plans: [{ ...base, establishedOn: '2026-10-20' }] }));
    expect(new Set(established.map((r) => r.time))).toEqual(new Set(['06:00']));
    const resumed = planReminders(input({ ...emptyStore(), plans: [{ ...base, pausedOn: '2026-10-20', resumedOn: '2026-10-30' }] }));
    expect(resumed[0]?.date).toBe('2026-10-30');
  });

  it('a sick person reminds every two days until visited', () => {
    const sick = createRelative({ id: 's', name: 'أبو محمد', relation: '', circle: 'sick', rule: { kind: 'everyNDays', n: 2, anchor: TODAY } });
    const list = planReminders(input({ ...emptyStore(), relatives: [sick] }, { kinshipReminders: true }, { days: 6 }));
    expect(list.map((r) => r.date)).toEqual(['2026-10-28', '2026-10-30', '2026-11-01']);
    const visited = { ...sick, history: [TODAY], lastContactedOn: TODAY };
    expect(planReminders(input({ ...emptyStore(), relatives: [visited] }, { kinshipReminders: true }, { days: 6 }))).toEqual([]);
  });
});

describe('planReminders — habits', () => {
  it('schedules every slot of every rule day for the next 14 days, skipping slots already past today', () => {
    const store = { ...emptyStore(), plans: [plan(quran, 2, ['21:00', '06:00'])] };
    const list = planReminders(input(store));
    // Today: 06:00 has passed (now 08:00), 21:00 remains; then 13 days × 2 slots.
    expect(list).toHaveLength(1 + 13 * 2);
    expect(simple(list).slice(0, 3)).toEqual([
      { date: '2026-10-28', time: '21:00', title: 'ورد القرآن', body: 'المطلوب اليوم: دقيقتان' },
      { date: '2026-10-29', time: '06:00', title: 'ورد القرآن', body: 'المطلوب اليوم: دقيقتان' },
      { date: '2026-10-29', time: '21:00', title: 'ورد القرآن', body: 'المطلوب اليوم: دقيقتان' },
    ]);
    expect(list[list.length - 1]).toMatchObject({ date: '2026-11-10', time: '21:00' });
    // Sorted ascending.
    const keys = list.map((r) => r.date + r.time);
    expect([...keys].sort()).toEqual(keys);
  });

  it('follows the plan rule (practice-core occurrences): Mondays and Thursdays only', () => {
    const store = { ...emptyStore(), plans: [plan(duha, 1, ['09:30'])] };
    const list = planReminders(input(store));
    expect(list.map((r) => r.date)).toEqual(['2026-10-29', '2026-11-02', '2026-11-05', '2026-11-09']);
    expect(list[0]).toMatchObject({ title: 'صلاة الضحى', body: 'المطلوب اليوم: ركعتان', time: '09:30' });
  });

  it('the plan rule (synced, plan.rule) wins over the catalog default; a UUID plan finds its habit by habitKey', () => {
    const p = { ...plan(duha, 1, ['09:30']), id: '7b0c1d9e-3f43-4a7e-9c55-0d6f1b2a3c4d', habitKey: 'duha', rule: { kind: 'weekdays' as const, days: [5] } };
    const store = { ...emptyStore(), plans: [p] };
    const list = planReminders(input(store));
    expect(list[0]?.title).toBe('صلاة الضحى');
    expect(list.map((r) => r.date)).toEqual(['2026-10-30', '2026-11-06']);
  });

  it('drops the rest of today once the day is done (partial amounts add up)', () => {
    let p = plan(quran, 5, ['12:00', '21:00']);
    p = logDone(p, TODAY, 2);
    let list = planReminders(input({ ...emptyStore(), plans: [p] }));
    expect(list.filter((r) => r.date === TODAY)).toHaveLength(2);
    p = logDone(p, TODAY, 3);
    list = planReminders(input({ ...emptyStore(), plans: [p] }));
    expect(list.filter((r) => r.date === TODAY)).toHaveLength(0);
  });

  it('asks for the ebb amount on a heavy day and never doubles a missed day', () => {
    const missedYesterday = plan(quran, 10, ['21:00']); // nothing logged yesterday
    expect(planReminders(input({ ...emptyStore(), plans: [missedYesterday] }))[0]?.body).toBe('المطلوب اليوم: 10 دقائق');
    const ebb = startEbb(missedYesterday, TODAY);
    expect(planReminders(input({ ...emptyStore(), plans: [ebb] }))[0]?.body).toBe('المطلوب اليوم: دقيقتان');
  });

  it('uses English titles and units in the English UI', () => {
    const store = { ...emptyStore(), plans: [plan(quran, 2, ['21:00'])] };
    const list = planReminders(input(store, {}, { locale: 'en', texts: { ...texts, habitBody: (a) => `Today: ${a}` } }));
    expect(list[0]).toMatchObject({ title: 'Daily Quran reading', body: 'Today: 2 minutes' });
  });

  it('nothing for habits when habit reminders are off; at most 4 a day (then one digest); capped at MAX_PENDING', () => {
    const store = { ...emptyStore(), plans: [plan(quran, 2, ['05:00', '09:00', '13:00', '17:00', '21:00'])] };
    expect(planReminders(input(store, { habitReminders: false }))).toEqual([]);
    const day = planReminders(input(store, {}, { now: '04:00', days: 1 }));
    expect(day.map((r) => [r.kind, r.time])).toEqual([
      ['habit', '05:00'],
      ['habit', '09:00'],
      ['habit', '13:00'],
      ['digest', '17:00'],
    ]);
    expect(day[3]).toMatchObject({ title: 'ورد اليوم', body: 'عندك 1 أعمال اليوم', route: '/habits' });
    expect(planReminders(input(store, {}, { limit: 10 }))).toHaveLength(10);
    expect(MAX_PENDING).toBe(60);
  });

  it('quiet hours: a suggested slot inside 23:00–05:00 does not ring; the user’s own time does', () => {
    const late = { ...plan(quran, 2, ['23:30']) };
    expect(planReminders(input({ ...emptyStore(), plans: [late] }, {}, { days: 2 })).map((r) => r.time)).toEqual(['23:30', '23:30']);
    const suggested = { ...plan({ ...quran, defaultSlots: ['23:30'] }, 2, ['23:30']) };
    expect(planReminders(input({ ...emptyStore(), plans: [suggested] }, {}, { days: 2, habits: [{ ...quran, defaultSlots: ['23:30'] }] }))).toEqual([]);
  });

  it('evening nudge (opt-in) and the Friday review reminder (on by default, not once saved)', () => {
    const store = { ...emptyStore(), plans: [plan(quran, 2, ['06:00'])] };
    const evening = planReminders(input(store, { habitReminders: false, eveningNudge: true }, { days: 1 }));
    expect(evening).toEqual([expect.objectContaining({ kind: 'evening', time: '21:00', body: texts.eveningBody })]);
    const friday = planReminders(input(store, { habitReminders: false, fridayReminder: true }, { days: 7 }));
    expect(friday.map((r) => [r.kind, r.date, r.time])).toEqual([['friday', '2026-10-30', '17:00']]);
    expect(planReminders(input(store, { habitReminders: false, fridayReminder: true }, { days: 7, reviewDoneOn: () => true }))).toEqual([]);
  });
});

describe('planReminders — agrees with the today list (practice-core isPlanDueOn)', () => {
  it('a habit has reminders on exactly the days it is due', () => {
    const plans: Plan[] = [
      plan(quran, 2, ['21:00']), // catalog daily
      plan(duha, 1, ['21:00']), // catalog Mon/Thu
      { ...plan(duha, 1, ['21:00']), id: 'own-rule', rule: { kind: 'weekdays', days: [0, 3] } }, // own rule
      { ...plan(quran, 2, ['21:00']), id: 'no-catalog' }, // no rule, unknown habit: daily
    ];
    const store = { ...emptyStore(), plans };
    const list = planReminders(input(store, {}, { limit: 1000 }));
    for (const p of plans) {
      const reminded = new Set(list.filter((r) => r.route === `/practice/plan/${p.id}`).map((r) => r.date));
      for (let i = 0; i < REMINDER_DAYS; i++) {
        const date = addDays(TODAY, i);
        expect([p.id, date, reminded.has(date)]).toEqual([p.id, date, planDueOn(p, [quran, duha], date, 0)]);
      }
    }
  });

  it('yesterday’s heavy day does not lighten today’s reminder', () => {
    const p = startEbb(plan(quran, 10, ['21:00']), addDays(TODAY, -1));
    expect(planReminders(input({ ...emptyStore(), plans: [p] }))[0]?.body).toBe('المطلوب اليوم: 10 دقائق');
  });
});

describe('planReminders — privacy', () => {
  function storeWithProgram(): Store {
    let program = startProgram({ sinSlug: 'nazar-shashat', category: 'haqq_allah', hardToLeaveAtOnce: true, startedOn: '2026-10-20' });
    program = checkIn(program, '2026-10-27', 'weak', 'ملاحظة خاصة جدا');
    return { ...emptyStore(), programs: [program] };
  }

  it('sin-program reminders always use the generic title, in every language, and never the sin', () => {
    for (const locale of ['ar', 'en'] as const) {
      const list = planReminders(input(storeWithProgram(), { sinReminders: true, sinReminderTime: '21:00' }, { locale }));
      expect(list).toHaveLength(REMINDER_DAYS);
      for (const r of list) {
        expect(r.kind).toBe('sin');
        expect(r.title).toBe(SIN_REMINDER_TITLE);
        expect(r.title).toBe('تذكرة من ذكرى');
        expect(r.body).toBe(texts.sinBody);
        const all = JSON.stringify(r);
        expect(all).not.toContain('nazar');
        expect(all).not.toContain('shashat');
        expect(all).not.toContain('ملاحظة');
      }
    }
  });

  it('no sin reminders unless enabled, and none today after today’s check-in', () => {
    expect(planReminders(input(storeWithProgram(), { sinReminders: false }))).toEqual([]);
    const s = storeWithProgram();
    s.programs[0] = checkIn(s.programs[0]!, TODAY, 'held');
    const list = planReminders(input(s, { sinReminders: true, sinReminderTime: '21:00' }));
    expect(list.some((r) => r.date === TODAY)).toBe(false);
    expect(list).toHaveLength(REMINDER_DAYS - 1);
  });

  it('kinship reminders are generic unless names are turned on', () => {
    const aunt = createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNDays', n: 30, anchor: TODAY } });
    const store = { ...emptyStore(), relatives: [aunt] };
    const generic = planReminders(input(store, { kinshipReminders: true, kinshipTime: '18:00' }));
    expect(generic[0]).toMatchObject({ date: TODAY, time: '18:00', title: 'صلة الرحم', body: 'حان وقت التواصل مع 1 من أقاربك' });
    expect(JSON.stringify(generic)).not.toContain('خالتي');
    const named = planReminders(input(store, { kinshipReminders: true, kinshipShowNames: true, kinshipTime: '18:00' }));
    expect(named[0]?.title).toBe('صلة الرحم');
    expect(named[0]?.body).toBe('حان وقت التواصل مع: خالتي');
  });
});

describe('the policy words match practice-core (one wording on every client)', () => {
  it('app strings equal NOTIFY_TEXTS', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NOTIFY_TEXTS } = require('@thekra/practice-core') as typeof import('@thekra/practice-core');
    for (const lang of ['ar', 'en'] as const) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notify = (require(`../lib/i18n/${lang}.json`) as { practice: { notify: Record<string, string> } }).practice.notify;
      expect(notify.wirdTitle).toBe(NOTIFY_TEXTS[lang].wirdTitle);
      expect(notify.eveningBody).toBe(NOTIFY_TEXTS[lang].eveningBody);
      expect(notify.fridayTitle).toBe(NOTIFY_TEXTS[lang].fridayTitle);
      expect(notify.fridayBody).toBe(NOTIFY_TEXTS[lang].fridayBody);
      expect(notify.digestBody_other!.replace('{{count}}', '12')).toBe(NOTIFY_TEXTS[lang].digestBody(12));
    }
  });
});
