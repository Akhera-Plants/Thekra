import { describe, expect, it } from 'vitest';
import { bytesToUtf8 } from '@noble/ciphers/utils.js';
import {
  base64ToBytes,
  checkIn,
  decodeDeviceKey,
  emptyStore,
  encodeDeviceKey,
  hasSignOutRisk,
  newDeviceKey,
  openFromDevice,
  ownerRelation,
  parseStore,
  programsFromText,
  programsToText,
  sealForDevice,
  serializeStore,
  signOutRisk,
  splitPrograms,
  startProgram,
  VaultError,
  VaultLockedError,
  wipedStore,
  type SinProgram,
  type Store,
} from '../src/index.js';

function program(slug = 'ghibah', note = 'سر لا يُقرأ'): SinProgram {
  const at = '2026-10-03T20:00:00.000Z';
  const p = startProgram({ sinSlug: slug, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, at);
  return checkIn(p, '2026-10-02', 'fell_repented', note, at);
}

function storeWith(programs: SinProgram[]): Store {
  return { ...emptyStore(), programs };
}

describe('splitPrograms', () => {
  it('leaves no program in the text written in clear', () => {
    const store = storeWith([program('ghibah'), program('kadhib')]);
    const { rest, programs } = splitPrograms(store);
    expect(programs).toHaveLength(2);
    const text = serializeStore(rest);
    expect(text).not.toContain('ghibah');
    expect(text).not.toContain('kadhib');
    expect(text).not.toContain('سر لا يُقرأ');
    expect(parseStore(text).programs).toEqual([]);
  });
});

describe('programs text', () => {
  it('round-trips and ignores garbage', () => {
    const programs = [program()];
    expect(programsFromText(programsToText(programs))).toEqual(parseStore(serializeStore(storeWith(programs))).programs);
    expect(programsFromText('not json')).toEqual([]);
    expect(programsFromText('7')).toEqual([]);
    expect(programsFromText('{"programs":"x"}')).toEqual([]);
  });
});

describe('device seal', () => {
  it('seals so the text names nothing, and opens with the same key', () => {
    const key = newDeviceKey();
    const text = sealForDevice([program('ghibah')], key);
    expect(text).not.toContain('ghibah');
    expect(text).not.toContain('سر');
    expect(text.startsWith('v1.')).toBe(true);
    expect(openFromDevice(text, key).map((p) => p.sinSlug)).toEqual(['ghibah']);
  });

  it('uses a fresh iv every time', () => {
    const key = newDeviceKey();
    expect(sealForDevice([program()], key)).not.toBe(sealForDevice([program()], key));
  });

  it('a wrong key or a changed text is refused', () => {
    const key = newDeviceKey();
    const text = sealForDevice([program()], key);
    expect(() => openFromDevice(text, newDeviceKey())).toThrow(VaultLockedError);
    const [v, iv, ct] = text.split('.') as [string, string, string];
    const flipped = `${v}.${iv}.${ct.slice(0, 4) === 'AAAA' ? 'BBBB' : 'AAAA'}${ct.slice(4)}`;
    expect(() => openFromDevice(flipped, key)).toThrow(VaultError);
    expect(() => openFromDevice('plain text', key)).toThrow(VaultError);
    expect(() => sealForDevice([], new Uint8Array(5))).toThrow(VaultError);
  });

  it('is plain AES-256-GCM: WebCrypto opens it with the same key', async () => {
    const key = newDeviceKey();
    const [, iv, ct] = sealForDevice([program('ghibah')], key).split('.') as [string, string, string];
    const subtle = (globalThis as unknown as { crypto: { subtle: any } }).crypto.subtle;
    const k = await subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, k, base64ToBytes(ct));
    expect(programsFromText(bytesToUtf8(new Uint8Array(plain))).map((p) => p.sinSlug)).toEqual(['ghibah']);
  });

  it('the stored key text round-trips and bad text gives null', () => {
    const key = newDeviceKey();
    expect(decodeDeviceKey(encodeDeviceKey(key))).toEqual(key);
    expect(decodeDeviceKey(null)).toBeNull();
    expect(decodeDeviceKey('')).toBeNull();
    expect(decodeDeviceKey('AAAA')).toBeNull();
    expect(decodeDeviceKey('***')).toBeNull();
  });
});

describe('ownerRelation', () => {
  it('tells a guest copy, the same account and another account apart', () => {
    expect(ownerRelation(undefined, 'D')).toBe('guest');
    expect(ownerRelation(null, 'D')).toBe('guest');
    expect(ownerRelation('', 'D')).toBe('guest');
    expect(ownerRelation('D', 'D')).toBe('same');
    expect(ownerRelation('C', 'D')).toBe('other');
  });
});

describe('sign-out risk', () => {
  it('warns about unsynced items or programs the vault does not hold', () => {
    expect(hasSignOutRisk(signOutRisk(0, 0, false))).toBe(false);
    expect(hasSignOutRisk(signOutRisk(0, 2, true))).toBe(false);
    expect(hasSignOutRisk(signOutRisk(3, 0, false))).toBe(true);
    expect(signOutRisk(0, 1, false)).toEqual({ unsyncedItems: 0, unsavedPrograms: true });
  });
  it('a wiped store holds nothing', () => {
    expect(wipedStore().programs).toEqual([]);
    expect(wipedStore().plans).toEqual([]);
  });
});
