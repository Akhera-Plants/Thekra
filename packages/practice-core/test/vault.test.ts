import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  checkIn,
  deriveKey,
  MAX_VAULT_ITERATIONS,
  MIN_VAULT_ITERATIONS,
  VAULT_ITERATIONS,
  privacyCodeProblem,
  newSalt,
  openPrograms,
  randomBytes,
  sealPrograms,
  startProgram,
  unlockVault,
  vaultPayload,
  VaultError,
  VaultLockedError,
  type SinProgram,
} from '../src/index.js';

// Low iteration count for speed: tests only. Production uses MIN_VAULT_ITERATIONS (210,000).
const ITER = 1000;
const SALT = bytesToBase64(new Uint8Array(16).map((_, i) => i + 1));

function program(slug = 'ghiba', note = 'اغتبت اليوم ثم استغفرت'): SinProgram {
  const at = '2026-10-03T20:00:00.000Z';
  let p = startProgram({ sinSlug: slug, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-01' }, at);
  p = checkIn(p, '2026-10-02', 'held', undefined, at);
  return checkIn(p, '2026-10-03', 'fell_repented', note, at);
}

/** Node's WebCrypto, typed loosely: used only to cross-check interoperability. */
const subtle = (globalThis as unknown as { crypto: { subtle: any } }).crypto.subtle;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('base64', () => {
  it('round-trips and matches RFC 4648 vectors', () => {
    const text = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
    const vectors: [string, string][] = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
    for (const [plain, b64] of vectors) {
      expect(bytesToBase64(text(plain))).toBe(b64);
      expect(base64ToBytes(b64)).toEqual(text(plain));
    }
    const bytes = randomBytes(257);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    for (const bad of ['Zg=', 'Z===', 'Zm9v!', 'Zg==Zg==', '====']) expect(() => base64ToBytes(bad)).toThrow(TypeError);
  });
});

describe('deriveKey', () => {
  it('derives 32 deterministic bytes that match WebCrypto PBKDF2-SHA256', async () => {
    const key = deriveKey('رمز سري', SALT, ITER);
    expect(key).toHaveLength(32);
    expect(deriveKey('رمز سري', SALT, ITER)).toEqual(key);
    expect(deriveKey('رمز سري', newSalt(), ITER)).not.toEqual(key);
    expect(deriveKey('رمز سري', SALT, ITER + 1)).not.toEqual(key);
    const material = await subtle.importKey('raw', utf8ToBytes('رمز سري'), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(SALT), iterations: ITER }, material, 256);
    expect(new Uint8Array(bits)).toEqual(key);
  });

  it('normalizes the code to NFC', () => {
    expect(deriveKey('é', SALT, ITER)).toEqual(deriveKey('é', SALT, ITER));
  });

  it('rejects an empty code, a short salt and bad iterations', () => {
    expect(() => deriveKey('', SALT, ITER)).toThrow(VaultError);
    expect(() => deriveKey('x', bytesToBase64(new Uint8Array(8)), ITER)).toThrow(VaultError);
    expect(() => deriveKey('x', 'not base64!', ITER)).toThrow(VaultError);
    expect(() => deriveKey('x', SALT, 0)).toThrow(VaultError);
  });

  it('defaults to the server minimum', () => {
    expect(MIN_VAULT_ITERATIONS).toBe(210_000);
  });

  it('newSalt gives 16 random bytes', () => {
    expect(base64ToBytes(newSalt())).toHaveLength(16);
    expect(newSalt()).not.toBe(newSalt());
  });
});

describe('seal / open', () => {
  const key = deriveKey('1234', SALT, ITER);

  it('round-trips programs with their notes', () => {
    const programs = [program(), program('reels', 'بعد العشاء')];
    const sealed = sealPrograms(programs, key);
    expect(base64ToBytes(sealed.iv)).toHaveLength(12);
    expect(openPrograms(sealed, key)).toEqual(programs);
  });

  it('uses a fresh IV every time', () => {
    const a = sealPrograms([program()], key);
    const b = sealPrograms([program()], key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('a wrong code gives VaultLockedError', () => {
    const sealed = sealPrograms([program()], key);
    const wrong = deriveKey('4321', SALT, ITER);
    expect(() => openPrograms(sealed, wrong)).toThrow(VaultLockedError);
    try {
      openPrograms(sealed, wrong);
    } catch (e) {
      expect(e).toBeInstanceOf(VaultError);
      expect((e as Error).message).not.toContain('ghiba');
    }
  });

  it('any change to ciphertext, tag or IV is detected (GCM)', () => {
    const sealed = sealPrograms([program()], key);
    const ct = base64ToBytes(sealed.ciphertext);
    for (const index of [0, Math.floor(ct.length / 2), ct.length - 1]) {
      const bad = ct.slice();
      bad[index] = (bad[index] as number) ^ 1;
      expect(() => openPrograms({ ...sealed, ciphertext: bytesToBase64(bad) }, key)).toThrow(VaultLockedError);
    }
    const iv = base64ToBytes(sealed.iv);
    iv[0] = (iv[0] as number) ^ 1;
    expect(() => openPrograms({ ...sealed, iv: bytesToBase64(iv) }, key)).toThrow(VaultLockedError);
    expect(() => openPrograms({ ...sealed, ciphertext: bytesToBase64(ct.slice(0, -1)) }, key)).toThrow(VaultLockedError);
  });

  it('malformed input is a VaultError, not a lock', () => {
    const sealed = sealPrograms([program()], key);
    expect(() => openPrograms({ ...sealed, iv: 'AAAA' }, key)).toThrow(VaultError);
    expect(() => openPrograms({ ...sealed, iv: 'AAAA' }, key)).not.toThrow(VaultLockedError);
    expect(() => openPrograms({ ...sealed, ciphertext: '%%%' }, key)).not.toThrow(VaultLockedError);
    expect(() => sealPrograms([program()], new Uint8Array(16))).toThrow(VaultError);
  });

  it('never leaks the slug or notes, and pads so the length does not hint at the sin', () => {
    const slug = 'very-specific-sin-slug';
    const note = 'ملاحظة خاصة جدًا';
    const sealed = sealPrograms([program(slug, note)], key);
    const bytes = base64ToBytes(sealed.ciphertext);
    const asLatin1 = String.fromCharCode(...bytes);
    expect(asLatin1).not.toContain(slug);
    expect(sealed.ciphertext).not.toContain(slug);
    expect(JSON.stringify(sealed)).not.toContain(note);
    const short = sealPrograms([program('x', '')], key);
    expect(base64ToBytes(short.ciphertext)).toHaveLength(bytes.length);
    expect((bytes.length - 16) % 1024).toBe(0);
  });

  it('is standard AES-256-GCM (ciphertext || 16-byte tag), readable by WebCrypto', async () => {
    const sealed = sealPrograms([program()], key);
    const cryptoKey = await subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(sealed.iv) }, cryptoKey, base64ToBytes(sealed.ciphertext));
    const json = JSON.parse(bytesToUtf8(new Uint8Array(plain)));
    expect(json.v).toBe(1);
    expect(json.programs[0].sinSlug).toBe('ghiba');
  });

  it('rejects invalid programs (haqq_ibad cannot be gradual)', () => {
    expect(() => sealPrograms([{ ...program(), path: 'gradual' }], key)).toThrow(VaultError);
  });

  it('throws a clear error when getRandomValues is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => sealPrograms([program()], key)).toThrow(/getRandomValues is not available/);
    expect(() => newSalt()).toThrow(VaultError);
  });
});

describe('vaultPayload / unlockVault', () => {
  it('builds the PUT body and enforces the server minimum', () => {
    const salt = newSalt();
    const sealed = sealPrograms([program()], deriveKey('1234', salt, ITER));
    expect(vaultPayload(sealed, { salt, iterations: MIN_VAULT_ITERATIONS, version: 3 })).toEqual({
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      salt,
      kdf: 'pbkdf2-sha256',
      iterations: 210_000,
      version: 3,
    });
    expect(() => vaultPayload(sealed, { salt, iterations: ITER, version: 0 })).toThrow(VaultError);
    expect(() => vaultPayload(sealed, { salt: bytesToBase64(new Uint8Array(8)), iterations: MIN_VAULT_ITERATIONS, version: 0 })).toThrow(VaultError);
    expect(() => vaultPayload(sealed, { salt, iterations: MIN_VAULT_ITERATIONS, version: -1 })).toThrow(VaultError);
  });

  it('unlocks from the code with the vault salt and iterations', () => {
    const salt = newSalt();
    const sealed = sealPrograms([program()], deriveKey('رمزي', salt, MIN_VAULT_ITERATIONS));
    const vault = { ...sealed, salt, kdf: 'pbkdf2-sha256' as const, iterations: MIN_VAULT_ITERATIONS };
    const { programs, key } = unlockVault(vault, 'رمزي');
    expect(programs).toEqual([program()]);
    expect(openPrograms(sealPrograms(programs, key), key)).toEqual(programs);
    expect(() => unlockVault(vault, 'خطأ')).toThrow(VaultLockedError);
    expect(() => unlockVault({ ...vault, kdf: 'scrypt' as never }, 'رمزي')).toThrow(VaultError);
  });

  it('refuses iteration counts a hostile server could send: too few (weak key) or too many (frozen device)', () => {
    const salt = newSalt();
    const sealed = sealPrograms([program()], deriveKey('رمزي', salt, ITER));
    for (const iterations of [1, ITER, MIN_VAULT_ITERATIONS - 1, MAX_VAULT_ITERATIONS + 1, 1.5]) {
      expect(() => unlockVault({ ...sealed, salt, kdf: 'pbkdf2-sha256', iterations }, 'رمزي')).toThrow(VaultError);
    }
    expect(() => vaultPayload(sealed, { salt, iterations: MAX_VAULT_ITERATIONS + 1, version: 0 })).toThrow(VaultError);
    expect(vaultPayload(sealed, { salt, iterations: VAULT_ITERATIONS, version: 0 }).iterations).toBe(600_000);
  });
});

describe('privacyCodeProblem', () => {
  it('rejects short, repeated, sequential, two-digit and common codes', () => {
    for (const code of ['', '1234567', 'رمز']) expect(privacyCodeProblem(code)).toBe('short');
    for (const code of ['11111111', '12345678', '87654321', 'abcdefgh', '12121212', '10101010', 'Password', 'أأأأأأأأ']) {
      expect(privacyCodeProblem(code)).toBe('weak');
    }
  });

  it('accepts real codes and phrases, Arabic included', () => {
    for (const code of ['73914862', 'صبر جميل', 'blue-river-7', 'نور على الطريق']) expect(privacyCodeProblem(code)).toBeNull();
  });
});
