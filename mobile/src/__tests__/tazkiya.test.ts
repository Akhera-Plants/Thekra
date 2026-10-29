/**
 * Tazkiya on the app: the private journal lives under its own device key (never the synced practice store), an
 * invalid edit leaves it unchanged, «احذف الدفتر كله» removes the key, and its strings exist in both languages
 * without dashes.
 */

import { setNiyyah } from '@thekra/practice-core';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void mockStorage.set(key, value)),
    removeItem: jest.fn(async (key: string) => void mockStorage.delete(key)),
  },
}));

import { TAZKIYA_KEY, useTazkiyaStore } from '../lib/practice/tazkiya-store';
import { STORE_KEY } from '../lib/practice/practice-store';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('tazkiya journal store', () => {
  it('keeps the journal under its own key, apart from the synced store', async () => {
    expect(TAZKIYA_KEY).not.toBe(STORE_KEY);
    mockStorage.set(TAZKIYA_KEY, JSON.stringify({ v: 1, days: [{ date: '2026-10-28', niyyah: { planId: 'p1', title: 'الضحى', at: '2026-10-28T06:00:00.000Z' } }], dismissed: [] }));
    await useTazkiyaStore.getState().hydrate();
    expect(useTazkiyaStore.getState().journal.days.map((d) => d.date)).toEqual(['2026-10-28']);

    useTazkiyaStore.getState().update((j) => setNiyyah(j, '2026-10-29', { planId: 'p2', title: 'الوتر' }, '2026-10-29T06:00:00.000Z'));
    await flush();
    expect(JSON.parse(mockStorage.get(TAZKIYA_KEY) ?? '{}').days.map((d: { date: string }) => d.date)).toEqual(['2026-10-29', '2026-10-28']);
    expect(mockStorage.has(STORE_KEY)).toBe(false);
  });

  it('ignores an invalid edit and clears the whole notebook', async () => {
    const before = useTazkiyaStore.getState().journal;
    useTazkiyaStore.getState().update((j) => setNiyyah(j, 'not-a-day', { planId: 'p1', title: 'x' }));
    expect(useTazkiyaStore.getState().journal).toBe(before);
    await useTazkiyaStore.getState().clear();
    expect(useTazkiyaStore.getState().journal.days).toEqual([]);
    expect(mockStorage.has(TAZKIYA_KEY)).toBe(false);
  });
});

describe('tazkiya strings', () => {
  it('has the same keys in Arabic and English, with no em or en dash', () => {
    expect(Object.keys(en.tazkiya).sort()).toEqual(Object.keys(ar.tazkiya).sort());
    expect(JSON.stringify([ar.tazkiya, en.tazkiya])).not.toMatch(/[—–]/);
  });
});
