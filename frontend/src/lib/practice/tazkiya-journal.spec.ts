import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMuhasaba, setNiyyah } from '@thekra/practice-core';

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

const T = '2026-10-29T06:00:00.000Z';

async function freshModule(storage: unknown) {
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  vi.resetModules();
  return import('./tazkiya-journal');
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('tazkiya journal (this browser only)', () => {
  it('saves under its own key, apart from the synced practice store, newest day first', async () => {
    const storage = new MemoryStorage();
    const { TAZKIYA_KEY, getJournalSnapshot, updateJournal } = await freshModule(storage);
    expect(TAZKIYA_KEY).not.toBe('thekra.practice.v1');
    updateJournal((j) => setNiyyah(j, '2026-10-28', { planId: 'p1', title: 'الضحى' }, T));
    updateJournal((j) => setMuhasaba(j, '2026-10-29', { answers: { tomorrow: 'ركعتان' }, thanked: true }, T));
    expect(getJournalSnapshot().days.map((d) => d.date)).toEqual(['2026-10-29', '2026-10-28']);
    expect(JSON.parse(storage.getItem(TAZKIYA_KEY) ?? '{}').days).toHaveLength(2);
    expect(storage.getItem('thekra.practice.v1')).toBeNull();
  });

  it('reads what the app or another tab wrote, ignores an invalid edit, and clears everything', async () => {
    const storage = new MemoryStorage();
    storage.setItem('thekra.tazkiya.v1', JSON.stringify({ v: 1, days: [{ date: '2026-10-27', muhasaba: { answers: {}, thanked: true, at: T } }], dismissed: [] }));
    const { getJournalSnapshot, updateJournal, clearJournal, TAZKIYA_KEY } = await freshModule(storage);
    const before = getJournalSnapshot();
    expect(before.days).toHaveLength(1);
    updateJournal((j) => setMuhasaba(j, '2026-10-28', { answers: {}, thanked: false }, T));
    expect(getJournalSnapshot()).toBe(before);
    clearJournal();
    expect(getJournalSnapshot().days).toEqual([]);
    expect(storage.getItem(TAZKIYA_KEY)).toBeNull();
  });

  it('keeps working in memory when the browser refuses storage', async () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    const { getJournalSnapshot, updateJournal } = await freshModule(refusing);
    updateJournal((j) => setNiyyah(j, '2026-10-29', { planId: 'p1', title: 'الضحى' }, T));
    expect(getJournalSnapshot().days).toHaveLength(1);
  });
});
