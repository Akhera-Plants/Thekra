import { DEFAULT_NOTIFICATION_PREFS, emptyStore, type Plan, type Relative, type Store } from '@thekra/practice-core';
import { practiceCatalog, type Occasion } from '../practice/practice-catalog.js';
import { MAX_PUSH_PER_WINDOW, planPushes, sitePath, type PushPlanInput } from './push-planner.js';

const habits = practiceCatalog().habits;
// 2026-10-28 18:00 UTC = 21:00 in Amman (UTC+3).
const NOW = new Date('2026-10-28T18:00:00Z');
const ZONE = 'Asia/Amman';

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-duha',
    habitKey: 'duha',
    deedSlug: 'nawafil',
    title: 'my own title',
    unit: 'times',
    amount: 1,
    activeDaysPerWeek: 7,
    slots: ['11:00', '09:30'],
    createdOn: '2026-10-01',
    amountChangedOn: '2026-10-01',
    log: {},
    rule: { kind: 'daily' },
    ...overrides,
  };
}

function store(plans: Plan[] = [], relatives: Relative[] = []): Store {
  return { ...emptyStore(), plans, relatives };
}

// The Friday review reminder is on by default; most cases here look at habits and people only.
const QUIET_PREFS = { ...DEFAULT_NOTIFICATION_PREFS, fridayReview: false };
const run = (s: Store, extra: Partial<PushPlanInput> = {}) =>
  planPushes({ store: s, habits, timeZone: ZONE, locale: 'ar', now: NOW, prefs: QUIET_PREFS, ...extra });

describe('planPushes', () => {
  it('a paused plan reminds of nothing; an established one reminds in its first slot only', () => {
    expect(run(store([plan({ pausedOn: '2026-10-28' })]))).toEqual([]);
    // Resumed on the 30th: the 29th is still inside the pause.
    expect(run(store([plan({ pausedOn: '2026-10-20', resumedOn: '2026-10-30' })])).map((p) => p.key)).toEqual([
      'habit:plan-duha:2026-10-30:09:30',
      'habit:plan-duha:2026-10-30:11:00',
    ]);
    expect(run(store([plan({ establishedOn: '2026-10-20' })])).map((p) => p.key)).toEqual([
      'habit:plan-duha:2026-10-29:09:30',
      'habit:plan-duha:2026-10-30:09:30',
    ]);
  });

  it('a sick person reminds every two days until visited; other lists use the generic wording', () => {
    const sick: Relative = {
      id: 'r-sick',
      name: 'أبو محمد',
      relation: '',
      circle: 'sick',
      rule: { kind: 'everyNDays', n: 2, anchor: '2026-10-28' },
      history: [],
    };
    const out = run(store([], [sick]), { windowHours: 96 });
    expect(out.map((p) => p.key)).toEqual(['kinship:2026-10-29', 'kinship:2026-10-31']);
    expect(out[0]).toMatchObject({ title: 'أعمال دورية', body: 'حان وقت التواصل مع 1 من قوائمك' });
    expect(run(store([], [{ ...sick, history: ['2026-10-28'], lastContactedOn: '2026-10-28' }]), { windowHours: 96 })).toEqual([]);
  });

  it('reminds at every slot of the next 48 hours, in the browser zone, soonest first', () => {
    const out = run(store([plan()]));
    expect(out.map((p) => [p.key, p.fireAt.toISOString()])).toEqual([
      ['habit:plan-duha:2026-10-29:09:30', '2026-10-29T06:30:00.000Z'],
      ['habit:plan-duha:2026-10-29:11:00', '2026-10-29T08:00:00.000Z'],
      ['habit:plan-duha:2026-10-30:09:30', '2026-10-30T06:30:00.000Z'],
      ['habit:plan-duha:2026-10-30:11:00', '2026-10-30T08:00:00.000Z'],
    ]);
    expect(out[0]).toMatchObject({ title: 'صلاة الضحى', body: 'المطلوب اليوم: ركعتان', url: '/practice', tag: 'habit-plan-duha' });
  });

  it('skips the rest of today once the day is logged, and slots already past', () => {
    const morning = new Date('2026-10-28T05:00:00Z'); // 08:00 in Amman
    const open = run(store([plan()]), { now: morning, windowHours: 12 });
    expect(open.map((p) => p.key)).toEqual(['habit:plan-duha:2026-10-28:09:30', 'habit:plan-duha:2026-10-28:11:00']);
    const done = run(store([plan({ log: { '2026-10-28': 1 } })]), { now: morning, windowHours: 12 });
    expect(done).toEqual([]);
    const late = run(store([plan()]), { now: new Date('2026-10-28T07:00:00Z'), windowHours: 12 }); // 10:00
    expect(late.map((p) => p.key)).toEqual(['habit:plan-duha:2026-10-28:11:00']);
  });

  it('follows the rule, English texts and the plan title when the habit is not in the catalog', () => {
    // 2026-10-29 is a Thursday (weekday 4); the window ends on Friday 30th at 21:00.
    const own = plan({ id: 'p2', habitKey: undefined, title: 'Walk', unit: 'minutes', amount: 10, slots: ['07:00'], rule: { kind: 'weekdays', days: [5] } });
    const out = run(store([own]), { locale: 'en' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'habit:p2:2026-10-30:07:00', title: 'Walk', body: 'Today: 10 minutes', url: '/en/practice' });
  });

  it('reminds of relatives at 18:00 with a count and never a name', () => {
    const rel: Relative = {
      id: 'r1',
      name: 'خالتي سعاد',
      relation: 'خالة',
      rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' },
      history: [],
    };
    const out = run(store([], [rel, { ...rel, id: 'r2', name: 'عمي' }]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'kinship:2026-10-29', title: 'صلة الرحم', body: 'حان وقت التواصل مع 2 من أقاربك', url: '/practice/people' });
    expect(out[0]!.fireAt.toISOString()).toBe('2026-10-29T15:00:00.000Z');
    expect(JSON.stringify(out)).not.toMatch(/سعاد|عمي/);
  });

  it('follows the shared policy: at most 4 a day with a digest, quiet hours, evening nudge and Friday review', () => {
    const three = ['a', 'b', 'c'].map((id) => plan({ id }));
    const out = run(store(three));
    expect(out.map((p) => p.key)).toEqual([
      'habit:a:2026-10-29:09:30',
      'habit:b:2026-10-29:09:30',
      'habit:c:2026-10-29:09:30',
      'digest:2026-10-29',
      'habit:a:2026-10-30:09:30',
      'habit:b:2026-10-30:09:30',
      'habit:c:2026-10-30:09:30',
      'digest:2026-10-30',
    ]);
    expect(out[3]).toMatchObject({ title: 'ورد اليوم', body: 'عندك 3 أعمال اليوم', url: '/practice', tag: 'digest' });

    // Witr's suggested 23:00 is in the quiet hours; 22:00 stays.
    const witr = plan({ id: 'w', habitKey: 'witr', slots: ['22:00', '23:00'] });
    expect(run(store([witr]), { windowHours: 24 }).map((p) => p.key)).toEqual(['habit:w:2026-10-28:22:00']);

    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, habits: false, eveningNudge: true };
    const nudges = run(store([plan()]), { prefs, locale: 'en' });
    expect(nudges.map((p) => [p.key, p.fireAt.toISOString(), p.body])).toEqual([
      ['evening:2026-10-29', '2026-10-29T18:00:00.000Z', 'Little is left of your day; one minute keeps your streak'],
      ['friday:2026-10-30', '2026-10-30T14:00:00.000Z', 'Two minutes with yourself: what you kept this week, and one step for the next'],
      ['evening:2026-10-30', '2026-10-30T18:00:00.000Z', 'Little is left of your day; one minute keeps your streak'],
    ]);
    expect(JSON.stringify(nudges)).not.toMatch(/my own title/);
  });

  it('plans no strategy reminder any more (round 5, F-12 a), even from stored prefs that hold strategies', () => {
    const prefs = { ...QUIET_PREFS, habits: false, strategies: ['start-tiny'], strategyTime: '10:00' };
    expect(run(store([]), { prefs, windowHours: 96 })).toEqual([]);
  });

  it('«مناسبة قريبة»: opt-in, the day before a non-weekly occasion, at its time, linking to the deed page', () => {
    const arafahLike: Occasion = {
      key: 'test-day',
      titleAr: 'يوم عرفة',
      titleEn: 'The Day of Arafah',
      deed: 'siyam',
      rule: { kind: 'monthlyDay', day: 28 },
      basis: 'text',
      evidence: [],
    };
    const occasions = [...practiceCatalog().occasions, arafahLike];
    const prefs = { ...QUIET_PREFS, habits: false, occasions: true, occasionTime: '20:00' };
    const now = new Date('2026-10-26T18:00:00Z');
    // 27 Oct 20:00 in Amman (UTC+3) = 17:00 UTC; Mondays/Thursdays and Friday never appear.
    expect(run(store([]), { prefs, occasions, now }).map((p) => [p.key, p.fireAt.toISOString(), p.title, p.body, p.url])).toEqual([
      ['occasion:2026-10-27', '2026-10-27T17:00:00.000Z', 'مناسبة قريبة', 'غدًا: يوم عرفة', '/good-deeds/siyam'],
    ]);
    expect(run(store([]), { prefs: { ...prefs, occasions: false }, occasions, now })).toEqual([]);
    expect(run(store([]), { prefs, occasions, now, locale: 'en' })[0]?.body).toBe('Tomorrow: The Day of Arafah');
  });

  it('caps the list and gives a digest that changes only with what the user sees', () => {
    const many = Array.from({ length: 30 }, (_, i) => plan({ id: `p${i}` }));
    expect(run(store(many), { limit: 5 })).toHaveLength(5);
    expect(MAX_PUSH_PER_WINDOW).toBe(40);
    const a = run(store([plan()]))[0]!;
    expect(run(store([plan()]))[0]!.digest).toBe(a.digest);
    expect(run(store([plan({ amount: 2 })]))[0]!.digest).not.toBe(a.digest);
  });
});

describe('planPushes with prayer anchors', () => {
  it('uses the anchor times the browser sent, and the default times on days without them', () => {
    const anchored = plan({ slots: ['05:20', '11:00'], slotAnchors: ['after-fajr', null] });
    const anchorTimes = {
      '2026-10-29': {
        'after-fajr': '05:07',
        'after-dhuhr': '11:55',
        'after-asr': '15:05',
        'after-maghrib': '17:35',
        'after-isha': '19:05',
        'before-sleep': '21:30',
      },
    };
    expect(run(store([anchored]), { anchorTimes }).map((p) => p.key)).toEqual([
      'habit:plan-duha:2026-10-29:05:07',
      'habit:plan-duha:2026-10-29:11:00',
      'habit:plan-duha:2026-10-30:05:20',
      'habit:plan-duha:2026-10-30:11:00',
    ]);
  });
});

describe('sitePath', () => {
  it('Arabic has no prefix (the site default), English is under /en', () => {
    expect(sitePath('ar', '/practice')).toBe('/practice');
    expect(sitePath('en', '/practice/kinship')).toBe('/en/practice/kinship');
  });
});
