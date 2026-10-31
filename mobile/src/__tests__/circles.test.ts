/**
 * «رفقة»: what counts as «حضرت اليوم» (never the sin program), the invite link and code helpers, the error sentences,
 * and the circle strings (both languages, Arabic plural forms, no em or en dash).
 */

import i18next from 'i18next';
import { emptyStore, type Plan, type Relative, type Store } from '@thekra/practice-core';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { circleErrorKey, cleanTypedCode, formatInviteCode, inviteLink, loggedOn } from '../lib/circles/circle-view';
import { ApiError } from '../lib/types/api';

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
