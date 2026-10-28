import { emptyStore, type Plan, type Relative, type Store } from '@thekra/practice-core';
import { practiceCatalog } from '../practice/practice-catalog.js';
import { MAX_PUSH_PER_WINDOW, planPushes, type PushPlanInput } from './push-planner.js';

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

const run = (s: Store, extra: Partial<PushPlanInput> = {}) =>
  planPushes({ store: s, habits, timeZone: ZONE, locale: 'ar', now: NOW, ...extra });

describe('planPushes', () => {
  it('reminds at every slot of the next 48 hours, in the browser zone, soonest first', () => {
    const out = run(store([plan()]));
    expect(out.map((p) => [p.key, p.fireAt.toISOString()])).toEqual([
      ['habit:plan-duha:2026-10-29:09:30', '2026-10-29T06:30:00.000Z'],
      ['habit:plan-duha:2026-10-29:11:00', '2026-10-29T08:00:00.000Z'],
      ['habit:plan-duha:2026-10-30:09:30', '2026-10-30T06:30:00.000Z'],
      ['habit:plan-duha:2026-10-30:11:00', '2026-10-30T08:00:00.000Z'],
    ]);
    expect(out[0]).toMatchObject({ title: 'صلاة الضحى', body: 'المطلوب اليوم: ركعتان', url: '/ar/practice', tag: 'habit-plan-duha' });
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
    expect(out[0]).toMatchObject({ key: 'kinship:2026-10-29', title: 'صلة الرحم', body: 'حان وقت التواصل مع 2 من أقاربك', url: '/ar/practice/kinship' });
    expect(out[0]!.fireAt.toISOString()).toBe('2026-10-29T15:00:00.000Z');
    expect(JSON.stringify(out)).not.toMatch(/سعاد|عمي/);
  });

  it('caps the list and gives a digest that changes only with what the user sees', () => {
    const many = Array.from({ length: 30 }, (_, i) => plan({ id: `p${i}` }));
    expect(run(store(many))).toHaveLength(MAX_PUSH_PER_WINDOW);
    const a = run(store([plan()]))[0]!;
    expect(run(store([plan()]))[0]!.digest).toBe(a.digest);
    expect(run(store([plan({ amount: 2 })]))[0]!.digest).not.toBe(a.digest);
  });
});
