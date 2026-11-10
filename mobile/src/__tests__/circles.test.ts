/**
 * «صحبة»: what counts as «حضرت اليوم» (never the sin program), the invite link and code helpers, the error sentences,
 * and the circle strings (both languages, Arabic plural forms, no em or en dash).
 */

import i18next from 'i18next';
import { emptyStore, type Plan, type Relative, type Store } from '@thekra/practice-core';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import {
  circleErrorKey,
  cleanTypedCode,
  formatInviteCode,
  groupByDay,
  habitProgress,
  inviteLink,
  loggedOn,
  messageText,
  roundLine,
  wasSentToday,
} from '../lib/circles/circle-view';
import { ApiError } from '../lib/types/api';
import { PRESET_GROUPS, REPORT_REASONS, ROUND_CHEERS, ROUND_CONGRATS, ROUND_KINDS, type CircleMessage } from '../lib/types/circles';

const DAY = '2026-10-29';

function storeWith(parts: Partial<Store>): Store {
  return { ...emptyStore(), ...parts };
}

describe('loggedOn', () => {
  it('is true for a habit amount or a contact on that date only', () => {
    const plan = { log: { [DAY]: 5, '2026-10-28': 0 } } as unknown as Plan;
    const relative = { history: ['2026-10-27'] } as unknown as Relative;
    expect(loggedOn(storeWith({ plans: [plan] }), DAY)).toBe(true);
    expect(loggedOn(storeWith({ plans: [plan] }), '2026-10-28')).toBe(false);
    expect(loggedOn(storeWith({ relatives: [relative] }), '2026-10-27')).toBe(true);
    expect(loggedOn(storeWith({ relatives: [relative] }), DAY)).toBe(false);
  });

  it('never counts the sin program', () => {
    const programs = [{ checkIns: [{ date: DAY }], endedAt: null }] as unknown as Store['programs'];
    expect(loggedOn(storeWith({ programs }), DAY)).toBe(false);
  });
});

describe('invite helpers', () => {
  it('builds the app link and groups the code', () => {
    expect(inviteLink('ABCDEFGHJK')).toBe('thekra://circles/join?code=ABCDEFGHJK');
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(cleanTypedCode(' abcde-fghjk!؟ ')).toBe(' abcde-fghjk ');
  });
});

describe('circleErrorKey', () => {
  const error = (code: string, status: number) => new ApiError({ code, message: 'x', status });
  it('maps API codes to calm sentences', () => {
    expect(circleErrorKey(error('CIRCLE_INVITE_INVALID', 404))).toBe('circles.errors.inviteInvalid');
    expect(circleErrorKey(error('CIRCLE_FULL', 409))).toBe('circles.errors.full');
    expect(circleErrorKey(error('CIRCLE_LIMIT_REACHED', 409))).toBe('circles.errors.limit');
    expect(circleErrorKey(error('CIRCLE_CHEER_ALREADY_SENT', 409))).toBe('circles.errors.cheerSent');
    expect(circleErrorKey(error('THROTTLED', 429))).toBe('circles.errors.tooManyTries');
    expect(circleErrorKey(error('NETWORK_ERROR', 0))).toBe('errors.network');
    expect(circleErrorKey(error('SOMETHING_ELSE', 500))).toBe('circles.errors.generic');
    expect(circleErrorKey(new Error('x'))).toBe('circles.errors.generic');
  });
});

describe('circle strings', () => {
  const i18n = i18next.createInstance();
  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  function keys(obj: object, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]));
  }
  const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

  it('exist in both languages and carry no em or en dash', () => {
    const arKeys = new Set(keys(ar.circles).map(base));
    const enKeys = new Set(keys(en.circles).map(base));
    expect([...arKeys].sort()).toEqual([...enKeys].sort());
    expect(JSON.stringify([ar.circles, en.circles])).not.toMatch(/[–—]/);
  });

  it('counts members with the Arabic forms', () => {
    const t = i18n.getFixedT('ar');
    expect(t('circles.members', { count: 1 })).toBe('عضو واحد');
    expect(t('circles.members', { count: 2 })).toBe('عضوان');
    expect(t('circles.members', { count: 3 })).toBe('3 أعضاء');
    expect(t('circles.members', { count: 11 })).toBe('11 عضوًا');
    expect(i18n.getFixedT('en')('circles.members', { count: 12 })).toBe('12 members');
  });
});

// ── Owner round 7 (D1, D5–D8) ────────────────────────────────────────────────

describe('round 7: «صحبة»', () => {
  const i18n = i18next.createInstance();
  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  it('D1: the feature is «صحبة»; «رفقة» is gone from the app copy', () => {
    expect(JSON.stringify(ar)).not.toMatch(/رفق(ة|ت|ات)/);
    expect(ar.circles.title).toBe('صحبة');
    expect(ar.more.items.circles).toBe('صحبة');
    expect(ar.circles.weekTitle).toBe('إنجازات الصحبة خلال آخر 7 أيام');
  });

  it('every line, round kind, reply and reason has words in both languages', () => {
    for (const lang of [ar, en]) {
      const c = lang.circles as unknown as Record<string, Record<string, unknown>>;
      for (const key of Object.values(PRESET_GROUPS).flat()) expect(c.lines[key]).toBeTruthy();
      for (const key of [...PRESET_GROUPS.encourage, ...PRESET_GROUPS.remind]) expect(c.linesTo[key]).toBeTruthy();
      const round = c.round as Record<string, Record<string, string>>;
      for (const kind of ROUND_KINDS) expect(round.kinds[kind]).toBeTruthy();
      for (const key of [...ROUND_CHEERS, ...ROUND_CONGRATS]) expect(round.replies[key]).toBeTruthy();
      for (const reason of REPORT_REASONS) expect((c.report as Record<string, Record<string, string>>).reasons[reason]).toBeTruthy();
    }
  });

  it('D6: no quoted text in the suggested lines (no «» quotes, no ﷺ)', () => {
    const lines = JSON.stringify([ar.circles.lines, ar.circles.linesTo, ar.circles.round.replies]);
    expect(lines).not.toMatch(/[«»ﷺ]/);
  });

  const message = (over: Partial<CircleMessage>): CircleMessage => ({
    id: 'm',
    kind: 'preset',
    key: 'thabat',
    from: { memberId: 'a', name: 'سالم', isMe: false },
    to: null,
    progress: null,
    round: null,
    saved: false,
    createdAt: '2026-11-10T09:00:00.000Z',
    ...over,
  });
  const round = {
    id: 'r',
    memberId: 'a',
    memberName: 'سالم',
    isMine: false,
    kind: 'study' as const,
    label: 'compiler design',
    minutes: 60,
    number: 4,
    startedAt: '2026-11-10T09:00:00.000Z',
    endsAt: '2026-11-10T10:00:00.000Z',
    outcome: null,
    closed: false,
    myReplies: [],
  };

  it('D5/D7: the words of each kind of line, as shown and copied', () => {
    const t = i18n.getFixedT('ar');
    expect(roundLine(t, round)).toBe('بدأت جولة مذاكرة · \u2068compiler design\u2069 · 60 دقيقة');
    expect(roundLine(t, { kind: 'task', label: null, minutes: 15 })).toBe('بدأت جولة مهمة · 15 دقيقة');
    expect(messageText(t, message({}))).toBe('دعوت لكم بالثبات');
    expect(messageText(t, message({ to: { memberId: 'b', name: 'أحمد', isMe: true } }))).toBe('دعوت لك بالثبات');
    expect(messageText(t, message({ key: 'progress', progress: { done: 2, total: 3 } }))).toBe('أنجزت 2 من 3 من عاداتي اليوم');
    expect(messageText(t, message({ key: 'progress', progress: { done: 3, total: 3 } }))).toBe('أتممت عاداتي اليوم كلها، الحمد لله');
    expect(messageText(t, message({ kind: 'round_start', key: null, round }))).toBe('بدأت جولة مذاكرة · \u2068compiler design\u2069 · 60 دقيقة');
    expect(messageText(t, message({ kind: 'round_end', key: null, round: { ...round, outcome: 'done' } }))).toBe('تم الحمد لله');
    expect(messageText(t, message({ kind: 'round_end', key: null, round: { ...round, outcome: 'not_done' } }))).toBe('لم يتم');
    expect(messageText(t, message({ kind: 'reply', key: 'barak', round }))).toBe('بارك الله في وقتك');
    expect(i18n.getFixedT('en')('circles.round.minutes', { count: 1 })).toBe('1 minute');
    expect(t('circles.round.minutes', { count: 45 })).toBe('45 دقيقة');
  });

  it('D6: progress is two numbers of today\'s habits only (never the sin program or relatives)', () => {
    expect(habitProgress([])).toBeNull();
    expect(
      habitProgress([
        { kind: 'habit', planId: 'p1', required: 1, done: 1, remaining: 0, complete: true },
        { kind: 'habit', planId: 'p2', required: 2, done: 0, remaining: 2, complete: false },
        { kind: 'program', done: true },
        { kind: 'relative', relativeId: 'r', done: true, overdueDays: 0 },
      ] as never),
    ).toEqual({ done: 1, total: 2 });
    expect(wasSentToday(['thabat:circle', 'jazak:m2'], 'thabat')).toBe(true);
    expect(wasSentToday(['thabat:circle', 'jazak:m2'], 'jazak', 'm3')).toBe(false);
  });

  it('D7: the feed reads oldest first, cut into local days', () => {
    const days = groupByDay([
      message({ id: 'c', createdAt: '2026-11-10T12:00:00' }),
      message({ id: 'b', createdAt: '2026-11-10T08:00:00' }),
      message({ id: 'a', createdAt: '2026-11-09T20:00:00' }),
    ]);
    expect(days.map((d) => [d.date, d.messages.map((m) => m.id)])).toEqual([
      ['2026-11-09', ['a']],
      ['2026-11-10', ['b', 'c']],
    ]);
  });

  it('maps the round-7 API codes to calm sentences', () => {
    const error = (code: string, status: number) => new ApiError({ code, message: 'x', status });
    expect(circleErrorKey(error('CIRCLE_ROUND_OPEN', 409))).toBe('circles.errors.roundOpen');
    expect(circleErrorKey(error('CIRCLE_REPORTS_LIMIT', 429))).toBe('circles.errors.reportsLimit');
    expect(circleErrorKey(error('THROTTLED', 429))).toBe('circles.errors.tooManyTries');
    expect(circleErrorKey(error('CIRCLE_MESSAGE_NOT_FOUND', 404))).toBe('circles.errors.messageGone');
  });
});
