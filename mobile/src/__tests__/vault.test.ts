/**
 * The encrypted sin vault on mobile: practice-core seal/open round trip (low iteration count for speed), the
 * program merge between devices, the getRandomValues requirement (Hermes needs expo-crypto), and the wipe:
 * local data + server vault + keystore key.
 */

import {
  VaultError,
  VaultLockedError,
  checkIn,
  deriveKey,
  newSalt,
  openPrograms,
  sealPrograms,
  startProgram,
  unlockVault,
} from '@thekra/practice-core';

const mockStorage = new Map<string, string>();
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
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../lib/api/practice', () => ({
  deleteSinVault: jest.fn(async () => undefined),
  getSinVault: jest.fn(async () => null),
  putSinVault: jest.fn(async () => ({ version: 1 })),
}));

import * as SecureStore from 'expo-secure-store';
import { deleteSinVault } from '../lib/api/practice';
import { hasSecureRandom, installGetRandomValues } from '../lib/crypto/random';
import { usePracticeStore } from '../lib/practice/practice-store';
import { mergePrograms } from '../lib/practice/vault-merge';
import { VAULT_KEY_STORE, wipeSinProgramEverywhere } from '../lib/practice/vault-runner';

const LOW = 1000; // tests only; the app and the server use ≥ 210,000

function program() {
  let p = startProgram({ sinSlug: 'nazar-shashat', category: 'haqq_allah', hardToLeaveAtOnce: true, startedOn: '2026-10-20' });
  p = checkIn(p, '2026-10-26', 'held');
  return checkIn(p, '2026-10-27', 'weak', 'ملاحظة خاصة');
}

describe('vault round trip', () => {
  it('seals and opens with the same code; the ciphertext has no clear text', () => {
    const salt = newSalt();
    const key = deriveKey('رمزي-السري', salt, LOW);
    const sealed = sealPrograms([program()], key);
    const raw = JSON.stringify(sealed);
    expect(raw).not.toContain('nazar');
    expect(raw).not.toContain('ملاحظة');
    expect(openPrograms(sealed, deriveKey('رمزي-السري', salt, LOW))).toEqual([program()]);
    // Another device: unlockVault derives the key from the vault's own salt and iterations.
    const opened = unlockVault({ ...sealed, salt, kdf: 'pbkdf2-sha256', iterations: LOW }, 'رمزي-السري');
    expect(opened.programs).toEqual([program()]);
  });

  it('a wrong code cannot open it', () => {
    const salt = newSalt();
    const sealed = sealPrograms([program()], deriveKey('right-code', salt, LOW));
    expect(() => openPrograms(sealed, deriveKey('wrong-code', salt, LOW))).toThrow(VaultLockedError);
  });

  it('merges programs from two devices: union of check-ins, this device wins on the same date', () => {
    const local = [checkIn(program(), '2026-10-28', 'held')];
    const remote = [checkIn(program(), '2026-10-27', 'fell_repented')];
    const merged = mergePrograms(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.checkIns.map((c) => [c.date, c.value])).toEqual([
      ['2026-10-26', 'held'],
      ['2026-10-27', 'weak'],
      ['2026-10-28', 'held'],
    ]);
  });
});

describe('randomness (Hermes has no Web Crypto: expo-crypto is installed as getRandomValues)', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
  });

  it('the vault refuses to run without globalThis.crypto.getRandomValues, and works once installed', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    expect(hasSecureRandom()).toBe(false);
    expect(() => newSalt()).toThrow(VaultError);
    expect(() => sealPrograms([program()], new Uint8Array(32))).toThrow(VaultError);

    const fake = jest.fn(<T extends Uint8Array>(a: T): T => {
      for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 0xff;
      return a;
    });
    expect(installGetRandomValues(fake)).toBe(true);
    expect(hasSecureRandom()).toBe(true);
    expect(typeof newSalt()).toBe('string');
    expect(fake).toHaveBeenCalled();
    // An existing implementation is never replaced.
    expect(installGetRandomValues(fake)).toBe(false);
  });
});

describe('«احذف كل بيانات البرنامج»', () => {
  it('wipes the local programs, the keystore key and the server vault', async () => {
    usePracticeStore.setState({ hydrated: true });
    usePracticeStore.getState().setStore((s) => ({ ...s, programs: [program()] }));
    usePracticeStore.getState().setPrefs((p) => ({ ...p, sinReminders: true, rememberVaultKey: true }));

    await wipeSinProgramEverywhere('user-1');

    expect(usePracticeStore.getState().store.programs).toEqual([]);
    expect(usePracticeStore.getState().prefs.sinReminders).toBe(false);
    expect(usePracticeStore.getState().prefs.rememberVaultKey).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(VAULT_KEY_STORE, expect.anything());
    expect(deleteSinVault).toHaveBeenCalledTimes(1);
    expect(mockStorage.get('thekra.practice.v1') ?? '').not.toContain('nazar');
  });

  it('remembers an offline DELETE and does not call the server when signed out', async () => {
    (deleteSinVault as jest.Mock).mockClear();
    (deleteSinVault as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await wipeSinProgramEverywhere('user-1');
    expect(mockStorage.get('thekra.practice.vault.v1')).toContain('user-1');
    (deleteSinVault as jest.Mock).mockClear();
    await wipeSinProgramEverywhere(null);
    expect(deleteSinVault).not.toHaveBeenCalled();
  });
});
