/**
 * Sin-program data on the device, and who it belongs to (owner round 8, Q1: «تخفّف» is ALWAYS encrypted on the
 * device with a device-generated key and WIPED at sign-out). Pure: no storage, no network.
 *
 * - {@link splitPrograms} keeps the programs out of the plain store text, so what a client writes in clear never
 *   names a sin; {@link programsToText} / {@link programsFromText} are the plaintext the client encrypts (the web with
 *   WebCrypto AES-GCM, the app with {@link sealForDevice} and a key in the keystore).
 * - {@link sealForDevice} / {@link openFromDevice}: AES-256-GCM under a random per-device key. Unlike the vault
 *   (`sealPrograms`) it has no server size limit, since it never leaves the device.
 * - {@link ownerRelation}: whether the data on a device belongs to the account that signs in.
 * - {@link signOutRisk}: what a sign-out would destroy before it reached the account (to warn once).
 */
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { base64ToBytes, bytesToBase64 } from './base64.js';
import type { SinProgram } from './sin-program.js';
import { emptyStore, parsePrograms, type Store } from './storage.js';
import { VAULT_IV_BYTES, VAULT_KEY_BYTES, VaultError, VaultLockedError, randomBytes } from './vault.js';

const LOCAL_VERSION = 1;

/** The store without its programs (what may be written in clear), and the programs apart. */
export function splitPrograms(store: Store): { rest: Store; programs: SinProgram[] } {
  return { rest: { ...store, programs: [] }, programs: store.programs };
}

/** The plaintext of the encrypted program blob. Only valid programs are kept. */
export function programsToText(programs: readonly SinProgram[]): string {
  return JSON.stringify({ v: LOCAL_VERSION, programs: parsePrograms(programs) });
}

/** The programs in a decrypted blob; anything unreadable gives none (never throws). */
export function programsFromText(text: string): SinProgram[] {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return [];
    return parsePrograms((value as { programs?: unknown }).programs);
  } catch {
    return [];
  }
}

/** A fresh random 32-byte device key. */
export function newDeviceKey(): Uint8Array {
  return randomBytes(VAULT_KEY_BYTES);
}

export function encodeDeviceKey(key: Uint8Array): string {
  return bytesToBase64(key);
}

/** The key from its stored text, or null when it is not a 32-byte base64 key. */
export function decodeDeviceKey(text: string | null | undefined): Uint8Array | null {
  if (!text) return null;
  try {
    const key = base64ToBytes(text);
    return key.length === VAULT_KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

function assertKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.length !== VAULT_KEY_BYTES) throw new VaultError('key must be 32 bytes');
}

/** The programs as one text that is safe to store in clear: `v1.<iv>.<ciphertext>` (base64), AES-256-GCM. */
export function sealForDevice(programs: readonly SinProgram[], key: Uint8Array): string {
  assertKey(key);
  const iv = randomBytes(VAULT_IV_BYTES);
  const ciphertext = gcm(key, iv).encrypt(utf8ToBytes(programsToText(programs)));
  return `v${LOCAL_VERSION}.${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

/** Opens {@link sealForDevice}'s text. A wrong key or a changed text throws {@link VaultLockedError}. */
export function openFromDevice(text: string, key: Uint8Array): SinProgram[] {
  assertKey(key);
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== `v${LOCAL_VERSION}`) throw new VaultError('Unknown device blob');
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    iv = base64ToBytes(parts[1] as string);
    ciphertext = base64ToBytes(parts[2] as string);
  } catch {
    throw new VaultError('Device blob must be base64');
  }
  if (iv.length !== VAULT_IV_BYTES) throw new VaultError('Device blob iv has the wrong size');
  try {
    return programsFromText(bytesToUtf8(gcm(key, iv).decrypt(ciphertext)));
  } catch {
    throw new VaultLockedError();
  }
}

/**
 * How the data left on a device relates to the account that signs in: `guest` (never linked to an account: the
 * visitor's own, adopted), `same` (kept), `other` (another account's: must not be shown or uploaded).
 */
export type OwnerRelation = 'guest' | 'same' | 'other';

export function ownerRelation(owner: string | null | undefined, account: string): OwnerRelation {
  if (owner === undefined || owner === null || owner === '') return 'guest';
  return owner === account ? 'same' : 'other';
}

/** What a sign-out destroys because it did not reach the account yet. */
export interface SignOutRisk {
  /** Habits, relatives, settings waiting to be synced. */
  unsyncedItems: number;
  /** The device holds programs that the account's vault does not hold as they are now. */
  unsavedPrograms: boolean;
}

/**
 * `unsyncedItems`: count of pending sync items (practice-core `countChanges(localChanges(store))`);
 * `programsCount`: programs on the device; `programsInVault`: the vault is open and holds exactly them.
 */
export function signOutRisk(unsyncedItems: number, programsCount: number, programsInVault: boolean): SignOutRisk {
  return { unsyncedItems, unsavedPrograms: programsCount > 0 && !programsInVault };
}

export function hasSignOutRisk(risk: SignOutRisk): boolean {
  return risk.unsyncedItems > 0 || risk.unsavedPrograms;
}

/** What a device holds after a wipe. */
export function wipedStore(): Store {
  return emptyStore();
}
