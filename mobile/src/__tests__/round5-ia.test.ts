/**
 * Owner round 5, the app's information architecture (docs/plan/2026-11-07-owner-round-5.md §1):
 * - the ONE heart card of «ورد اليوم»: which card practice-core `heartSlot` picks and what the card shows (one line, an
 *   action that opens a sheet; nothing when no card is due);
 * - «صلّحها»: missed yesterday → the steps; missed two asked days → «أتبع السيئة الحسنة» with the deeds; a chosen deed
 *   → «فعلته»; done → the row's button goes away;
 * - «خصّص الرئيسية»: a visitor's fixed order, a member's draft (switch, up/down, defaults stored as absent) and the
 *   one-time move of «شعبة الأسبوع» into the synced sections;
 * - the weekly occasions as one row, the next non-weekly occasion, the last review day, the two optional questions of
 *   «أضف» saved as the plan's loop, the days of a habit (A-13 a), and the onboarding's steps (F-26 a).
 */

import {
  addDays,
  chooseMakeUp,
  createPlan,
  emptyHeart,
  emptyStore,
  heartSlot,
  homeSectionsToStore,
  makeIntention,
  makeUpOffer,
  markMakeUpDone,
  parseHomeSections,
  saveEvening,
  setHeartPrefs,
  setHomeSections,
  toggleExcusedDay,
  upsertPlan,
  validateHabitLoop,
  visibleHomeSections,
  type AgendaOccasion,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import { homeEditRows, moveSectionBy, toggleSection, weekBranchMigration } from '../lib/home/home-edit';
import {
  activeDaysFrom,
  answersOf,
  heartCardView,
  lastReviewDay,
  loopFromAnswers,
  mendState,
  nextOccasion,
  reviewLines,
  showsMend,
  splitOccasions,
  weeklyLabel,
} from '../lib/practice/habits-view';
import { onboardingLanding, onboardingNext } from '../lib/practice/onboarding';

const NOW = '2026-11-07T08:00:00.000Z';

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'x', title: id, unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-09-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

function everyDay(from: string, to: string, amount = 10): Record<string, number> {
  const log: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) log[d] = amount;
  return log;
}

describe('the heart card of «ورد اليوم»', () => {
  const today = '2026-11-05'; // Thursday
  const store = storeOf(plan('a', { log: everyDay('2026-10-01', '2026-11-04') }));

  it('shows one line and «ابدأ» for each due card, and opens the matching sheet', () => {
    let heart = setHeartPrefs(emptyHeart(), { intention: true, eveningReview: true, eveningFrom: '18:00' });
    expect(heartCardView(heartSlot(heart, store, today, '07:00'))).toEqual({
      lineKey: 'habitsTab.heart.intentionLine',
      actionKey: 'habitsTab.heart.start',
      sheet: 'intention',
    });
    expect(heartCardView(heartSlot(heart, store, today, '18:30'))?.sheet).toBe('evening');
    heart = saveEvening(heart, { date: today });
    expect(heartCardView(heartSlot(heart, store, today, '18:30'))).toBeNull();
    expect(heartCardView(heartSlot(heart, store, '2026-11-06', '15:00'))?.sheet).toBe('weekly');
    expect(heartCardView(heartSlot(emptyHeart(), store, today, '07:00'))?.sheet).toBe('intention-offer');
  });

  it('tells the intention already made in one line without an action', () => {
    const heart = makeIntention(setHeartPrefs(emptyHeart(), { intention: true }), { date: today, planIds: ['a'] });
    expect(heartCardView(heartSlot(heart, store, today, '07:00'))).toEqual({ lineKey: 'habitsTab.heart.intentionMade', actionKey: null, sheet: null });
  });

  it('shows «عملك المعتاد يُكتب لك» with its reason the morning after an excuse', () => {
    const excused = toggleExcusedDay(store, '2026-11-04', today, NOW);
    const heart = setHeartPrefs(emptyHeart(), { intentionOfferDismissed: true, fridayReview: false });
    expect(heartCardView(heartSlot(heart, excused, today, '08:00'))).toEqual({
      lineKey: 'habitsTab.heart.usualExcused',
      actionKey: 'habitsTab.heart.read',
      sheet: 'usual-deed',
    });
    expect(heartCardView(heartSlot(heart, excused, today, '13:00'))).toBeNull();
  });
});

describe('«صلّحها» and the make-up deed', () => {
  const today = '2026-11-07';
  const now = new Date(2026, 10, 7, 18, 0).getTime();
  const p = plan('a', { log: everyDay('2026-10-01', '2026-11-04') });
  const s = storeOf(p);

  it('offers one good deed after two missed asked days, then «فعلته», then nothing', () => {
    let heart = emptyHeart();
    const offer = () => makeUpOffer(s, p, today, { now, heart });
    const state = () => mendState({ offer: offer(), missedYesterday: true, doneToday: 0, paused: false });
    expect(state()).toBe('offer');
    expect(showsMend(state())).toBe(true);
    heart = chooseMakeUp(heart, { planId: 'a', on: offer()!.on, date: today, action: 'istighfar' });
    expect(state()).toBe('chosen');
    expect(showsMend(state())).toBe(true);
    heart = markMakeUpDone(heart, 'a', offer()!.on);
    expect(state()).toBe('done');
    expect(showsMend(state())).toBe(false);
  });

  it('shows the steps after one missed day, nothing once something is logged today or while paused', () => {
    expect(mendState({ offer: null, missedYesterday: true, doneToday: 0, paused: false })).toBe('steps');
    expect(mendState({ offer: null, missedYesterday: true, doneToday: 3, paused: false })).toBe('none');
    expect(mendState({ offer: null, missedYesterday: false, doneToday: 0, paused: false })).toBe('none');
    expect(mendState({ offer: makeUpOffer(s, p, today, { now }), missedYesterday: true, doneToday: 0, paused: true })).toBe('none');
  });
});

describe('«خصّص الرئيسية»', () => {
  it('gives a visitor the fixed public order, without «ورد اليوم»', () => {
    expect(visibleHomeSections(undefined, false)).toEqual(['daily-text', 'occasion', 'doors', 'moments', 'featured', 'sources']);
    expect(visibleHomeSections([{ key: 'sources', visible: true }], false)[0]).toBe('daily-text');
  });

  it('edits a draft: up/down at the ends, the switch, the defaults stored as absent', () => {
    const rows = homeEditRows(null, 'ar');
    expect(rows[0]).toMatchObject({ key: 'wird', title: 'ورد اليوم', canUp: false, canDown: true });
    expect(rows.at(-1)).toMatchObject({ key: 'sources', canDown: false });
    let draft = moveSectionBy(null, 'doors', -1);
    expect(draft.map((s) => s.key).indexOf('doors')).toBe(3);
    draft = moveSectionBy(draft, 'wird', -1);
    expect(draft[0]?.key).toBe('wird');
    draft = toggleSection(draft, 'featured');
    expect(draft.find((s) => s.key === 'featured')?.visible).toBe(false);
    const stored = setHomeSections(emptyStore(), homeSectionsToStore(draft) ?? null, NOW);
    expect(visibleHomeSections(stored.settings.homeSections, true)).toEqual([
      'wird',
      'daily-text',
      'doors',
      'occasion',
      'moments',
      'sources',
    ]);
    // Back to the defaults: nothing stored (it follows later default changes).
    const reset = setHomeSections(stored, homeSectionsToStore(parseHomeSections([])) ?? null, NOW);
    expect(reset.settings.homeSections).toBeUndefined();
    expect(homeEditRows(null, 'en')[1]?.title).toBe('Text of the day');
  });

  it('moves the device switch «شعبة الأسبوع» once into the synced sections', () => {
    const moved = weekBranchMigration(undefined, true);
    expect(moved?.find((s) => s.key === 'week-branch')?.visible).toBe(true);
    expect(weekBranchMigration(undefined, false)).toBeNull();
    expect(weekBranchMigration([{ key: 'wird', visible: true }], true)).toBeNull();
  });
});

describe('occasions on «سجلّي» and the home page', () => {
  const occasions: AgendaOccasion[] = [
    { key: 'ithnayn-khamis', titleAr: 'صيام الاثنين والخميس', titleEn: 'Monday and Thursday', deed: 'siyam', rule: { kind: 'weekdays', days: [4, 1] } },
    { key: 'jumua', titleAr: 'يوم الجمعة', titleEn: 'Friday', deed: 'jumua', rule: { kind: 'weekdays', days: [5] } },
    { key: 'mid-month', titleAr: 'منتصف الشهر', titleEn: 'Mid-month', deed: 'x', rule: { kind: 'monthlyDay', day: 15 } },
  ];
  const ar = (d: number) => ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d]!;
  const en = (d: number) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]!;

  it('puts the weekly ones in one row «كل اثنين وخميس», «كل جمعة» and marks the others', () => {
    const split = splitOccasions(occasions);
    expect(split.weekly.map((o) => o.key)).toEqual(['ithnayn-khamis', 'jumua']);
    expect(split.other.map((o) => o.key)).toEqual(['mid-month']);
    expect(weeklyLabel([4, 1], 'ar', ar)).toBe('كل اثنين وخميس');
    expect(weeklyLabel([5], 'ar', ar)).toBe('كل جمعة');
    expect(weeklyLabel([4, 1], 'en', en)).toBe('Every Monday and Thursday');
  });

  it('«مناسبة قريبة»: the next non-weekly occasion within ten days, else none', () => {
    expect(nextOccasion(occasions, '2026-11-10')).toMatchObject({ date: '2026-11-15', inDays: 5 });
    expect(nextOccasion(occasions, '2026-11-15')).toMatchObject({ inDays: 0 });
    expect(nextOccasion(occasions, '2026-11-20')).toBeNull();
  });
});

describe('«محاسبتي», «أضف», the habit days and the onboarding', () => {
  it('reviews the week closing on the last review day', () => {
    expect(lastReviewDay('2026-11-07', 5)).toBe('2026-11-06'); // Saturday → the Friday before
    expect(lastReviewDay('2026-11-06', 5)).toBe('2026-11-06');
  });

  it('lists a review weakest first, the steady ones after with 0', () => {
    const lines = reviewLines({
      steady: [{ planId: 's', title: 'S', missed: 0 }],
      weak: [
        { planId: 'a', title: 'A', missed: 1 },
        { planId: 'b', title: 'B', missed: 3 },
      ],
    });
    expect(lines.map((l) => [l.planId, l.missed])).toEqual([
      ['b', 3],
      ['a', 1],
      ['s', 0],
    ]);
  });

  it('saves the two optional answers as a valid loop, none when both are empty', () => {
    expect(loopFromAnswers({ after: ' ', ifBlocked: '' }, 'Quran', 'l1', NOW)).toBeNull();
    const loop = loopFromAnswers({ after: 'بعد  الفجر', ifBlocked: 'أقرأ صفحة' }, 'القرآن', 'l1', NOW)!;
    expect(validateHabitLoop(loop)).toBeNull();
    expect(answersOf([loop])).toEqual({ after: 'بعد الفجر', ifBlocked: 'أقرأ صفحة' });
    expect(answersOf(undefined)).toEqual({ after: '', ifBlocked: '' });
  });

  it('counts the days per week from the days picked (A-13 a)', () => {
    expect(activeDaysFrom([0, 2, 4], 3)).toBe(3);
    expect(activeDaysFrom([1, 1, 1], 3)).toBe(1);
    expect(activeDaysFrom(null, 3)).toBe(3);
  });

  it('walks the onboarding: reading ends at once, a sin skips the habit list', () => {
    expect(onboardingNext('goal', 'read')).toBe('done');
    expect(onboardingNext('goal', 'deed')).toBe('pick');
    expect(onboardingNext('pick', 'deed')).toBe('time');
    expect(onboardingNext('goal', 'sin')).toBe('time');
    expect(onboardingNext('time', 'sin')).toBe('done');
    expect(onboardingLanding('deed', true)).toBe('/habits');
    expect(onboardingLanding('deed', false)).toBe('/');
    expect(onboardingLanding('sin', false)).toBe('/practice/sin-program');
    expect(onboardingLanding(null, false)).toBe('/');
  });
});
