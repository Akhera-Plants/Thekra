/**
 * The encrypted sin vault on the web (docs/plan/2026-10-practice-sync-contract.md §1, §3 «Sin vault»).
 *
 * The sin programs (slug, check-ins, notes) leave the device only sealed with practice-core (`sealPrograms`,
 * AES-256-GCM under a PBKDF2 key from the user's «رمز الخصوصية»). The derived key lives in this module's memory for
 * the tab session only: no «remember» on the web (contract §4), nothing in storage, gone on reload or sign-out.
 *
 * The flows take the API as a parameter so they can be tested without a network.
 */
import {
  VAULT_ITERATIONS,
  deriveKey,
  mergePrograms,
  newSalt,
  openPrograms,
  privacyCodeProblem,
  sealPrograms,
  unlockVault,
  vaultPayload,
  type SinProgram,
  type VaultPayload,
  VaultLockedError,
} from '@thekra/practice-core';
import { ApiError } from '@/lib/types/api';

/** Conflict retries before giving up (another device keeps writing). */
const MAX_CONFLICT_RETRIES = 3;

export interface ServerVaultLike {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf: string;
  iterations: number;
  version: number;
}

export interface VaultApi {
  get: () => Promise<ServerVaultLike | null>;
  /** Resolves to the new version; a stale version rejects with ApiError 409 `SIN_VAULT_CONFLICT`. */
  put: (body: VaultPayload) => Promise<number>;
  remove: () => Promise<void>;
}

export interface VaultSession {
  key: Uint8Array;
  salt: string;
  iterations: number;
  /** The server version the last seal was based on. */
  version: number;
}

/** The server already holds a vault: open it (with its code) instead of creating a new one. */
export class VaultExistsError extends Error {
  constructor() {
    super('A vault already exists for this account');
    this.name = 'VaultExistsError';
  }
}

export function isVaultConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** Merging this device's programs with the vault's: practice-core `mergePrograms` (shared with the mobile app). */
export { mergePrograms };

/** Stable text of a program list, to tell whether the vault needs a new seal. */
export function programsFingerprint(programs: readonly SinProgram[]): string {
  return JSON.stringify(programs);
}

/** «احفظ البرنامج مشفّرًا»: a new salt and key from the code, sealed and saved as version 0 → 1. */
export async function createVault(api: VaultApi, programs: readonly SinProgram[], code: string): Promise<VaultSession> {
  if (privacyCodeProblem(code) !== null) throw new RangeError('The privacy code is too easy to guess');
  if (await api.get()) throw new VaultExistsError();
  const salt = newSalt();
  const key = deriveKey(code, salt, VAULT_ITERATIONS);
  const body = vaultPayload(sealPrograms(programs, key), { salt, iterations: VAULT_ITERATIONS, version: 0 });
  const version = await api.put(body);
  return { key, salt, iterations: VAULT_ITERATIONS, version };
}

/** «افتح البرنامج»: the vault's programs and a session key, or null when the account has no vault. Wrong code → VaultLockedError. */
export async function openVault(api: VaultApi, code: string): Promise<{ session: VaultSession; programs: SinProgram[] } | null> {
  const vault = await api.get();
  if (!vault) return null;
  const { programs, key } = unlockVault({ ...vault, kdf: vault.kdf as VaultPayload['kdf'] }, code);
  return { session: { key, salt: vault.salt, iterations: vault.iterations, version: vault.version }, programs };
}

/**
 * Re-seals `programs` with the session key and saves them with the session's version. On 409 (another device
 * saved first) it fetches the current vault, opens it with the same key, merges ({@link mergePrograms}) and tries
 * again. Returns the new session and the programs now in the vault (the caller stores them locally when they
 * differ). A vault re-made with another code elsewhere throws VaultLockedError: the user must open it again.
 */
export async function saveVault(
  api: VaultApi,
  session: VaultSession,
  programs: readonly SinProgram[],
): Promise<{ session: VaultSession; programs: SinProgram[] }> {
  let current = session;
  let toSave = [...programs];
  for (let attempt = 0; ; attempt++) {
    const body = vaultPayload(sealPrograms(toSave, current.key), {
      salt: current.salt,
      iterations: current.iterations,
      version: current.version,
    });
    try {
      const version = await api.put(body);
      return { session: { ...current, version }, programs: toSave };
    } catch (error) {
      if (!isVaultConflict(error) || attempt >= MAX_CONFLICT_RETRIES) throw error;
      const latest = await api.get();
      if (!latest) {
        current = { ...current, version: 0 };
        continue;
      }
      if (latest.salt !== current.salt || latest.iterations !== current.iterations) {
        // Re-made elsewhere with a new code: this key cannot open it, and a forced overwrite would lose its data.
        throw new VaultLockedError();
      }
      toSave = mergePrograms(toSave, openPrograms(latest, current.key));
      current = { ...current, version: latest.version };
    }
  }
}

// ── The tab-session key (memory only) ───────────────────────────────────────────────────────────────────────────

let session: VaultSession | null = null;
let sessionOwner: string | null = null;
let sealedFingerprint: string | null = null;
const listeners = new Set<() => void>();

export function getVaultSession(): VaultSession | null {
  return session;
}

export function getServerVaultSession(): VaultSession | null {
  return null;
}

/** The account the session key belongs to (another sign-in must not reuse it). */
export function vaultSessionOwner(): string | null {
  return sessionOwner;
}

/** The fingerprint of the programs last sealed into the vault (to skip a seal when nothing changed). */
export function lastSealedFingerprint(): string | null {
  return sealedFingerprint;
}

/** Keeps (or clears, with `null`) the unlocked key for this tab, with its account and the programs just sealed. */
export function setVaultSession(next: VaultSession | null, owner: string | null = null, fingerprint: string | null = null): void {
  session = next;
  sessionOwner = next ? owner : null;
  sealedFingerprint = next ? fingerprint : null;
  for (const listener of listeners) listener();
}

export function subscribeVaultSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
