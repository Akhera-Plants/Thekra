import { describe, expect, it } from 'vitest';
import {
  branchesInPractice,
  branchOfWeek,
  cleanStrategyKeys,
  createPlan,
  dayCompletion,
  DEFAULT_NOTIFICATION_PREFS,
  defaultHabitKey,
  emptyStore,
  gratitudeAyah,
  habitTally,
  heldDaysTotal,
  isoWeek,
  nameOfWeekIndex,
  weekCardKind,
  notificationPlan,
  NOTIFY_TEXTS,
  parseNotificationPrefs,
  rewardQuoteId,
  startProgram,
  checkIn,
  storyQuoteId,
  STRATEGIES,
  strategyOfWeek,
  tallies,
  toggleStrategy,
  upsertPlan,
  type Plan,
  type Store,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'dhikr', title: id, unit: 'count', amount: 10, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-09-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

describe('حصيلتي', () => {
  it('sums this month and since the start, ignoring cleared and future days', () => {
    const p = plan('a', { log: { '2026-09-30': 10, '2026-10-01': 5, '2026-10-02': 0, '2026-10-28': 3, '2026-10-29': 99 } });
    expect(habitTally(p, '2026-10-28')).toEqual({ planId: 'a', month: 8, total: 18 });
    expect(tallies({ ...emptyStore(), plans: [p, plan('b')] }, '2026-10-28').map((t) => t.planId)).toEqual(['a']);
  });

  it('counts held days of a program since the start, never reset by a fall', () => {
    let program = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, NOW);
    program = checkIn(program, '2026-10-02', 'held', undefined, NOW);
    program = checkIn(program, '2026-10-03', 'fell_repented', undefined, NOW);
    program = checkIn(program, '2026-10-04', 'held', undefined, NOW);
    expect(heldDaysTotal(program, '2026-10-28')).toBe(2);
  });

  it('lists the branches of the deeds of active habits, once each; paused habits do not count', () => {
    const map = { dhikr: [1, 7], quran: [7, 14] };
    expect(branchesInPractice([plan('a'), plan('b', { deedSlug: 'quran' })], map)).toEqual([1, 7, 14]);
    expect(branchesInPractice([plan('a', { pausedOn: '2026-10-01' })], map)).toEqual([]);
    expect(branchesInPractice([plan('a', { deedSlug: 'none' })], map)).toEqual([]);
  });

  it('rotates the gratitude ayah by day between 16:53 and 49:17', () => {
    const a = gratitudeAyah('2026-10-28');
    const b = gratitudeAyah('2026-10-29');
    expect([a, b].map((x) => `${x.surah}:${x.ayah}`).sort()).toEqual(['16:53', '49:17']);
  });
});

describe('تمّ وردك اليوم', () => {
  it('is complete only when every habit asked has something logged', () => {
    const store = storeOf(plan('a', { log: { '2026-10-28': 10 } }), plan('b'));
    expect(dayCompletion(store, '2026-10-28').complete).toBe(false);
    expect(dayCompletion(storeOf(plan('a', { log: { '2026-10-28': 1 } })), '2026-10-28').complete).toBe(true);
    expect(dayCompletion(emptyStore(), '2026-10-28').complete).toBe(false);
  });

  it('picks one reward id for the day, stable through the day; null without ids', () => {
    expect(rewardQuoteId([], '2026-10-28')).toBeNull();
    const ids = ['x', 'y', 'x'];
    expect(rewardQuoteId(ids, '2026-10-28')).toBe(rewardQuoteId(ids, '2026-10-28'));
    expect(new Set([rewardQuoteId(ids, '2026-10-28'), rewardQuoteId(ids, '2026-10-29')])).toEqual(new Set(['x', 'y']));
  });
});

describe('stories', () => {
  it('returns the filled id of a moment and null for an empty one', () => {
    const stories = { 'qatil-al-mia': 'id-1', 'marad-safar': null, fasila: '' };
    expect(storyQuoteId('afterFall', stories)).toBe('id-1');
    expect(storyQuoteId('heavyDay', stories)).toBeNull();
    expect(storyQuoteId('lateStart', stories)).toBeNull();
    expect(storyQuoteId('smallDeed', undefined)).toBeNull();
  });
});

describe('شعبة الأسبوع', () => {
  it('computes ISO weeks, including the year edges', () => {
    expect(isoWeek('2026-10-28')).toEqual({ year: 2026, week: 44 });
    expect(isoWeek('2021-01-03')).toEqual({ year: 2020, week: 53 });
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 });
  });

  it('is the same branch for a whole ISO week, in 1..77, and moves on the next week', () => {
    const monday = branchOfWeek('2026-10-26');
    for (const d of ['2026-10-27', '2026-10-28', '2026-11-01']) expect(branchOfWeek(d)).toBe(monday);
    expect(branchOfWeek('2026-11-02')).toBe((monday % 77) + 1);
    for (let i = 0; i < 200; i++) {
      const n = branchOfWeek(`20${String(20 + (i % 10)).padStart(2, '0')}-0${(i % 9) + 1}-1${i % 9}`);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(77);
    }
  });
});

describe('«اسم الأسبوع» alternates with «شعبة الأسبوع»', () => {
  it('even ISO weeks show the branch, odd weeks the name, for the whole week', () => {
    expect(weekCardKind('2026-10-28')).toBe('branch'); // week 44
    expect(weekCardKind('2026-11-01')).toBe('branch');
    expect(weekCardKind('2026-11-02')).toBe('name'); // week 45
    expect(weekCardKind('2026-11-08')).toBe('name');
  });

  it('is the same name for a whole week, steps one name per name week, and stays in range', () => {
    const first = nameOfWeekIndex('2026-11-02');
    for (const d of ['2026-11-03', '2026-11-08']) expect(nameOfWeekIndex(d)).toBe(first);
    expect(nameOfWeekIndex('2026-11-16')).toBe((first + 1) % 77); // week 47, the next name week
    const seen = new Set<number>();
    const start = Date.UTC(2026, 10, 2);
    for (let w = 0; w < 200; w++) {
      const index = nameOfWeekIndex(new Date(start + w * 14 * 86_400_000).toISOString().slice(0, 10));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(77);
      seen.add(index);
    }
    expect(seen.size).toBe(77);
    expect(nameOfWeekIndex('2026-11-02', 10)).toBeLessThan(10);
    expect(nameOfWeekIndex('2026-11-02', 0)).toBe(0);
  });
});

describe('onboarding', () => {
  it('skip picks the default habit when offered, else the first', () => {
    expect(defaultHabitKey(['duha', 'adhkar-sabah-masa'])).toBe('adhkar-sabah-masa');
    expect(defaultHabitKey(['duha'])).toBe('duha');
    expect(defaultHabitKey([])).toBeNull();
  });
});

describe('استراتيجيات العادات', () => {
  it('has the fourteen strategies of the plan with unique keys', () => {
    expect(STRATEGIES).toHaveLength(14);
    expect(new Set(STRATEGIES.map((s) => s.key)).size).toBe(14);
    expect(STRATEGIES[0]?.titleAr).toBe('ابدأ صغيرًا جدًا');
    expect(STRATEGIES[13]?.titleAr).toBe('حاسب نفسك');
  });

  it('keeps known keys once, in catalog order; toggles one', () => {
    expect(cleanStrategyKeys(['self-review', 'x', 'start-tiny', 'start-tiny', 3])).toEqual(['start-tiny', 'self-review']);
    expect(toggleStrategy([], 'company')).toEqual(['company']);
    expect(toggleStrategy(['company'], 'company')).toEqual([]);
    expect(toggleStrategy(['company'], 'nope')).toEqual(['company']);
  });

  it('reminds of one chosen strategy on Saturdays only, rotating week by week', () => {
    expect(strategyOfWeek(['start-tiny'], '2026-10-30')).toBeNull(); // Friday
    expect(strategyOfWeek([], '2026-10-31')).toBeNull();
    const two = ['start-tiny', 'company'];
    expect(new Set([strategyOfWeek(two, '2026-10-31'), strategyOfWeek(two, '2026-11-07')])).toEqual(new Set(two));
  });

  it('notificationPlan: plans no strategy reminder any more (round 5, F-12 a), even with old prefs', () => {
    const store = storeOf();
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, strategies: ['start-tiny', 'company'], strategyTime: '11:00' };
    const plan = notificationPlan({ store, prefs, today: '2026-10-28', now: '08:00', days: 14 });
    expect(plan.filter((e) => e.kind === 'strategy')).toEqual([]);
  });

  it('parses the strategy prefs, dropping unknown keys and bad times', () => {
    expect(parseNotificationPrefs({ strategies: ['company', 'x'], strategyTime: '25:00' })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      strategies: ['company'],
    });
    expect(parseNotificationPrefs(null).strategies).toEqual([]);
  });
});
