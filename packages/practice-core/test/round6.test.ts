import { describe, expect, it } from 'vitest';
import {
  activePeriodicActs,
  addDays,
  addSelfMessage,
  answerDidIt,
  answerDidNot,
  APP_MORE,
  APP_TABS,
  applyServerChanges,
  ARCHIVE_MAX,
  ARCHIVE_RESET_DAYS,
  archiveNote,
  archivePlan,
  avoidedWordsIn,
  ayahAudioUrl,
  canArchive,
  checkIn,
  annotateCheckIn,
  countChanges,
  createCustomPeriodic,
  createPlan,
  createRelative,
  currentStreak,
  dayDetails,
  dayLogState,
  dayStateOn,
  decreaseTo,
  DEFAULT_NOTIFICATION_PREFS,
  editSelfMessage,
  emptyHeart,
  emptyStore,
  endProgram,
  GLOSSARY,
  habitAddChoice,
  habitCompletion,
  habitListRows,
  habitMilestones,
  HABITS_TABS,
  habitStreak,
  isLightenCovered,
  isRead,
  keptDays,
  limits,
  localChanges,
  logQada,
  markRead,
  markUnread,
  minimumOf,
  NAV_FEATURES,
  NAV_KEY_ALIASES,
  navFeature,
  NOTIFICATION_GROUPS,
  notificationPlan,
  parseHeart,
  parseNotificationPrefs,
  parsePrograms,
  parseStore,
  pendingAsks,
  PERIODIC_ACTS,
  periodicActKeyOf,
  qadaProgress,
  RECITERS,
  reflectionOf,
  removeSelfMessage,
  requiredOn,
  requiredOnDay,
  restorePlan,
  restorePlanInStore,
  SELF_MESSAGES_MAX,
  selfMessages,
  serializeStore,
  setDayState,
  setLightenCovered,
  setMinimum,
  setQadaPlan,
  setReciter,
  setReflection,
  settingsContent,
  shareSuggestion,
  startProgram,
  stepChoices,
  updatePlan,
  upsertPlan,
  upsertRelative,
  WEB_ACCOUNT_MENU,
  WEB_HEADER,
  WEB_REDIRECTS,
  weekDays,
  weekStart,
  weekStrip,
  type Plan,
  type Store,
  STRATEGIES,
  STRATEGY_KINDS,
  strategyAppliesToHabit,
  listedStrategies,
  strategyKind,
} from '../src/index.js';

const NOW = '2026-11-09T08:00:00.000Z';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 8, minute)).toISOString();
const TODAY = '2026-11-09'; // a Monday
const LATE = Date.UTC(2026, 10, 20); // long after every make-up window used below

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

// ── §1 navigation ────────────────────────────────────────────────────────────────────────────────────────────────

describe('nav-map (round 6 §1)', () => {
  it('has no «أهلي وناسي» and no «تصفّح النصوص»; «صلة الرحم والأحباب» is under the periodic acts', () => {
    expect(NAV_FEATURES.some((f) => f.key === 'people' || f.key === 'browse')).toBe(false);
    expect(NAV_FEATURES.some((f) => f.ar.includes('أهلي وناسي') || f.ar.includes('تصفّح'))).toBe(false);
    const silat = NAV_FEATURES.find((f) => f.key === 'silat');
    expect(silat).toMatchObject({ ar: 'صلة الرحم والأحباب', parent: 'periodic', web: '/practice/periodic', app: '/habits?tab=periodic' });
  });

  it('«عاداتي» has the five tabs with their web routes and app `?tab=` values', () => {
    expect(HABITS_TABS.map((k) => navFeature(k)?.ar)).toEqual(['اليوم', 'العادات', 'الأعمال الدورية', 'محاسبتي', 'سجلّي']);
    expect(HABITS_TABS.map((k) => navFeature(k)?.web)).toEqual(['/practice', '/practice/habits', '/practice/periodic', '/practice/review', '/practice/record']);
    expect(HABITS_TABS.map((k) => navFeature(k)?.app)).toEqual([
      '/habits?tab=today',
      '/habits?tab=habits',
      '/habits?tab=periodic',
      '/habits?tab=review',
      '/habits?tab=record',
    ]);
  });

  it('web header and «المزيد» never share an item; settings only in the account menu', () => {
    expect(WEB_HEADER.links.map((k) => navFeature(k)?.ar)).toEqual(['الرئيسية', 'الطاعات', 'تخفَّف من ذنب', 'شعب الإيمان', 'عاداتي']);
    expect(WEB_HEADER.more.map((k) => navFeature(k)?.ar)).toEqual(['استراتيجيات العادات', 'المحفوظات', 'رفقة']);
    for (const k of WEB_HEADER.more) expect(WEB_HEADER.links).not.toContain(k);
    expect([...WEB_HEADER.links, ...WEB_HEADER.more]).not.toContain('settings');
    expect(WEB_ACCOUNT_MENU).toEqual(['account', 'settings']);
    expect(APP_TABS).toEqual(['home', 'habits', 'more']);
    for (const k of WEB_HEADER.more) expect(APP_MORE.mine).toContain(k);
    for (const k of [...WEB_HEADER.links, ...WEB_HEADER.more, ...APP_MORE.mine, ...APP_MORE.settings]) expect(navFeature(k), k).toBeDefined();
    expect(navFeature('customize-home')?.group).toBe('settings');
  });

  it('redirects the removed pages; `/practice/habits` is a tab again; old keys still resolve', () => {
    const r = new Map(WEB_REDIRECTS.map((x) => [x.from, x.to]));
    expect(r.get('/practice/people')).toBe('/practice/periodic');
    expect(r.get('/practice/kinship')).toBe('/practice/periodic');
    expect(r.get('/browse')).toBe('/');
    expect(r.has('/practice/habits')).toBe(false);
    const web = new Set(NAV_FEATURES.map((f) => f.web));
    for (const x of WEB_REDIRECTS) expect(web.has(x.from), x.from).toBe(false);
    expect(NAV_KEY_ALIASES).toEqual({ wird: 'today', people: 'periodic' });
    expect(navFeature('wird')?.key).toBe('today');
    expect(navFeature('people')?.web).toBe('/practice/periodic');
    expect(navFeature('browse')).toBeUndefined();
  });

  it('glossary: «تخفَّف من ذنب», never «ترك معصية»; no feature name uses an avoided word', () => {
    expect(new Set(GLOSSARY.map((t) => t.key)).size).toBe(GLOSSARY.length);
    for (const f of NAV_FEATURES) expect(avoidedWordsIn(f.ar), f.key).toEqual([]);
    expect(avoidedWordsIn('برنامج ترك معصية')).toContainEqual({ word: 'ترك معصية', use: 'تخفَّف من ذنب' });
    expect(avoidedWordsIn('أهلي وناسي')).toEqual([{ word: 'أهلي وناسي', use: 'صلة الرحم والأحباب' }]);
    expect(navFeature('sins')?.ar).toBe(GLOSSARY.find((t) => t.key === 'lighten')?.ar);
  });
});

// ── §2 archive ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('archive = pause (round 6 §2)', () => {
  it('archives at most 10 habits', () => {
    let s = storeOf(...Array.from({ length: 11 }, (_, i) => plan(`p${i}`)));
    for (let i = 0; i < ARCHIVE_MAX; i++) s = archivePlan(s, `p${i}`, TODAY, NOW);
    expect(canArchive(s)).toBe(false);
    expect(() => archivePlan(s, 'p10', TODAY, NOW)).toThrow(/full/);
    expect(archivePlan(s, 'p0', TODAY, NOW)).toBe(s); // already archived: no-op
  });

  it('restoring within 3 days keeps the progress; after more than 3 days it starts again (history kept)', () => {
    const p = plan('a', { amount: 15, startAmount: 5, amountChangedOn: '2026-10-01', log: everyDay('2026-09-01', '2026-11-01'), pausedOn: '2026-11-02' });
    const keep = restorePlan(p, addDays('2026-11-02', ARCHIVE_RESET_DAYS), NOW);
    expect(keep.reset).toBe(false);
    expect(keep.plan.amount).toBe(15);
    expect(keep.plan.restartedOn).toBeUndefined();
    const reset = restorePlan(p, addDays('2026-11-02', ARCHIVE_RESET_DAYS + 1), NOW);
    expect(reset.reset).toBe(true);
    expect(reset.plan).toMatchObject({ amount: 5, amountChangedOn: '2026-11-06', restartedOn: '2026-11-06', resumedOn: '2026-11-06' });
    expect(Object.keys(reset.plan.log).length).toBe(Object.keys(p.log).length);
    expect(keptDays(reset.plan, '2026-11-09')).toBe(3);
    expect(archiveNote(p, '2026-11-09')).toEqual({ daysArchived: 7, resetsIfRestoredToday: true, keepsProgressUntil: '2026-11-05', resetDays: 3 });
    const { store, reset: r2 } = restorePlanInStore(storeOf(p), 'a', TODAY, at(1));
    expect(r2).toBe(true);
    expect(store.plans[0]?.restartedOn).toBe(TODAY);
  });

  it('«أضف» at 3 habits: archive or delete, with the 3-day note', () => {
    const s = storeOf(plan('a'), plan('b'), plan('c'));
    expect(habitAddChoice(s, TODAY)).toMatchObject({ count: 3, max: 3, options: ['archive', 'delete'], archived: 0, archiveMax: 10, resetDays: 3 });
    expect(habitAddChoice(storeOf(plan('a')), TODAY)).toBeNull();
  });
});

// ── §2 minimum ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('«القدر الأدنى» (round 6 §2)', () => {
  it('a hard day asks exactly the minimum; lowering never goes below it', () => {
    let p = setMinimum(plan('a', { amount: 10 }), 3, NOW);
    expect(minimumOf(p)).toBe(3);
    expect(requiredOn({ ...p, ebb: { since: TODAY } }, TODAY)).toBe(3);
    expect(() => decreaseTo(p, 2, TODAY, NOW)).toThrow(/minimum/);
    expect(decreaseTo(p, 3, TODAY, NOW).amount).toBe(3);
    expect(() => setMinimum(p, 11, NOW)).toThrow();
    // Without a minimum the old «أقل ما يمكن» (2) stays.
    expect(minimumOf(plan('b', { amount: 10 }))).toBe(2);
    // The weekly review's «خفّف» stops at the minimum.
    p = { ...p, amount: 3 };
    expect(stepChoices(p, TODAY)).not.toContain('lighten');
  });
});

// ── §2 «حال يومي» ───────────────────────────────────────────────────────────────────────────────────────────────

describe('«حال يومي» (round 6 §2)', () => {
  it('sick/travel are excused and ask the minimum; busy asks the minimum and starts the ebb today; normal clears', () => {
    let s = storeOf(setMinimum(plan('a', { amount: 10 }), 4, NOW));
    s = setDayState(s, TODAY, 'sick', TODAY, at(1));
    expect(s.settings.excusedDays).toEqual([TODAY]);
    expect(dayStateOn(s, TODAY)).toEqual({ state: 'sick', excused: true, minimum: true, legacy: false });
    expect(requiredOnDay(s, s.plans[0] as Plan, TODAY)).toBe(4);
    s = setDayState(s, TODAY, 'busy', TODAY, at(2));
    expect(s.settings.excusedDays).toBeUndefined();
    expect(s.plans[0]?.ebb).toEqual({ since: TODAY });
    expect(dayStateOn(s, TODAY).state).toBe('busy');
    s = setDayState(s, TODAY, 'normal', TODAY, at(3));
    expect(s.plans[0]?.ebb).toBeUndefined();
    expect(s.settings.dayStates).toBeUndefined();
    expect(dayStateOn(s, TODAY)).toEqual({ state: 'normal', excused: false, minimum: false, legacy: false });
  });

  it('reads round-5 data: an «عذر» day as sick (legacy), a «يومي ثقيل» ebb as busy (legacy)', () => {
    const s = parseStore({ v: 2, plans: [plan('a', { ebb: { since: '2026-11-08' } })], relatives: [], settings: { hijriOffset: 0, excusedDays: ['2026-11-07'] } });
    expect(dayStateOn(s, '2026-11-07')).toMatchObject({ state: 'sick', legacy: true });
    expect(dayStateOn(s, '2026-11-08')).toMatchObject({ state: 'busy', legacy: true });
  });

  it('a busy past day counts the minimum for the streak like «يومي ثقيل»', () => {
    let s = storeOf(plan('a', { log: { '2026-11-07': 1, '2026-11-08': 10 } }), plan('b', { log: { '2026-11-08': 10 } }));
    const opts = { now: LATE };
    expect(currentStreak(s, '2026-11-08', opts)).toBe(1);
    s = setDayState(s, '2026-11-07', 'busy', '2026-11-08', at(1));
    expect(currentStreak(s, '2026-11-08', opts)).toBe(2);
  });
});

// ── §2 unlogged days and the week strip ─────────────────────────────────────────────────────────────────────────

describe('unlogged days and the week (round 6 §2)', () => {
  it('a past asked day without a log asks «هل فعلتها؟» for 3 days, then is «لم تتم»; «لم أفعل» is explicit', () => {
    const s = storeOf(plan('a', { log: { '2026-11-01': 10 } }));
    const p = s.plans[0] as Plan;
    expect(dayLogState(s, p, TODAY, TODAY)).toBe('open');
    expect(dayLogState(s, p, '2026-11-08', TODAY)).toBe('ask');
    expect(dayLogState(s, p, '2026-11-06', TODAY)).toBe('ask');
    expect(dayLogState(s, p, '2026-11-05', TODAY)).toBe('notDone');
    expect(dayLogState(s, p, '2026-11-01', TODAY)).toBe('done');
    expect(dayLogState(s, p, '2026-11-10', TODAY)).toBe('future');
    expect(dayLogState(s, p, '2026-08-01', TODAY)).toBe('beforeStart');
    expect(pendingAsks(s, TODAY).map((x) => x.date)).toEqual(['2026-11-08', '2026-11-07', '2026-11-06']);
    const no = answerDidNot(p, '2026-11-08', TODAY, at(1));
    expect(dayLogState(s, no, '2026-11-08', TODAY)).toBe('markedNotDone');
    const yes = answerDidIt(s, p, '2026-11-07', TODAY, undefined, at(2));
    expect(yes.log['2026-11-07']).toBe(10);
    expect(() => answerDidNot(p, '2026-11-10', TODAY)).toThrow();
  });

  it('the week starts on the review day (Friday by default)', () => {
    expect(weekStart(TODAY)).toBe('2026-11-06'); // Friday
    expect(weekStart('2026-11-06')).toBe('2026-11-06');
    expect(weekStart(TODAY, 1)).toBe(TODAY);
    expect(weekDays(TODAY)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    // Any amount keeps a habit's day; a day is «partial» when only some of its habits were kept.
    const s = storeOf(plan('a', { log: { '2026-11-06': 10, '2026-11-07': 4 } }), plan('b', { log: { '2026-11-06': 10 } }));
    const strip = weekStrip(s, TODAY, TODAY);
    expect(strip.map((d) => d.status)).toEqual(['done', 'partial', 'notDone', 'open', 'future', 'future', 'future']);
    expect(strip[3]?.isToday).toBe(true);
  });
});

// ── §3 reflections ──────────────────────────────────────────────────────────────────────────────────────────────

describe('daily reflections (round 6 §3)', () => {
  it('two optional answers and a note per habit and day; synced; cleared reflections stay as a marker', () => {
    let s = storeOf(plan('a'));
    s = setReflection(s, { planId: 'a', date: '2026-11-08', today: TODAY, helped: ' صحبة طيبة ', note: 'يوم هادئ' }, at(1));
    expect(reflectionOf(s, 'a', '2026-11-08')).toEqual({ planId: 'a', date: '2026-11-08', helped: 'صحبة طيبة', note: 'يوم هادئ', updatedAt: at(1) });
    expect(() => setReflection(s, { planId: 'zz', date: TODAY, today: TODAY, helped: 'x' })).toThrow();
    expect(() => setReflection(s, { planId: 'a', date: '2026-11-10', today: TODAY, helped: 'x' })).toThrow();
    const c = localChanges(s);
    expect(c.reflections).toEqual([{ planId: 'a', date: '2026-11-08', helped: 'صحبة طيبة', hard: null, note: 'يوم هادئ', clientUpdatedAt: at(1) }]);
    s = applyServerChanges(s, { serverTime: at(5), plans: [], logs: [], relatives: [], contacts: [], settings: null, reflections: c.reflections });
    expect(localChanges(s).reflections).toBeUndefined();
    // A newer edit from another device wins; clearing keeps a marker that syncs.
    s = applyServerChanges(s, {
      serverTime: at(6),
      plans: [],
      logs: [],
      relatives: [],
      contacts: [],
      settings: null,
      reflections: [{ planId: 'a', date: '2026-11-08', helped: null, hard: 'السهر', note: null, clientUpdatedAt: at(4) }],
    });
    expect(reflectionOf(s, 'a', '2026-11-08')?.hard).toBe('السهر');
    s = setReflection(s, { planId: 'a', date: '2026-11-08', today: TODAY, hard: '' }, at(7));
    expect(reflectionOf(s, 'a', '2026-11-08')).toBeNull();
    expect(localChanges(s).reflections?.[0]).toMatchObject({ helped: null, hard: null, note: null });
    expect(dayDetails(s, '2026-11-08', TODAY).habits[0]).toMatchObject({ planId: 'a', state: 'ask', reflection: null });
  });

  it('«تخفّف»: the answers live on the check-in (vault only) and parse', () => {
    let p = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-11-01' }, NOW);
    p = checkIn(p, TODAY, 'held', undefined, at(1));
    p = annotateCheckIn(p, TODAY, { helped: 'ذكر الله', hard: ' ' }, at(2));
    expect(p.checkIns[0]).toMatchObject({ helped: 'ذكر الله' });
    expect(p.checkIns[0]?.hard).toBeUndefined();
    expect(parsePrograms([p])[0]?.checkIns[0]?.helped).toBe('ذكر الله');
    expect(endProgram(p, at(3)).checkIns).toEqual([]);
  });
});

// ── §2 completion and milestones ────────────────────────────────────────────────────────────────────────────────

describe('completion and milestones (round 6 §2)', () => {
  it('completion counts to 66 kept days, 100 only once «راسخة»; milestones are keys with dates', () => {
    const p = plan('a', { createdOn: '2026-10-01', log: everyDay('2026-10-01', '2026-11-08') });
    expect(habitCompletion(p, TODAY)).toEqual({ percent: 59, keptDays: 39, targetDays: 66, established: false });
    expect(habitMilestones(p, TODAY)).toEqual([{ key: 'hardest-passed', on: '2026-10-29' }]);
    expect(shareSuggestion(p, TODAY)).toBeNull();
    expect(shareSuggestion(p, '2026-10-30')?.key).toBe('hardest-passed');
    const made = { ...p, establishedOn: '2026-11-08' };
    expect(habitCompletion(made, TODAY).percent).toBe(100);
    expect(habitMilestones(made, TODAY).map((m) => m.key)).toEqual(['hardest-passed', 'habit-made']);
    // A habit kept poorly in its first month has not passed the hardest stretch.
    expect(habitMilestones(plan('b', { createdOn: '2026-10-01', log: { '2026-10-02': 10 } }), TODAY)).toEqual([]);
    expect(habitStreak(emptyStore(), p, TODAY, { now: Date.UTC(2026, 10, 9, 10) })).toBe(39);
  });
});

// ── §2 «رسائلي إلى نفسي» ────────────────────────────────────────────────────────────────────────────────────────

describe('«رسائلي إلى نفسي» (round 6 §2)', () => {
  it('add / edit / delete, at most 10, device-local HeartData', () => {
    let h = emptyHeart();
    for (let i = 0; i < SELF_MESSAGES_MAX; i++) h = addSelfMessage(h, { id: `m${i}`, text: `رسالة ${i}`, ...(i === 0 ? { planId: 'a' } : {}) }, at(i));
    expect(() => addSelfMessage(h, { id: 'x', text: 'زيادة' }, at(20))).toThrow(/full/);
    h = editSelfMessage(h, 'm1', '  تذكّر لماذا بدأت  ', at(21));
    expect(selfMessages(h)[0]?.id).toBe('m9');
    expect(selfMessages(h, 'a').map((m) => m.id)).toEqual(['m0']);
    expect(parseHeart(JSON.stringify(h)).messages?.find((m) => m.id === 'm1')?.text).toBe('تذكّر لماذا بدأت');
    h = removeSelfMessage(h, 'm1');
    expect(h.messages?.length).toBe(9);
    expect(() => addSelfMessage(h, { id: 'y', text: '   ' })).toThrow(/empty/);
  });
});

// ── §5 «قضاء الفوائت» ───────────────────────────────────────────────────────────────────────────────────────────

describe('«قضاء الفوائت» (round 6 §5)', () => {
  it('owed per prayer or total, a pace, logged make-ups and a progress circle; synced', () => {
    let s = setQadaPlan(emptyStore(), { owed: { fajr: 10, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, any: 20 }, perDay: 5, startedOn: '2026-11-08' }, at(1));
    s = logQada(s, { date: '2026-11-08', prayer: 'fajr', add: 12, today: TODAY }, at(2));
    s = logQada(s, { date: TODAY, prayer: 'any', add: 3, today: TODAY }, at(3));
    const p = qadaProgress(s, TODAY);
    expect(p).toMatchObject({ owedTotal: 30, doneTotal: 13, remaining: 17, percent: 43, today: 3, daysLeft: 4, expectedByToday: 10 });
    expect(p?.perKey.fajr).toEqual({ owed: 10, done: 10 });
    expect(p?.finishOn).toBe('2026-11-12');
    expect(() => logQada(s, { date: '2026-11-10', prayer: 'fajr', add: 1, today: TODAY })).toThrow();
    const c = localChanges(s);
    expect(c.settings?.qada).toEqual({ owed: { fajr: 10, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, any: 20 }, perDay: 5, startedOn: '2026-11-08' });
    expect(c.qadaLogs).toEqual([
      { date: '2026-11-08', prayer: 'fajr', count: 12, clientUpdatedAt: at(2) },
      { date: TODAY, prayer: 'any', count: 3, clientUpdatedAt: at(3) },
    ]);
    // Taking one back is a newer count.
    s = logQada(s, { date: TODAY, prayer: 'any', add: -1, today: TODAY }, at(4));
    expect(qadaProgress(s, TODAY)?.today).toBe(2);
    expect(() => setQadaPlan(s, { owed: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, any: 0 }, perDay: 1, startedOn: TODAY })).toThrow();
    expect(qadaProgress(setQadaPlan(s, null, at(9)), TODAY)).toBeNull();
  });
});

// ── §2 programs as habits ───────────────────────────────────────────────────────────────────────────────────────

describe('«تخفّف» programs as habits (round 6 §2)', () => {
  it('covered by default; one generic row while locked; the switch syncs', () => {
    const s = storeOf(plan('a'));
    const prog = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-11-01' }, NOW);
    expect(isLightenCovered(s)).toBe(true);
    expect(habitListRows(s, null, { hasPrograms: true }).map((r) => r.kind)).toEqual(['habit', 'lighten']);
    expect(habitListRows(s, null, { hasPrograms: true })[1]).toMatchObject({ covered: true, locked: true, program: null });
    expect(habitListRows(s, [prog])[1]).toMatchObject({ covered: true, locked: false, startedOn: '2026-11-01' });
    const off = setLightenCovered(s, false, at(1));
    expect(habitListRows(off, [prog])[1]).toMatchObject({ covered: false });
    expect(localChanges(off).settings?.lightenCovered).toBe(false);
    expect(JSON.stringify(localChanges(off))).not.toContain('ghibah');
    expect(setLightenCovered(off, true, at(2)).settings.lightenCovered).toBeUndefined();
  });
});

// ── §6 periodic acts ────────────────────────────────────────────────────────────────────────────────────────────

describe('periodic acts (round 6 §6)', () => {
  it('the catalog: «صلة الرحم والأحباب» first with every people list, then the owner’s acts, eight in all', () => {
    expect(PERIODIC_ACTS.map((a) => a.ar)).toEqual([
      'صلة الرحم والأحباب',
      'صدقة',
      'صيام الاثنين والخميس',
      'الأيام البيض',
      'ختمة القرآن',
      'زيارة القبور',
      'صيام يوم عرفة',
      'صيام عاشوراء',
    ]);
    expect(PERIODIC_ACTS[0]?.circles).toEqual(['kin', 'parents', 'neighbors', 'friends', 'sick']);
  });

  it('existing people are the people of «صلة الرحم والأحباب» (no migration); a custom act is periodic with reminders', () => {
    let s = storeOf(plan('sd', { habitKey: 'sadaqah-weekly', rule: { kind: 'weekdays', days: [5] } }));
    const rule = { kind: 'everyNDays' as const, n: 7, anchor: '2026-11-01' };
    s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule }, NOW), NOW);
    s = upsertRelative(s, createRelative({ id: 'r2', name: 'جاري', relation: '', rule, circle: 'neighbors' }, NOW), NOW);
    const custom = createCustomPeriodic({ id: 'c1', title: 'زيارة دار الأيتام', rule: { kind: 'monthlyDay', day: 1 }, slots: ['17:00'], createdOn: TODAY }, NOW);
    s = upsertPlan(s, custom, NOW);
    expect(activePeriodicActs(s).map((a) => [a.key, a.plans.length, a.relatives.length])).toEqual([
      ['silat', 0, 2],
      ['sadaqah', 1, 0],
      ['custom:c1', 1, 0],
    ]);
    expect(periodicActKeyOf(custom)).toBe('custom:c1');
    // A custom act is never a habit: no sapling place, no streak.
    const isPeriodicAct = (p: Plan) => p.habitKey === 'sadaqah-weekly';
    expect(limits(s, TODAY, { isPeriodicAct }).sapling.count).toBe(0);
    expect(limits(s, TODAY, { isPeriodicAct }).periodic.count).toBe(3);
    expect(() => createCustomPeriodic({ id: 'c2', title: 'x', rule: { kind: 'daily' }, slots: ['09:00'], createdOn: TODAY })).toThrow(/every day/);
    const due = notificationPlan({ store: s, prefs: DEFAULT_NOTIFICATION_PREFS, today: '2026-11-30', now: '08:00', days: 2 });
    expect(due.some((e) => e.kind === 'habit' && e.planId === 'c1' && e.date === '2026-12-01')).toBe(true);
  });
});

// ── read / unread, reciters ─────────────────────────────────────────────────────────────────────────────────────

describe('read / unread texts and reciters (round 6 §8)', () => {
  const Q = '5671bf91-6335-49b4-9011-61c74dd1c460';
  it('marks read and unread, last writer wins, synced', () => {
    let s = markRead(emptyStore(), Q.toUpperCase(), at(1));
    expect(isRead(s, Q)).toBe(true);
    expect(markRead(s, Q, at(2))).toBe(s);
    const c = localChanges(s);
    expect(c.reads).toEqual([{ quoteId: Q, read: true, clientUpdatedAt: at(1) }]);
    expect(countChanges(c)).toBe(1);
    s = markUnread(s, Q, at(3));
    expect(isRead(s, Q)).toBe(false);
    // An older «read» from another device does not win.
    s = applyServerChanges(s, { serverTime: at(9), settings: null, plans: [], logs: [], relatives: [], contacts: [], reads: [{ quoteId: Q, read: true, clientUpdatedAt: at(2) }] });
    expect(isRead(s, Q)).toBe(false);
    expect(() => markRead(s, 'not-a-uuid')).toThrow();
  });

  it('reciters: one constant of EveryAyah folders; the choice syncs with the settings', () => {
    expect(RECITERS.map((r) => r.folder)).toEqual([
      'Alafasy_128kbps',
      'Husary_128kbps',
      'Minshawy_Murattal_128kbps',
      'Abdul_Basit_Murattal_192kbps',
      'Ghamadi_40kbps',
      'Saood_ash-Shuraym_128kbps',
      'Abdurrahmaan_As-Sudais_192kbps',
    ]);
    expect(ayahAudioUrl(2, 255)).toBe('https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
    expect(ayahAudioUrl(1, 1, 'husary')).toBe('https://everyayah.com/data/Husary_128kbps/001001.mp3');
    expect(ayahAudioUrl(115, 1)).toBeNull();
    const s = setReciter(emptyStore(), 'sudais', at(1));
    expect(localChanges(s).settings?.reciter).toBe('sudais');
    expect(setReciter(s, 'alafasy', at(2)).settings.reciter).toBeUndefined();
    expect(() => setReciter(s, 'nobody')).toThrow();
  });
});

// ── §8 notifications ────────────────────────────────────────────────────────────────────────────────────────────

describe('notifications (round 6 §8, C-19)', () => {
  it('four tabs; every pref in exactly one tab except the shared review day', () => {
    expect(NOTIFICATION_GROUPS.map((g) => g.key)).toEqual(['habits', 'periodic', 'heart', 'strategies']);
    const all = NOTIFICATION_GROUPS.flatMap((g) => g.prefs);
    expect(new Set(all).size).toBe(all.length);
    for (const k of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
      if (k === 'reminderTimes') continue;
      expect(all, k).toContain(k);
    }
    // «محاسبة المساء» (the evening nudge) sits under «النية والمحاسبة» on both clients.
    expect(NOTIFICATION_GROUPS.find((g) => g.key === 'heart')?.prefs).toEqual(expect.arrayContaining(['eveningNudge', 'eveningTime']));
    expect(NOTIFICATION_GROUPS.find((g) => g.key === 'habits')?.prefs).not.toContain('eveningNudge');
  });

  it('muted plans and acts, and the intention reminder', () => {
    let s = storeOf(plan('a'), plan('b'));
    s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 1, anchor: TODAY } }, NOW), NOW);
    const prefs = parseNotificationPrefs({ mutedPlans: ['a'], mutedActs: ['silat'], intentionReminder: true, intentionTime: '07:00' });
    const plan2 = notificationPlan({ store: s, prefs, today: TODAY, now: '06:00', days: 1, intentionDoneOn: () => false });
    expect(plan2.some((e) => e.planId === 'a')).toBe(false);
    expect(plan2.some((e) => e.planId === 'b')).toBe(true);
    expect(plan2.some((e) => e.kind === 'periodic')).toBe(false);
    expect(plan2.find((e) => e.kind === 'intention')).toMatchObject({ date: TODAY, time: '07:00' });
    expect(notificationPlan({ store: s, prefs, today: TODAY, now: '06:00', days: 1, intentionDoneOn: () => true }).some((e) => e.kind === 'intention')).toBe(false);
  });
});

// ── sync and parsing of everything new ──────────────────────────────────────────────────────────────────────────

describe('round 6 sync and storage', () => {
  it('a store with every new field survives serialize/parse and a full sync round trip to an empty device', () => {
    let s = storeOf(setMinimum(plan('a'), 3, NOW));
    s = updatePlan(s, 'a', (p) => ({ ...p, restartedOn: '2026-11-01' }), at(1));
    s = setDayState(s, TODAY, 'travel', TODAY, at(2));
    s = setQadaPlan(s, { owed: { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1, any: 0 }, perDay: 2, startedOn: TODAY }, at(3));
    s = setReciter(setLightenCovered(s, false, at(4)), 'husary', at(5));
    s = setReflection(s, { planId: 'a', date: TODAY, today: TODAY, helped: 'نعم' }, at(6));
    s = logQada(s, { date: TODAY, prayer: 'isha', add: 1, today: TODAY }, at(7));
    s = markRead(s, '5671bf91-6335-49b4-9011-61c74dd1c460', at(8));
    expect(parseStore(serializeStore(s))).toEqual(parseStore(s));
    const c = localChanges(s);
    const response = {
      serverTime: at(30),
      settings: c.settings ? { ...c.settings } : null,
      plans: c.plans,
      logs: c.logs,
      relatives: c.relatives,
      contacts: c.contacts,
      reflections: c.reflections,
      qadaLogs: c.qadaLogs,
      reads: c.reads,
    };
    const other = applyServerChanges(emptyStore(), response);
    expect(other.plans[0]).toMatchObject({ minimum: 3, startAmount: 10, restartedOn: '2026-11-01' });
    expect(other.settings).toMatchObject({ dayStates: [{ date: TODAY, state: 'travel' }], excusedDays: [TODAY], lightenCovered: false, reciter: 'husary' });
    expect(other.settings.qada?.perDay).toBe(2);
    expect(other.reflections).toEqual(s.reflections);
    expect(other.qadaLogs).toEqual(s.qadaLogs);
    expect(other.reads).toEqual(s.reads);
    // The device that sent them holds everything acked after the echo.
    const acked = applyServerChanges(s, response);
    expect(countChanges(localChanges(acked))).toBe(0);
  });

  it('settings content: round-6 fields only when set, so older settings keep their content', () => {
    expect(settingsContent({ hijriOffset: 0 })).toBe('{"hijriOffset":0,"reminderTimes":[],"freeMinutesPerDay":null}');
    expect(settingsContent({ hijriOffset: 0, lightenCovered: true, dayStates: [], qada: null, reciter: null })).toBe(
      '{"hijriOffset":0,"reminderTimes":[],"freeMinutesPerDay":null}',
    );
  });
});

describe('strategy families (C-18 a, shared by web and app)', () => {
  it('gives every strategy one family; «ترك» never «طبّقها على عادة»; «لا تفوّتها مرتين» unlisted', () => {
    for (const strategy of STRATEGIES) {
      expect(STRATEGY_KINDS).toContain(strategy.kind);
      expect(strategyKind(strategy.key)).toBe(strategy.kind);
      if (strategy.kind === 'leave') expect(strategyAppliesToHabit(strategy.key)).toBe(false);
    }
    expect(listedStrategies().map((s) => s.key)).not.toContain('never-twice');
    expect(listedStrategies()).toHaveLength(STRATEGIES.length - 1);
    expect(listedStrategies('leave').map((s) => s.key)).toEqual(['block-sin', 'know-weak', 'ride-wave', 'follow-good']);
    expect(listedStrategies('return').map((s) => s.key)).toEqual(['make-up', 'self-review']);
    expect(STRATEGIES.filter((s) => s.kind === 'return').map((s) => s.key)).toEqual(['never-twice', 'make-up', 'self-review']);
    expect(strategyAppliesToHabit('start-tiny')).toBe(true);
    expect(strategyAppliesToHabit('never-twice')).toBe(false);
    expect(strategyKind('unknown')).toBe('build');
  });
});
