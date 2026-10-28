import { describe, expect, it } from 'vitest';
import {
  base64UrlToUint8Array,
  isAppleMobile,
  isSameServerKey,
  needsHomeScreenInstall,
  pushCardState,
  type PushCardInput,
} from './push-support';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('base64UrlToUint8Array', () => {
  it('decodes base64url with and without padding', () => {
    // 0xfb 0xff 0xfe uses both url-safe characters ('-' and '_').
    expect([...base64UrlToUint8Array('-__-')]).toEqual([0xfb, 0xff, 0xfe]);
    expect([...base64UrlToUint8Array('AQ')]).toEqual([1]);
    expect([...base64UrlToUint8Array('AQ==')]).toEqual([1]);
    expect([...base64UrlToUint8Array('AQI')]).toEqual([1, 2]);
  });

  it('decodes a 65-byte VAPID public key', () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, index) => (index * 37 + 4) % 256);
    const encoded = Buffer.from(bytes).toString('base64url');
    expect(encoded).not.toContain('=');
    expect(base64UrlToUint8Array(encoded)).toEqual(bytes);
  });
});

describe('isSameServerKey', () => {
  const key = Uint8Array.from([4, 1, 2, 3]);

  it('matches the same bytes and refuses other keys', () => {
    expect(isSameServerKey(Uint8Array.from([4, 1, 2, 3]).buffer, key)).toBe(true);
    expect(isSameServerKey(Uint8Array.from([4, 1, 2, 9]).buffer, key)).toBe(false);
    expect(isSameServerKey(Uint8Array.from([4, 1, 2]).buffer, key)).toBe(false);
  });

  it('treats an unreported key as matching (no resubscribe on every visit)', () => {
    expect(isSameServerKey(null, key)).toBe(true);
    expect(isSameServerKey(undefined, key)).toBe(true);
  });
});

describe('iPhone/iPad detection', () => {
  it('recognises iPhone and an iPad that reports itself as a Mac', () => {
    expect(isAppleMobile({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 0 })).toBe(false);
    expect(isAppleMobile({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe(false);
  });

  it('asks for the home screen only when not opened from the icon', () => {
    expect(needsHomeScreenInstall({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(true);
    expect(needsHomeScreenInstall({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe(false);
    expect(needsHomeScreenInstall({ userAgent: ANDROID_CHROME, maxTouchPoints: 5, standalone: false })).toBe(false);
  });
});

describe('pushCardState', () => {
  const ready: PushCardInput = {
    accounts: true,
    device: 'push',
    serverEnabled: true,
    sessionLoading: false,
    signedIn: true,
    browser: { permission: 'default', subscribed: false },
  };
  const state = (change: Partial<PushCardInput>) => pushCardState({ ...ready, ...change });

  it('hides the card when push cannot work here or is still unknown', () => {
    expect(state({ accounts: false })).toBe('hidden');
    expect(state({ serverEnabled: false })).toBe('hidden');
    expect(state({ serverEnabled: undefined })).toBe('hidden');
    expect(state({ device: 'unknown' })).toBe('hidden');
    expect(state({ sessionLoading: true })).toBe('hidden');
    expect(state({ browser: undefined })).toBe('hidden');
  });

  it('explains the device before asking to sign in', () => {
    expect(state({ device: 'iosInstall', signedIn: false })).toBe('iosInstall');
    expect(state({ device: 'none', signedIn: false })).toBe('unsupported');
    expect(state({ signedIn: false, browser: undefined })).toBe('signedOut');
  });

  it('follows the permission and the subscription', () => {
    expect(state({})).toBe('off');
    expect(state({ browser: { permission: 'denied', subscribed: false } })).toBe('denied');
    expect(state({ browser: { permission: 'granted', subscribed: false } })).toBe('off');
    expect(state({ browser: { permission: 'granted', subscribed: true } })).toBe('on');
    // A subscription left behind after the permission was withdrawn is not «on».
    expect(state({ browser: { permission: 'default', subscribed: true } })).toBe('off');
  });
});
