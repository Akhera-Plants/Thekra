import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startProgram, ownerRelation, type SinProgram } from '@thekra/practice-core';

// A stand-in for the WebCrypto device key (the real one needs IndexedDB): reversible, key presence is switchable.
const fake = vi.hoisted(() => ({ hasKey: false, fail: false }));
vi.mock('./device-key', () => ({
  canSealOnDevice: () => !fake.fail,
  sealText: async (plain: string) => {
    if (fake.fail) throw new Error('no');
    fake.hasKey = true;
    return `v1.${btoa(unescape(encodeURIComponent(plain)))}.x`;
  },
  openText: async (text: string) => {
    if (!fake.hasKey) return { status: 'nokey' };
    const parts = text.split('.');
    if (parts.length !== 3) return { status: 'bad' };
    return { status: 'ok', text: decodeURIComponent(escape(atob(parts[1] as string))) };
  },
  forgetDeviceKey: async () => {
    fake.hasKey = false;
  },
}));

import { HEART_KEY, getHeartSnapshot, resetHeartForTests, updateHeart } from './heart-store';
import {
  PENDING_PROGRAM_KEY,
  PREFS_KEY,
  SIN_KEY,
  STORE_KEY,
  getPracticeSnapshot,
  getReadyPracticeSnapshot,
  resetPracticeSnapshotForTests,
  setPendingProgram,
  updatePrefs,
  updateStore,
  wipeLocalPractice,
} from './local-store';
import { wipeAllLocalPractice } from './local-wipe';
import { MY_REMINDERS_KEY, myRemindersStore } from './screen-stores';
import { addSelfMessage } from '@thekra/practice-core';

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
  dump(): string {
    return JSON.stringify([...this.data.entries()]);
  }
}

function installWindow(storage: MemoryStorage): void {
  (globalThis as { window?: unknown }).window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

function program(slug = 'ghibah'): SinProgram {
  return startProgram({ sinSlug: slug, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-28' });
}

beforeEach(() => {
  fake.hasKey = false;
  fake.fail = false;
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  resetPracticeSnapshotForTests();
  resetHeartForTests();
  myRemindersStore.reset();
});

describe('sin programs at rest', () => {
  it('are stored sealed: no sin name anywhere in storage', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah'), program('kadhib')] }));
    await settle();
    expect(storage.getItem(SIN_KEY)).toMatch(/^v1\./);
    expect(storage.dump()).not.toContain('ghibah');
    expect(storage.dump()).not.toContain('kadhib');
    expect(getPracticeSnapshot().store.programs).toHaveLength(2);
  });

  it('are opened again on the next load, and screens wait for them', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah')] }));
    await settle();
    resetPracticeSnapshotForTests();
    expect(getReadyPracticeSnapshot()).toBeNull(); // opening: the shell, never «no program»
    await settle();
    expect(getReadyPracticeSnapshot()?.store.programs.map((p) => p.sinSlug)).toEqual(['ghibah']);
  });

  it('a sealed copy whose key is gone is dropped, not shown and not kept', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah')] }));
    await settle();
    fake.hasKey = false;
    resetPracticeSnapshotForTests();
    getPracticeSnapshot();
    await settle();
    expect(getReadyPracticeSnapshot()?.store.programs).toEqual([]);
    expect(storage.getItem(SIN_KEY)).toBeNull();
  });

  it('old clear programs are sealed once and then removed from the plain store', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORE_KEY,
      JSON.stringify({ v: 2, plans: [], relatives: [], programs: [program('ghibah')], settings: { hijriOffset: 0 }, tombstones: [], sync: { lastSyncedAt: null, acked: {} } }),
    );
    installWindow(storage);
    expect(getPracticeSnapshot().store.programs).toHaveLength(1); // nothing lost while sealing
    await settle();
    expect(storage.getItem(STORE_KEY)).not.toContain('ghibah');
    expect(storage.getItem(SIN_KEY)).toMatch(/^v1\./);
    expect(getPracticeSnapshot().store.programs).toHaveLength(1);
  });

  it('old clear programs stay (not lost) while sealing is not possible, and are never written anew in clear', async () => {
    fake.fail = true;
    const storage = new MemoryStorage();
    storage.setItem(
      STORE_KEY,
      JSON.stringify({ v: 2, plans: [], relatives: [], programs: [program('ghibah')], settings: { hijriOffset: 0 }, tombstones: [], sync: { lastSyncedAt: null, acked: {} } }),
    );
    installWindow(storage);
    getPracticeSnapshot();
    await settle();
    expect(storage.getItem(STORE_KEY)).toContain('ghibah');
    expect(storage.getItem(SIN_KEY)).toBeNull();
  });

  it('a program that cannot be sealed lives in memory only and says it is not kept', async () => {
    fake.fail = true;
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah')] }));
    await settle();
    expect(storage.dump()).not.toContain('ghibah');
    expect(getPracticeSnapshot().persistent).toBe(false);
    expect(getPracticeSnapshot().store.programs).toHaveLength(1);
  });
});

describe('sign-out wipe', () => {
  it('removes habits, programs, the sealed copy, its key, the hand-off, heart data and reminders, and the account link', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah')], settings: { hijriOffset: 2 } }));
    updatePrefs((prefs) => ({ ...prefs, syncedUserId: 'user-c', showHijri: true }));
    setPendingProgram('kadhib');
    updateHeart((heart) => addSelfMessage(heart, { id: '11111111-1111-4111-8111-111111111111', text: 'رسالة سرية' }));
    myRemindersStore.update(() => [{ id: 'r1', text: 'تذكير سري', createdAt: '2026-10-28T10:00:00.000Z' }]);
    await settle();
    expect(storage.getItem(SIN_KEY)).not.toBeNull();
    expect(fake.hasKey).toBe(true);
    expect(storage.getItem(MY_REMINDERS_KEY)).toContain('تذكير سري');
    expect(storage.getItem(HEART_KEY)).toContain('رسالة سرية');

    await wipeAllLocalPractice();

    expect(storage.getItem(SIN_KEY)).toBeNull();
    expect(storage.getItem(PENDING_PROGRAM_KEY)).toBeNull();
    expect(storage.getItem(HEART_KEY)).toBeNull();
    expect(storage.getItem(MY_REMINDERS_KEY)).toBeNull();
    expect(storage.dump()).not.toContain('ghibah');
    expect(storage.dump()).not.toContain('kadhib');
    expect(storage.dump()).not.toContain('رسالة سرية');
    expect(storage.dump()).not.toContain('user-c');
    expect(fake.hasKey).toBe(false);
    const snap = getPracticeSnapshot();
    expect(snap.store.programs).toEqual([]);
    expect(snap.store.plans).toEqual([]);
    expect(snap.store.settings.hijriOffset).toBe(0);
    expect(snap.prefs.syncedUserId).toBeUndefined();
    expect(snap.prefs.showHijri).toBe(true); // a display preference, not personal data
    expect(getHeartSnapshot().messages ?? []).toEqual([]);
  });

  it('a seal that was still running does not bring the programs back after the wipe', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => ({ ...store, programs: [program('ghibah')] }));
    await wipeLocalPractice(); // before the seal finished
    await settle();
    expect(storage.getItem(SIN_KEY)).toBeNull();
    expect(storage.dump()).not.toContain('ghibah');
  });

  it('the next account starts empty: the copy of the previous one is gone, not merged', async () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updatePrefs((prefs) => ({ ...prefs, syncedUserId: 'user-c' }));
    updateStore((store) => ({ ...store, programs: [program('ghibah')] }));
    expect(ownerRelation(getPracticeSnapshot().prefs.syncedUserId, 'user-d')).toBe('other');
    await wipeAllLocalPractice();
    expect(ownerRelation(getPracticeSnapshot().prefs.syncedUserId, 'user-d')).toBe('guest');
    expect(storage.getItem(PREFS_KEY)).not.toContain('user-c');
  });
});
