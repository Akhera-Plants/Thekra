/**
 * Owner round 6 (docs/plan/2026-11-09-owner-round-6.md §2–§6): the view choices of «عاداتي» in hub-view.ts — the tabs
 * and old links, the «اليوم» groups and the time-of-day bands, the inline counter, the week strip's marks and which days
 * open, the weekly review a day belongs to, the «حال يومي» line, the milestone lines, the archive lines and toasts,
 * «تعلّم من الخطأ», the periodic due words, the custom act's rhythm and the qada ring — and that every word they name
 * exists in both languages.
 */

import {
  answerDidNot,
  archivePlan,
  archiveNote,
  createPlan,
  dayStateOn,
  emptyStore,
  isPeriodicRule,
  setDayState,
  setReflection,
  upsertPlan,
  weekday,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import {
  archiveLine,
  bandOf,
  bandOfTime,
  byBand,
  customRhythmOf,
  customRule,
  dayStateLineKey,
  DEFAULT_TODAY_GROUP,
  dueWords,
  HABITS_TABS,
  hasCounter,
  milestoneLines,
  parseHabitsTab,
  qadaArc,
  restoreToastKey,
  reviewWeekOf,
  slippedPlans,
  slipPath,
  stripDayOpens,
  stripMark,
  TODAY_GROUPS,
} from '../lib/practice/hub-view';

const NOW = '2026-11-09T09:00:00.000Z';
const TODAY = '2026-11-09'; // a Monday

function plan(id: string, over: Partial<Parameters<typeof createPlan>[0]> = {}): Plan {
  return createPlan({ id, deedSlug: 'x', title: id, unit: 'minutes', amount: 5, activeDaysPerWeek: 7, slots: ['09:00'], createdOn: '2026-10-01', ...over }, NOW);
}

function storeWith(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

const has = (dict: object, key: string): boolean => {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const [i, part] of parts.entries()) {
    const rec = node as Record<string, unknown>;
    if (rec && typeof rec === 'object' && part in rec) {
      node = rec[part];
      continue;
    }
    return i === parts.length - 1 && rec !== null && typeof rec === 'object' && Object.keys(rec).some((k) => k.startsWith(`${part}_`));
  }
  return typeof node === 'string';
};

describe('«عاداتي» tabs', () => {
  it('has the five tabs in order and keeps old links working', () => {
    expect([...HABITS_TABS]).toEqual(['today', 'habits', 'periodic', 'review', 'record']);
    expect(parseHabitsTab('wird')).toBe('today');
    expect(parseHabitsTab('kinship')).toBe('periodic');
    expect(parseHabitsTab(['periodic'])).toBe('periodic');
    expect(parseHabitsTab(42)).toBe('today');
  });
});

describe('«اليوم»', () => {
  it('opens on the habits group, with the three groups reachable from one row', () => {
    expect([...TODAY_GROUPS]).toEqual(['fard', 'habits', 'periodic']);
    expect(DEFAULT_TODAY_GROUP).toBe('habits');
  });

  it('bands habits by their first reminder: a prayer anchor, or the clock', () => {
    expect(bandOfTime('05:30')).toBe('start');
    expect(bandOfTime('10:00')).toBe('during');
    expect(bandOfTime('17:59')).toBe('during');
    expect(bandOfTime('21:00')).toBe('end');
    expect(bandOf(plan('a', { slots: ['05:20'], slotAnchors: ['after-fajr'] }))).toBe('start');
    expect(bandOf(plan('b', { slots: ['15:50'], slotAnchors: ['after-asr'] }))).toBe('during');
    expect(bandOf(plan('c', { slots: ['22:00'], slotAnchors: ['before-sleep'] }))).toBe('end');
    const groups = byBand(['x', 'y', 'z'], (v) => (v === 'y' ? 'end' : 'start'));
    expect(groups).toEqual([
      { band: 'start', items: ['x', 'z'] },
      { band: 'end', items: ['y'] },
    ]);
  });

  it('shows the inline counter only for counted habits asked more than once', () => {
    expect(hasCounter('count', 4)).toBe(true);
    expect(hasCounter('times', 1)).toBe(false);
    expect(hasCounter('minutes', 10)).toBe(false);
    // The same rule as the web (practice-core): none for `times` habits, none once complete, none for rak'ah prayers.
    expect(hasCounter('times', 4)).toBe(false);
    expect(hasCounter('count', 4, true)).toBe(false);
    expect(hasCounter('count', 2, false, 'pairs')).toBe(false);
  });

  it('says the gentle line only on a hard day', () => {
    const s = storeWith(plan('p'));
    expect(dayStateLineKey(dayStateOn(s, TODAY))).toBeNull();
    const sick = setDayState(s, TODAY, 'sick', TODAY, NOW);
    expect(dayStateLineKey(dayStateOn(sick, TODAY))).toBe('habitsHub.dayState.forgive');
  });
});

describe('the week strip', () => {
  it('marks calmly and opens only past days', () => {
    expect(stripMark('done')).toBe('done');
    expect(stripMark('notDone')).toBe('notDone');
    expect(stripMark('open')).toBe('none');
    expect(stripMark('future')).toBe('none');
    expect(stripDayOpens('2026-11-08', TODAY)).toBe(true);
    expect(stripDayOpens(TODAY, TODAY)).toBe(true);
    expect(stripDayOpens('2026-11-10', TODAY)).toBe(false);
  });

  it('finds the weekly review that covers a day (the review day on or after it)', () => {
    const friday = 5;
    expect(reviewWeekOf(TODAY, friday)).toBe('2026-11-13');
    expect(reviewWeekOf('2026-11-13', friday)).toBe('2026-11-13');
    expect(weekday(reviewWeekOf('2026-11-14', friday))).toBe(friday);
  });
});

describe('«العادات»', () => {
  it('names the milestones and suggests sharing only to circle members', () => {
    const ms = [{ key: 'hardest-passed' as const, on: '2026-10-29' }];
    expect(milestoneLines(ms, ms[0]!, false)).toEqual(['habitsHub.habits.milestoneHardest']);
    expect(milestoneLines(ms, ms[0]!, true)).toEqual(['habitsHub.habits.milestoneHardest', 'habitsHub.habits.share']);
    expect(milestoneLines([{ key: 'habit-made', on: TODAY }], null, true)).toEqual(['habitsHub.habits.milestoneMade']);
  });

  it('says what a restore does: keeps the progress for 3 days, then starts again', () => {
    const s = archivePlan(storeWith(plan('p')), 'p', '2026-11-05', NOW);
    const archived = s.plans[0]!;
    expect(archiveLine(archiveNote(archived, '2026-11-07')).key).toBe('habitsHub.archive.keeps');
    expect(archiveLine(archiveNote(archived, '2026-11-07')).params.date).toBe('2026-11-08');
    expect(archiveLine(archiveNote(archived, TODAY))).toEqual({ key: 'habitsHub.archive.willReset', params: { days: 4 } });
    expect(restoreToastKey(true)).toBe('habitsHub.archive.restoredReset');
    expect(restoreToastKey(false)).toBe('habitsHub.archive.restoredKept');
  });
});

describe('«تعلّم من الخطأ»', () => {
  it('reads the path to a slipped day: the week before it, the run, what was hard, the member’s own plan', () => {
    let p = plan('p', { createdOn: '2026-11-01' });
    p = { ...p, log: { '2026-11-02': 5, '2026-11-03': 5 }, loops: [{ id: 'l1', cue: 'بعد الفجر', craving: '', routine: 'قراءة', reward: '', ifThen: 'صفحة قبل النوم', updatedAt: NOW }] };
    let s = storeWith(p);
    s = setReflection(s, { planId: 'p', date: '2026-11-05', today: TODAY, hard: 'سهرت' }, NOW);
    const path = slipPath(s, s.plans[0]!, '2026-11-06', TODAY);
    expect(path).not.toBeNull();
    // From the plan's first day (Nov 1) to the slip (Nov 6); Nov 6 is still inside the 3-day ask window on Nov 9.
    expect(path!.days.map((d) => d.state)).toEqual(['notDone', 'done', 'done', 'notDone', 'notDone', 'ask']);
    expect(path!.run).toBe(3);
    expect(path!.hard).toEqual([{ date: '2026-11-05', text: 'سهرت' }]);
    expect(path!.ifThen).toBe('صفحة قبل النوم');
    // A kept day is no slip; an explicit «لم أفعل» is one.
    expect(slipPath(s, s.plans[0]!, '2026-11-02', TODAY)).toBeNull();
    const marked = upsertPlan(s, answerDidNot(s.plans[0]!, '2026-11-08', TODAY, NOW), NOW);
    expect(slippedPlans(marked, '2026-11-08', TODAY).map((x) => x.id)).toEqual(['p']);
  });
});

describe('periodic acts', () => {
  it('words the next date without blame', () => {
    expect(dueWords(null, TODAY)).toEqual({ key: 'habitsHub.periodic.noNext' });
    expect(dueWords(TODAY, TODAY)).toEqual({ key: 'habitsHub.periodic.today' });
    expect(dueWords('2026-11-10', TODAY)).toEqual({ key: 'habitsHub.periodic.tomorrow' });
    expect(dueWords('2026-11-13', TODAY)).toEqual({ key: 'habitsHub.periodic.inDays', count: 4 });
    expect(dueWords('2026-11-06', TODAY)).toEqual({ key: 'habitsHub.periodic.overdue', count: 3 });
  });

  it('builds only non-daily rhythms for a custom act, and opens a saved one as it was', () => {
    const base = { rhythm: 'weekly' as const, days: [5], n: 3, day: 1 };
    expect(customRule(base, TODAY)).toEqual({ kind: 'weekdays', days: [5] });
    expect(customRule({ ...base, days: [0, 1, 2, 3, 4, 5, 6] }, TODAY)).toBeNull();
    expect(customRule({ ...base, rhythm: 'everyNDays', n: 1 }, TODAY)).toBeNull();
    expect(customRule({ ...base, rhythm: 'monthly', day: 31 }, TODAY)).toBeNull();
    for (const values of [base, { ...base, rhythm: 'everyNDays' as const, n: 10 }, { ...base, rhythm: 'monthly' as const, day: 15 }]) {
      const rule = customRule(values, TODAY)!;
      expect(isPeriodicRule(rule)).toBe(true);
      expect(customRule(customRhythmOf(rule, 1), TODAY)).toEqual(rule);
    }
  });
});

describe('«قضاء الفوائت»', () => {
  it('clamps the ring', () => {
    expect(qadaArc(0, 0)).toBe(0);
    expect(qadaArc(50, 200)).toBe(0.25);
    expect(qadaArc(300, 200)).toBe(1);
  });
});

describe('words', () => {
  const keys = [
    'habitsHub.dayState.forgive',
    'habitsHub.habits.milestoneHardest',
    'habitsHub.habits.milestoneMade',
    'habitsHub.habits.share',
    'habitsHub.archive.keeps',
    'habitsHub.archive.willReset',
    'habitsHub.archive.restoredReset',
    'habitsHub.archive.restoredKept',
    'habitsHub.periodic.noNext',
    'habitsHub.periodic.today',
    'habitsHub.periodic.tomorrow',
    'habitsHub.periodic.inDays',
    'habitsHub.periodic.overdue',
    ...TODAY_GROUPS.map((g) => `habitsHub.today.groups.${g}`),
    ...['start', 'during', 'end'].map((b) => `habitsHub.today.bands.${b}`),
    ...['normal', 'sick', 'busy', 'travel'].map((s) => `habitsHub.dayState.states.${s}`),
    ...HABITS_TABS.map((tab) => `habitsTab.tabs.${tab}`),
  ];

  it.each(keys)('%s exists in Arabic and English', (key) => {
    expect(has(ar, key)).toBe(true);
    expect(has(en, key)).toBe(true);
  });

  it('keeps the owner’s words: the gentle line, «لم تتم», «صلة الرحم والأحباب», no «حاسب نفسك الآن», no weak hadith', () => {
    const hub = (ar as { habitsHub: Record<string, Record<string, unknown>> }).habitsHub;
    expect(hub.dayState!.forgive).toBe('سامح نفسك اليوم، وأدِّ القدر الأدنى.');
    expect((hub.week as Record<string, string>).notDone).toBe('لم تتم');
    expect((hub.periodic as Record<string, string>).silat).toBe('صلة الرحم والأحباب');
    expect((hub.review as Record<string, string>).lead).toBe('حاسب نفسك اليوم ليخفّ حسابك غدًا.');
    const all = JSON.stringify(ar);
    expect(all.includes('حاسب نفسك الآن')).toBe(false);
    expect(all.includes('الكيّس من دان نفسه')).toBe(false);
    expect(JSON.stringify(hub).includes('أهلي وناسي')).toBe(false);
    expect(JSON.stringify(hub).includes('أوقف مؤقتًا')).toBe(false);
  });
});
