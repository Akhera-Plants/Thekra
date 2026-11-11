import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFS, makeIntention, setHeartPrefs } from '@thekra/practice-core';
import { HEART_KEY, getHeartSnapshot, resetHeartForTests, updateHeart } from './heart-store';
import { notificationPrefsOf, parsePrefs } from './local-store';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function installWindow(storage: unknown): void {
  (globalThis as { window?: unknown }).window = {
    get localStorage() {
      if (storage === 'throw') throw new Error('SecurityError');
      return storage;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  resetHeartForTests();
});

describe('heart store (device-local «المقامات»)', () => {
  it('saves and reads back through practice-core', () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateHeart((h) => makeIntention(setHeartPrefs(h, { intention: true }), { date: '2026-10-28', planIds: ['a'], pledge: 'سطر' }));
    expect(JSON.parse(storage.getItem(HEART_KEY) ?? '{}').intentions[0].pledge).toBe('سطر');
    resetHeartForTests();
    expect(getHeartSnapshot().prefs.intention).toBe(true);
  });

  it('keeps working in memory when storage throws', () => {
    installWindow('throw');
    updateHeart((h) => setHeartPrefs(h, { pledges: true }));
    expect(getHeartSnapshot().prefs.pledges).toBe(true);
  });
});

describe('notification prefs on the web', () => {
  it('defaults until set, and parses defensively', () => {
    expect(notificationPrefsOf({})).toEqual(DEFAULT_NOTIFICATION_PREFS);
    const { prefs } = parsePrefs(JSON.stringify({ notify: { eveningNudge: true, eveningTime: 'x' } }));
    expect(notificationPrefsOf(prefs)).toEqual({ ...DEFAULT_NOTIFICATION_PREFS, eveningNudge: true });
  });
});
