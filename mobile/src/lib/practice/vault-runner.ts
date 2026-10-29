/**
 * The encrypted sin vault on mobile (docs/plan/2026-10-practice-sync-contract.md §1, §3 «Sin vault», §4).
 *
 * - «احفظ البرنامج مشفّرًا في حسابك»: the user picks a «رمز الخصوصية»; practice-core derives a key on the device
 *   (`deriveKey`, PBKDF2-SHA256, 210,000 iterations, fresh `newSalt`), seals the programs (`sealPrograms`,
 *   AES-256-GCM) and the app PUTs `vaultPayload(...)`. The server stores ciphertext it cannot read. A forgotten
 *   code cannot be recovered.
 * - While unlocked, every change of the programs (check-ins) is sealed and PUT again (use-practice-lifecycle).
 *   A stale version → 409 SIN_VAULT_CONFLICT: the current vault (from the error details) is opened with the same
 *   key, merged (vault-merge.ts) and PUT once more.
 * - Another device unlocks with the code (`unlockVault`) and merges the programs into its own.
 * - The key lives in memory for the session only, unless the user turns on «تذكّر على هذا الجهاز»: then the raw
 *   key (base64) is kept in expo-secure-store (Keychain/Keystore, this device only), off by default.
 * - «احذف كل بيانات البرنامج» wipes the local programs, the in-memory key, the keystore entry and DELETEs the vault
 *   (retried on the next refresh when offline).
 * Never logs anything from the programs or the code.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import {
  MIN_VAULT_ITERATIONS,
  VaultLockedError,
  base64ToBytes,
  bytesToBase64,
  deriveKey,
  newSalt,
  openPrograms,
  sealPrograms,
  unlockVault,
  vaultPayload,
  type SinProgram,
} from '@thekra/practice-core';
import { deleteSinVault, getSinVault, putSinVault } from '../api/practice';
import { ApiError } from '../types/api';
import type { RemoteVault } from './catalog-types';
import { usePracticeStore } from './practice-store';
import { mergePrograms, sameJsonPrograms } from './vault-merge';

export const VAULT_KEY_STORE = 'thekra.sinVault.key';
const VAULT_META_KEY = 'thekra.practice.vault.v1';

/** UI state. `error` is an i18n key under `vault.errors`. */
export type VaultStatus = 'unknown' | 'none' | 'locked' | 'unlocked' | 'working';
export const useVaultState = create<{ status: VaultStatus; error: string | null }>(() => ({ status: 'unknown', error: null }));

interface Session {
  userId: string;
  key: Uint8Array;
  salt: string;
  iterations: number;
  version: number;
}

// In memory only, never in Zustand state (nothing should be able to render or persist it by accident).
let session: Session | null = null;

function setStatus(status: VaultStatus, error: string | null = null): void {
  useVaultState.setState({ status, error });
}

export function isVaultUnlocked(): boolean {
  return session !== null;
}

async function loadMeta(): Promise<{ deletePendingFor?: string }> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_META_KEY);
    return raw ? (JSON.parse(raw) as { deletePendingFor?: string }) : {};
  } catch {
    return {};
  }
}

async function saveMeta(meta: { deletePendingFor?: string }): Promise<void> {
  try {
    await AsyncStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

const SECURE_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function rememberKey(s: Session): Promise<void> {
  await SecureStore.setItemAsync(
    VAULT_KEY_STORE,
    JSON.stringify({ userId: s.userId, salt: s.salt, key: bytesToBase64(s.key) }),
    SECURE_OPTS,
  );
}

export async function forgetRememberedKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(VAULT_KEY_STORE, SECURE_OPTS);
  } catch {
    // nothing stored
  }
}

async function rememberedKey(userId: string, salt: string): Promise<Uint8Array | null> {
  try {
    const raw = await SecureStore.getItemAsync(VAULT_KEY_STORE, SECURE_OPTS);
    if (!raw) return null;
    const v = JSON.parse(raw) as { userId?: string; salt?: string; key?: string };
    if (v.userId !== userId || v.salt !== salt || typeof v.key !== 'string') return null;
    return base64ToBytes(v.key);
  } catch {
    return null;
  }
}

function localPrograms(): SinProgram[] {
  return usePracticeStore.getState().store.programs;
}

function adoptPrograms(programs: SinProgram[]): void {
  usePracticeStore.getState().setStore((s) => ({ ...s, programs }));
}

/** Lets the spinner render before the slow, synchronous key derivation. */
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 50));

function vaultFromConflict(details: unknown): RemoteVault | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  const v = (d.vault && typeof d.vault === 'object' ? d.vault : d) as Record<string, unknown>;
  return typeof v.ciphertext === 'string' && typeof v.iv === 'string' && typeof v.salt === 'string' && typeof v.version === 'number'
    ? (v as unknown as RemoteVault)
    : null;
}

async function put(s: Session): Promise<void> {
  const body = vaultPayload(sealPrograms(localPrograms(), s.key), { salt: s.salt, iterations: s.iterations, version: s.version });
  const res = await putSinVault(body);
  s.version = res.version;
}

let pushing: Promise<void> = Promise.resolve();

/** Seals the current programs and PUTs them (after a check-in). No-op while locked. Never throws. */
export function pushVault(): Promise<void> {
  pushing = pushing.then(async () => {
    const s = session;
    if (!s) return;
    try {
      await put(s);
      setStatus('unlocked');
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 409) return; // offline or server error: the next change retries
      const current = vaultFromConflict(e.rawDetails) ?? (await getSinVault().catch(() => null));
      if (!current) return;
      if (current.salt !== s.salt) {
        // The code was changed on another device: this key cannot open it any more.
        session = null;
        setStatus('locked');
        return;
      }
      try {
        adoptPrograms(mergePrograms(localPrograms(), openPrograms(current, s.key)));
        s.version = current.version;
        await put(s);
      } catch {
        // try again on the next change
      }
    }
  });
  return pushing;
}

/** After unlocking: merge the vault into this device and push if this device had more. */
async function startSession(s: Session, remotePrograms: SinProgram[], remember: boolean): Promise<void> {
  session = s;
  const merged = mergePrograms(localPrograms(), remotePrograms);
  adoptPrograms(merged);
  if (remember) await rememberKey(s);
  if (!sameJsonPrograms(merged, remotePrograms)) await pushVault();
  setStatus('unlocked');
}

/**
 * Called on sign-in and foreground: retries a pending DELETE, then finds out whether a vault exists and opens it
 * with the session or remembered key. Never throws.
 */
export async function refreshVault(userId: string): Promise<void> {
  try {
    const meta = await loadMeta();
    if (meta.deletePendingFor === userId) {
      await deleteSinVault();
      await saveMeta({});
    }
    const remote = await getSinVault();
    if (!remote) {
      session = null;
      setStatus('none');
      return;
    }
    if (session && session.userId === userId && session.salt === remote.salt) {
      session.version = remote.version;
      await startSession(session, openPrograms(remote, session.key), false);
      return;
    }
    const key = await rememberedKey(userId, remote.salt);
    if (key) {
      try {
        const s: Session = { userId, key, salt: remote.salt, iterations: remote.iterations, version: remote.version };
        await startSession(s, openPrograms(remote, key), false);
        return;
      } catch {
        await forgetRememberedKey();
      }
    }
    session = null;
    setStatus('locked');
  } catch {
    // offline: keep what we know
  }
}

/** «احفظ البرنامج مشفّرًا في حسابك»: first vault for this account. Returns an error key or null. */
export async function enableVault(userId: string, code: string, remember: boolean): Promise<string | null> {
  setStatus('working');
  try {
    if (await getSinVault()) {
      setStatus('locked');
      return 'exists';
    }
    await yieldToUi();
    const salt = newSalt();
    // 210,000, not practice-core VAULT_ITERATIONS: the KDF is pure JS, and on Hermes (no JIT) 600,000 may block the
    // screen for many seconds. Raise it once it is measured on a low-end Android (each vault keeps its own count).
    const key = deriveKey(code, salt, MIN_VAULT_ITERATIONS);
    const s: Session = { userId, key, salt, iterations: MIN_VAULT_ITERATIONS, version: 0 };
    await put(s);
    session = s;
    if (remember) await rememberKey(s);
    setStatus('unlocked');
    return null;
  } catch (e) {
    setStatus('none');
    return e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR') ? 'offline' : 'failed';
  }
}

/** Opens the account's vault with the privacy code (another device). Returns an error key or null. */
export async function unlockWithCode(userId: string, code: string, remember: boolean): Promise<string | null> {
  setStatus('working');
  try {
    const remote = await getSinVault();
    if (!remote) {
      setStatus('none');
      return 'missing';
    }
    await yieldToUi();
    let opened: { programs: SinProgram[]; key: Uint8Array };
    try {
      opened = unlockVault({ ...remote, kdf: remote.kdf as 'pbkdf2-sha256' }, code);
    } catch (e) {
      setStatus('locked');
      return e instanceof VaultLockedError ? 'wrongCode' : 'failed';
    }
    const s: Session = { userId, key: opened.key, salt: remote.salt, iterations: remote.iterations, version: remote.version };
    await startSession(s, opened.programs, remember);
    return null;
  } catch (e) {
    setStatus(session ? 'unlocked' : 'locked');
    return e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR') ? 'offline' : 'failed';
  }
}

/** «تذكّر على هذا الجهاز» switch. */
export async function setRememberKey(on: boolean): Promise<void> {
  if (on && session) await rememberKey(session);
  if (!on) await forgetRememberedKey();
}

/** Locks the vault on this device (sign-out): drops the in-memory key and the keystore entry. */
export async function lockVault(): Promise<void> {
  session = null;
  await forgetRememberedKey();
  setStatus('unknown');
}

/**
 * «احذف كل بيانات البرنامج»: the local programs, check-ins and notes, the in-memory key, the keystore entry, and
 * (signed in) the vault on the server. An offline DELETE is retried on the next refresh.
 */
export async function wipeSinProgramEverywhere(userId: string | null): Promise<void> {
  session = null;
  await usePracticeStore.getState().wipePrograms();
  await forgetRememberedKey();
  setStatus(userId ? 'none' : 'unknown');
  if (!userId) return;
  try {
    await deleteSinVault();
    await saveMeta({});
  } catch {
    await saveMeta({ deletePendingFor: userId });
  }
}
