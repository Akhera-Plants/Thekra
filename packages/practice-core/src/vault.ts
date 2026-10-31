/**
 * The encrypted sin vault (docs/plan/2026-10-practice-sync-contract.md §1, §3 «Sin vault», §4).
 *
 * The sin program (slug, check-ins and private notes) leaves the device only as AES-256-GCM ciphertext under a key
 * derived on the device from the user's «رمز الخصوصية» with PBKDF2-HMAC-SHA256. The server stores an opaque blob
 * and can tell neither the sin nor the notes. A forgotten code cannot be recovered.
 *
 * Built on `@noble/hashes` and `@noble/ciphers` (audited, pure JS: the same code on web, extension and Hermes).
 * Random bytes come from `globalThis.crypto.getRandomValues` (React Native: install `expo-crypto`).
 *
 * The plaintext is padded with spaces to a multiple of {@link PAD_BLOCK} bytes before encryption, so the
 * ciphertext length does not hint at which sin (slug length) or how many notes it holds.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64ToBytes, bytesToBase64 } from './base64.js';
import { validateProgram, type SinProgram } from './sin-program.js';
import { parsePrograms } from './storage.js';

export const VAULT_KDF = 'pbkdf2-sha256';
/** The server rejects fewer iterations (contract §3). Vaults made before 2026-10-29 use this. */
export const MIN_VAULT_ITERATIONS = 210_000;
/** For new vaults where the KDF runs fast enough (OWASP 2023 for PBKDF2-HMAC-SHA256). ~0.6 s in V8. */
export const VAULT_ITERATIONS = 600_000;
/** {@link unlockVault} refuses more: a vault from a hostile server must not freeze the device. */
export const MAX_VAULT_ITERATIONS = 5_000_000;
/** A new privacy code is at least this long ({@link privacyCodeProblem}). */
export const MIN_PRIVACY_CODE_LENGTH = 8;
export const VAULT_KEY_BYTES = 32;
export const VAULT_SALT_BYTES = 16;
export const VAULT_IV_BYTES = 12;
/** The server's ciphertext limit (128 KB). */
export const MAX_VAULT_CIPHERTEXT_BYTES = 128 * 1024;
export const PAD_BLOCK = 1024;
const PLAINTEXT_VERSION = 1;

/** A vault failure that is not a wrong code: bad input, missing randomness, size limit. */
export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

/** The code is wrong or the ciphertext was changed (GCM authentication failed). */
export class VaultLockedError extends VaultError {
  constructor() {
    super('The vault could not be opened: wrong privacy code or damaged data');
    this.name = 'VaultLockedError';
  }
}

export interface SealedPrograms {
  /** base64 */
  ciphertext: string;
  /** base64, 12 bytes */
  iv: string;
}

/** The `PUT /v1/me/sin-vault` body. */
export interface VaultPayload extends SealedPrograms {
  /** base64, 16 bytes */
  salt: string;
  kdf: typeof VAULT_KDF;
  iterations: number;
  /** The version last read from the server (optimistic concurrency; a stale one gets 409). */
  version: number;
}

interface CryptoLike {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

/** Cryptographically secure random bytes. Throws a VaultError when the runtime has no `crypto.getRandomValues`. */
export function randomBytes(length: number): Uint8Array {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new VaultError('globalThis.crypto.getRandomValues is not available (on React Native, install expo-crypto)');
  }
  const out = new Uint8Array(length);
  c.getRandomValues(out);
  return out;
}

/** A fresh 16-byte salt, base64. Make a new one whenever the privacy code changes. */
export function newSalt(): string {
  return bytesToBase64(randomBytes(VAULT_SALT_BYTES));
}

function decodeField(value: unknown, label: string, length?: number): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(value as string);
  } catch {
    throw new VaultError(`${label} must be base64`);
  }
  if (length !== undefined && bytes.length !== length) throw new VaultError(`${label} must be ${length} bytes`);
  return bytes;
}

/**
 * The 32-byte AES key for a privacy code. The code is Unicode-normalized (NFC) first, so the same Arabic code
 * typed on different keyboards gives the same key. `salt` is base64 or bytes (16 bytes or more). Slow on purpose:
 * 210,000 iterations by default; pass fewer only in tests.
 */
export function deriveKey(code: string, salt: string | Uint8Array, iterations: number = MIN_VAULT_ITERATIONS): Uint8Array {
  if (typeof code !== 'string' || code.length === 0) throw new VaultError('The privacy code is empty');
  if (!Number.isInteger(iterations) || iterations < 1) throw new VaultError('iterations must be a positive integer');
  const saltBytes = typeof salt === 'string' ? decodeField(salt, 'salt') : salt;
  if (saltBytes.length < VAULT_SALT_BYTES) throw new VaultError(`salt must be at least ${VAULT_SALT_BYTES} bytes`);
  return pbkdf2(sha256, utf8ToBytes(code.normalize('NFC')), saltBytes, { c: iterations, dkLen: VAULT_KEY_BYTES });
}

/** Codes people pick first, which an attacker tries first. Compared after lowercasing and NFC. */
const COMMON_CODES = new Set(['password', 'passw0rd', 'qwertyui', 'qwerty123', 'iloveyou', 'abcdefgh', 'abcd1234', '1q2w3e4r', 'asdfghjk']);

/**
 * Why a new privacy code is too easy to guess, or null when it may be used. The vault is only as strong as this
 * code: anyone holding the ciphertext can try codes offline. Rejects short codes, one repeated character, runs
 * of consecutive digits or letters (12345678, 87654321, abcdefgh), digits with at most two distinct values, and
 * common codes. Existing vaults are not affected: this runs only when a code is chosen.
 */
export function privacyCodeProblem(code: string): 'short' | 'weak' | null {
  const chars = [...code.normalize('NFC')];
  if (chars.length < MIN_PRIVACY_CODE_LENGTH) return 'short';
  if (new Set(chars).size === 1) return 'weak';
  const points = chars.map((c) => c.codePointAt(0) as number);
  const steps = new Set(points.slice(1).map((p, i) => p - (points[i] as number)));
  if (steps.size === 1 && (steps.has(1) || steps.has(-1))) return 'weak';
  if (/^\d+$/.test(code) && new Set(chars).size <= 2) return 'weak';
  if (COMMON_CODES.has(code.normalize('NFC').toLowerCase())) return 'weak';
  return null;
}

function assertKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.length !== VAULT_KEY_BYTES) throw new VaultError('key must be 32 bytes');
}

/** Encrypts the programs (with their notes) under `key` with a fresh 12-byte IV. Throws on an invalid program. */
export function sealPrograms(programs: readonly SinProgram[], key: Uint8Array): SealedPrograms {
  assertKey(key);
  for (const p of programs) {
    const err = validateProgram(p);
    if (err) throw new VaultError(`Invalid program: ${err}`);
  }
  const json = JSON.stringify({ v: PLAINTEXT_VERSION, programs: parsePrograms(programs) });
  const raw = utf8ToBytes(json);
  const padded = new Uint8Array(Math.ceil((raw.length + 1) / PAD_BLOCK) * PAD_BLOCK).fill(0x20);
  padded.set(raw);
  const iv = randomBytes(VAULT_IV_BYTES);
  const ciphertext = gcm(key, iv).encrypt(padded);
  if (ciphertext.length > MAX_VAULT_CIPHERTEXT_BYTES) throw new VaultError('The program data is larger than the vault limit');
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

/**
 * Decrypts and validates the programs. Throws {@link VaultLockedError} for a wrong key or changed ciphertext,
 * {@link VaultError} for malformed input. Invalid entries inside an authentic vault are dropped.
 */
export function openPrograms(sealed: SealedPrograms, key: Uint8Array): SinProgram[] {
  assertKey(key);
  const iv = decodeField(sealed.iv, 'iv', VAULT_IV_BYTES);
  const ciphertext = decodeField(sealed.ciphertext, 'ciphertext');
  let plain: Uint8Array;
  try {
    plain = gcm(key, iv).decrypt(ciphertext);
  } catch {
    throw new VaultLockedError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToUtf8(plain));
  } catch {
    throw new VaultError('The vault content is not readable');
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { v?: unknown }).v !== PLAINTEXT_VERSION) {
    throw new VaultError('Unknown vault content version');
  }
  return parsePrograms((parsed as { programs?: unknown }).programs);
}

function assertIterations(iterations: number): void {
  if (!Number.isInteger(iterations) || iterations < MIN_VAULT_ITERATIONS || iterations > MAX_VAULT_ITERATIONS) {
    throw new VaultError(`iterations must be ${MIN_VAULT_ITERATIONS}–${MAX_VAULT_ITERATIONS}`);
  }
}

/** The PUT body. Throws when `iterations` is outside the allowed range or a field is malformed. */
export function vaultPayload(sealed: SealedPrograms, opts: { salt: string; iterations: number; version: number }): VaultPayload {
  assertIterations(opts.iterations);
  if (!Number.isInteger(opts.version) || opts.version < 0) throw new VaultError('version must be a non-negative integer');
  decodeField(opts.salt, 'salt', VAULT_SALT_BYTES);
  decodeField(sealed.iv, 'iv', VAULT_IV_BYTES);
  decodeField(sealed.ciphertext, 'ciphertext');
  return { ciphertext: sealed.ciphertext, iv: sealed.iv, salt: opts.salt, kdf: VAULT_KDF, iterations: opts.iterations, version: opts.version };
}

/**
 * Opens a vault as the server returns it, from the privacy code: derives the key with the vault's own salt and
 * iterations. Returns the key too, to keep in memory for the session (and re-seal with the same salt).
 * Refuses iterations outside {@link MIN_VAULT_ITERATIONS}–{@link MAX_VAULT_ITERATIONS}, so a server cannot weaken
 * the key (1 iteration) or freeze the device (a huge count).
 */
export function unlockVault(
  vault: Pick<VaultPayload, 'ciphertext' | 'iv' | 'salt' | 'kdf' | 'iterations'>,
  code: string,
): { programs: SinProgram[]; key: Uint8Array } {
  if (vault.kdf !== VAULT_KDF) throw new VaultError(`Unsupported kdf: ${String(vault.kdf)}`);
  assertIterations(vault.iterations);
  const key = deriveKey(code, vault.salt, vault.iterations);
  return { programs: openPrograms(vault, key), key };
}
