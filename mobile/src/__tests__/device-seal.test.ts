/**
 * «تخفَّف» on the device (owner round 8, Q1): sealed at rest with a device key from the keystore, wiped at sign-out, and
 * never inherited or uploaded by the next account.
 */
import { addSelfMessage, checkIn, startProgram, upsertPlan, createPlan, type SinProgram } from '@thekra/practice-core';

const mockStorage = new Map<string, string>();
const mockSecure = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStorage.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockStorage.set(k, v);
  }),
  removeItem: jest.fn(async (k: string) => {
    mockStorage.delete(k);
  }),
}));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecure.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockSecure.delete(k);
  }),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../lib/api/practice', () => ({
  getPracticeChanges: jest.fn(async () => ({ serverTime: '2026-11-11T10:00:00.000Z', plans: [], relatives: [], settings: null, tombstones: [] })),
  postPracticeSync: jest.fn(async () => ({ serverTime: '2026-11-11T10:00:00.000Z', plans: [], relatives: [], settings: null, tombstones: [] })),
}));

import { postPracticeSync } from '../lib/api/practice';
import { DEVICE_KEY_STORE } from '../lib/practice/device-key';
import { HEART_KEY, SIN_KEY, STORE_KEY, usePracticeStore } from '../lib/practice/practice-store';
import { SYNC_META_KEY, syncPractice } from '../lib/practice/sync-runner';

const AT = '2026-10-03T20:00:00.000Z';
function aPlan() {
  return createPlan(
    {
      id: '7b0c1d9e-3f43-4a7e-9c55-0d6f1b2a3c4d',
      habitKey: 'quran-wird',
      deedSlug: 'quran',
      title: 'ورد القرآن',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 3,
      slots: ['06:00', '21:00'],
      createdOn: '2026-10-01',
    },
    AT,
  );
}

function program(slug = 'ghibah', note = 'ملاحظة سرية'): SinProgram {
  const p = startProgram({ sinSlug: slug, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, AT);
  return checkIn(p, '2026-10-02', 'fell_repented', note, AT);
}
const dump = () => JSON.stringify([...mockStorage.entries()]);
const flush = () => new Promise<void>((r) => setTimeout(r, 30));

async function freshStart(): Promise<void> {
  usePracticeStore.setState({ hydrated: false });
  await usePracticeStore.getState().hydrate();
}

beforeEach(async () => {
  mockStorage.clear();
  mockSecure.clear();
  (postPracticeSync as jest.Mock).mockClear();
  await usePracticeStore.getState().wipeAll();
  await freshStart();
});

describe('programs at rest on the device', () => {
  it('are stored only sealed: no sin name or note in AsyncStorage, the key in the keystore', async () => {
    usePracticeStore.getState().setStore((s) => ({ ...s, programs: [program('ghibah'), program('kadhib')] }));
    await flush();
    expect(mockStorage.get(SIN_KEY)).toMatch(/^v1\./);
    expect(dump()).not.toContain('ghibah');
    expect(dump()).not.toContain('kadhib');
    expect(dump()).not.toContain('ملاحظة');
    expect(mockSecure.has(DEVICE_KEY_STORE)).toBe(true);
  });

  it('come back after a restart', async () => {
    usePracticeStore.getState().setStore((s) => ({ ...s, programs: [program('ghibah')] }));
    await flush();
    await freshStart();
    expect(usePracticeStore.getState().store.programs.map((p) => p.sinSlug)).toEqual(['ghibah']);
  });

  it('are gone for good when the key is gone (the sealed copy is dropped)', async () => {
    usePracticeStore.getState().setStore((s) => ({ ...s, programs: [program('ghibah')] }));
    await flush();
    mockSecure.clear();
    // The key is cached in memory for the session; a restart reads the keystore.
    jest.resetModules();
    const fresh = require('../lib/practice/practice-store') as typeof import('../lib/practice/practice-store');
    await fresh.usePracticeStore.getState().hydrate();
    expect(fresh.usePracticeStore.getState().store.programs).toEqual([]);
    expect(mockStorage.has(SIN_KEY)).toBe(false);
  });

  it('old clear programs are sealed once and removed from the plain store', async () => {
    mockStorage.set(
      STORE_KEY,
      JSON.stringify({ v: 2, plans: [], relatives: [], programs: [program('ghibah')], settings: { hijriOffset: 0 }, tombstones: [], sync: { lastSyncedAt: null, acked: {} } }),
    );
    await freshStart();
    await flush();
    expect(usePracticeStore.getState().store.programs).toHaveLength(1);
    expect(mockStorage.get(STORE_KEY)).not.toContain('ghibah');
    expect(mockStorage.get(SIN_KEY)).toMatch(/^v1\./);
  });
});

describe('sign-out wipe and the next account', () => {
  it('wipeAll removes habits, programs, the sealed copy, heart data and the device key', async () => {
    usePracticeStore.getState().setStore((s) => ({ ...upsertPlan(s, aPlan()), programs: [program('ghibah')] }));
    usePracticeStore.getState().setHeart((h) => addSelfMessage(h, { id: '11111111-1111-4111-8111-111111111111', text: 'رسالة سرية' }));
    await flush();
    expect(dump()).toContain('quran-wird');
    expect(mockStorage.get(HEART_KEY)).toContain('رسالة سرية');
    await usePracticeStore.getState().wipeAll();
    expect(mockStorage.has(SIN_KEY)).toBe(false);
    expect(mockStorage.has(HEART_KEY)).toBe(false);
    expect(mockSecure.has(DEVICE_KEY_STORE)).toBe(false);
    expect(dump()).not.toContain('ghibah');
    expect(dump()).not.toContain('quran-wird');
    expect(dump()).not.toContain('رسالة سرية');
    expect(usePracticeStore.getState().store.programs).toEqual([]);
    expect(usePracticeStore.getState().store.plans).toEqual([]);
  });

  it("another account's copy left on the device is wiped, never uploaded into the new account", async () => {
    mockStorage.set(SYNC_META_KEY, JSON.stringify({ userId: 'user-c' }));
    usePracticeStore.getState().setStore((s) => ({ ...upsertPlan(s, aPlan()), programs: [program('ghibah')] }));
    await flush();
    expect(JSON.stringify(mockStorage.get(STORE_KEY))).toContain('quran-wird');
    await syncPractice('user-d');
    for (const call of (postPracticeSync as jest.Mock).mock.calls) expect(JSON.stringify(call[0])).not.toContain('quran-wird');
    expect(usePracticeStore.getState().store.plans).toEqual([]);
    expect(usePracticeStore.getState().store.programs).toEqual([]);
    expect(dump()).not.toContain('ghibah');
    expect(JSON.parse(mockStorage.get(SYNC_META_KEY) ?? '{}').userId).toBe('user-d');
  });

  it("the same account's own data is kept and pushed", async () => {
    mockStorage.set(SYNC_META_KEY, JSON.stringify({ userId: 'user-c' }));
    usePracticeStore.getState().setStore((s) => upsertPlan(s, aPlan()));
    await flush();
    await syncPractice('user-c');
    expect(usePracticeStore.getState().store.plans).toHaveLength(1);
    expect(JSON.stringify((postPracticeSync as jest.Mock).mock.calls[0]?.[0])).toContain('quran-wird');
  });

  it("a guest's own copy (linked to no account) is adopted by the account that signs in", async () => {
    usePracticeStore.getState().setStore((s) => upsertPlan(s, aPlan()));
    await flush();
    await syncPractice('user-d');
    expect(usePracticeStore.getState().store.plans).toHaveLength(1);
  });
});
