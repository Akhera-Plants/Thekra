/**
 * The time picker's display (device 12/24-hour, Western digits) and start value, the sin-program lock pref
 * (off by default, kept when saved), and the new Settings strings in both languages.
 */

import i18next from 'i18next';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';
import { displayTime, nowTime, timeToDate } from '../lib/practice/format';
import { DEFAULT_PREFS, parsePrefs } from '../lib/practice/prefs';

const AR_PERIOD = { am: 'ص', pm: 'م' };

describe('displayTime', () => {
  it('keeps HH:MM on a 24-hour device', () => {
    expect(displayTime('21:05', true, AR_PERIOD)).toBe('21:05');
  });

  it('shows a 12-hour clock with the day period', () => {
    expect(displayTime('21:05', false, AR_PERIOD)).toBe('9:05 م');
    expect(displayTime('00:30', false, { am: 'AM', pm: 'PM' })).toBe('12:30 AM');
    expect(displayTime('12:00', false, { am: 'AM', pm: 'PM' })).toBe('12:00 PM');
  });
});

describe('timeToDate', () => {
  it('round-trips through the picker value', () => {
    const date = timeToDate('06:45', new Date(2026, 9, 29, 13, 0));
    expect(date.getFullYear()).toBe(2026);
    expect(nowTime(date)).toBe('06:45');
  });
});

describe('sin-program lock pref', () => {
  it('is off by default and kept when saved', () => {
    expect(DEFAULT_PREFS.sinLock).toBe(false);
    expect(parsePrefs(JSON.stringify({ ...DEFAULT_PREFS, sinLock: true })).sinLock).toBe(true);
    expect(parsePrefs(JSON.stringify({ v: 1 })).sinLock).toBe(false);
  });
});

describe('settings strings', () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  it('counts scheduled reminders with the Arabic plural forms', () => {
    const t = i18n.getFixedT('ar');
    expect(t('settings.remindersCount', { count: 0 })).toBe('لا تذكيرات مجدولة على هذا الجهاز الآن.');
    expect(t('settings.remindersCount', { count: 2 })).toBe('تذكيران مجدولان على هذا الجهاز.');
    expect(t('settings.remindersCount', { count: 14 })).toBe('14 تذكيرًا مجدولًا على هذا الجهاز.');
  });

  it('has every lock and settings key in both languages', () => {
    for (const key of ['switch', 'switchHint', 'prompt', 'confirmPrompt', 'lockedTitle', 'lockedHint', 'unlock']) {
      expect(i18n.getFixedT('ar')(`sinLock.${key}`)).not.toBe(`sinLock.${key}`);
      expect(i18n.getFixedT('en')(`sinLock.${key}`)).not.toBe(`sinLock.${key}`);
    }
    expect(i18n.getFixedT('en')('settings.privacyPolicy')).toBe('Privacy policy');
  });
});
