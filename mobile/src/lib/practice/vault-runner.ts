/**
 * «تخفَّف» always encrypted in the account (owner decision 2026-11-01; client steps
 * docs/plan/2026-11-01-sin-vault-always-on.md, contract docs/plan/2026-10-practice-sync-contract.md §3 «Sin vault»).
 *
 * - The first program creates the vault: the member picks a «رمز الخصوصية» once (`createVaultWithCode`); practice-core
 *   derives the key on the device (`createVault`, PBKDF2-SHA256, a fresh salt), seals the programs (AES-256-GCM) and the
 *   app PUTs the opaque payload. The server cannot read it. A forgotten code cannot be recovered («ابدأ من جديد»).
 * - The key is then kept on the device in expo-secure-store **behind biometrics** (`requireAuthentication`; record from
 *   practice-core `serializeVaultKey`), never the code. Opening «تخفَّف» asks for the fingerprint / face only
 *   (`openWithDevice`); without biometrics, or when the keystore entry is gone (new phone, biometrics changed), the code
 *   is asked again (`unlockWithCode`).
 * - Autosave: every change of the programs while the key is in memory is sealed and PUT again (debounced by
 *   use-practice-lifecycle). A stale version → 409 SIN_VAULT_CONFLICT: the current vault (from the error details) is
 *   opened with the same key, merged (vault-merge.ts) and PUT once more. Offline or a server error: the change waits
 *   in `pending` and is retried on the next refresh (foreground, sign-in, practice sync) and the next change.
 * - The lifecycle refresh (`refreshVault`) never reads the keystore (that would ask for the fingerprint at every
 *   foreground): it learns whether a vault exists, merges and saves while the key is in memory.
 * - Sign-out locks the vault and clears the kept key; the device copy of the programs is wiped with the rest of the
 *   practice data (`usePracticeStore.wipeAll`, owner round 8, Q1); «ابدأ من جديد» also DELETEs the vault.
 * - Round 7 (C6, owner): the code is optional. A member who skips it keeps the programs on this device only (status
 *   `none`): they are never sent (the practice sync refuses programs; nothing is sealed without a key), and sealed on the
 *   device (round 8, Q1). Sign-out removes them, after a warning. Setting the code later (`createVaultWithCode`) seals
 *   them into the account.
 * Never logs anything from the programs, the code or the key.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import {
  MIN_VAULT_ITERATIONS,
  VaultLockedError,
  createVault,
  openPrograms,
  parseVaultKey,
  sealVault,
  serializeVaultKey,
  unlockVault,
  type SinProgram,
} from '@thekra/practice-core';
import { deleteSinVault, getSinVault, putSinVault } from '../api/practice';
import { ApiError } from '../types/api';
import type { RemoteVault } from './catalog-types';
import { usePracticeStore } from './practice-store';
import { unlockWithDevice } from './use-sin-privacy';
import { mergePrograms, sameJsonPrograms } from './vault-merge';

export const VAULT_KEY_STORE = 'thekra.sinVault.key';
const VAULT_META_KEY = 'thekra.practice.vault.v1';

/**
 * UI state. `none`: the account has no vault yet; `locked`: a vault exists and the key is not in memory; `unlocked`:
 * the key is in memory and changes are saved; `offline`: the account could not be reached (the device copy is shown
 * after the device lock). `error` is an i18n key under `vault.errors`.
 */
export type VaultStatus = 'unknown' | 'none' | 'locked' | 'unlocked' | 'working' | 'offline';
export const useVaultState = create<{ status: VaultStatus; error: string | null; pending: boolean }>(() => ({
  status: 'unknown',
  error: null,
  pending: false,
}));

interface Session {
  userId: string;
  key: Uint8Array;
  salt: string;
  iterations: number;
  version: number;
}

// In memory only, never in Zustand state (nothing should be able to render or persist it by accident).
let session: Session | null = null;
// The last vault read from the account (ciphertext only), so the device unlock does not need a second request.
let lastRemote: { userId: string; vault: RemoteVault } | null = null;

function setStatus(status: VaultStatus, error: string | null = null): void {
  useVaultState.setState({ status, error });
}

function setPending(pending: boolean): void {
  if (useVaultState.getState().pending !== pending) useVaultState.setState({ pending });
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

const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

/** The keystore can hold the key behind biometrics on this device. */
export function canKeepKeyBehindBiometrics(): boolean {
  if (!NATIVE) return false;
  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

function secureOpts(prompt?: string): SecureStore.SecureStoreOptions {
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
    ...(prompt ? { authenticationPrompt: prompt } : {}),
  };
}

/** Keeps the key behind biometrics (never the code). Without biometrics nothing is kept: the code is asked next time. */
async function keepKey(s: Session): Promise<void> {
  if (!canKeepKeyBehindBiometrics()) return;
  try {
    const record = serializeVaultKey(s.key, { salt: s.salt, iterations: s.iterations });
    await SecureStore.setItemAsync(VAULT_KEY_STORE, JSON.stringify({ userId: s.userId, record }), secureOpts());
  } catch {
    // The keystore refused (biometrics changed meanwhile): the code is asked next time.
  }
}

export async function forgetKeptKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(VAULT_KEY_STORE, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    // nothing stored
  }
}

/** Reads the kept key: this shows the system fingerprint / face prompt. Null when cancelled, missing or another account's. */
async function readKeptKey(userId: string, prompt: string): Promise<{ key: Uint8Array; salt: string; iterations: number } | null> {
  if (!canKeepKeyBehindBiometrics()) return null;
  try {
    const raw = await SecureStore.getItemAsync(VAULT_KEY_STORE, secureOpts(prompt));
    if (!raw) return null;
    const v = JSON.parse(raw) as { userId?: string; record?: string };
    if (v.userId !== userId || typeof v.record !== 'string') return null;
    return parseVaultKey(v.record);
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

const isOffline = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR');

async function put(s: Session): Promise<void> {
  const res = await putSinVault(sealVault(localPrograms(), s, s.version));
  s.version = res.version;
}

let pushing: Promise<void> = Promise.resolve();

/** Seals the current programs and PUTs them (autosave). Marks `pending` while locked or offline. Never throws. */
export function pushVault(): Promise<void> {
  pushing = pushing.then(async () => {
    const s = session;
    if (!s) {
      setPending(true);
      return;
    }
    try {
      await put(s);
      setPending(false);
      setStatus('unlocked');
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 409) {
        setPending(true); // offline or a server error: retried on the next refresh or change
        return;
      }
      const current = vaultFromConflict(e.rawDetails) ?? (await getSinVault().catch(() => null));
      if (!current) {
        setPending(true);
        return;
      }
      if (current.salt !== s.salt) {
        // The code was changed on another device: this key cannot open it any more.
        session = null;
        await forgetKeptKey();
        setStatus('locked');
        setPending(true);
        return;
      }
      try {
        adoptPrograms(mergePrograms(localPrograms(), openPrograms(current, s.key)));
        s.version = current.version;
        await put(s);
        setPending(false);
      } catch {
        setPending(true);
      }
    }
  });
  return pushing;
}

/** After unlocking: merge the vault into this device and save when this device had more. */
async function startSession(s: Session, remotePrograms: SinProgram[]): Promise<void> {
  session = s;
  const merged = mergePrograms(localPrograms(), remotePrograms);
  adoptPrograms(merged);
  setStatus('unlocked');
  if (!sameJsonPrograms(merged, remotePrograms) || useVaultState.getState().pending) await pushVault();
}

/**
 * Sign-in, foreground and the practice sync: retries a pending DELETE, then finds out whether the account has a vault.
 * With the key in memory it merges and saves; it never reads the keystore (no fingerprint prompt here). Never throws.
 */
export async function refreshVault(userId: string): Promise<void> {
  try {
    const meta = await loadMeta();
    if (meta.deletePendingFor === userId) {
      await deleteSinVault();
      await saveMeta({});
    }
    const remote = await getSinVault();
    lastRemote = remote ? { userId, vault: remote } : null;
    if (!remote) {
      session = null;
      setStatus('none');
      return;
    }
    if (session && session.userId === userId && session.salt === remote.salt) {
      session.version = remote.version;
      await startSession(session, openPrograms(remote, session.key));
      return;
    }
    session = null;
    setStatus('locked');
  } catch (e) {
    if (isOffline(e) && useVaultState.getState().status === 'unknown') setStatus('offline');
  }
}

export type DeviceOpenResult = 'open' | 'none' | 'code' | 'offline' | 'cancelled';

/**
 * Opening «تخفَّف»: the key in memory, else the kept key behind the fingerprint / face, else the code (`code`). No
 * vault yet: `none` (the first program asks for a code). The account cannot be reached: the device lock alone opens
 * the device copy (`offline`; changes wait in `pending`).
 */
export async function openWithDevice(userId: string, labels: { promptMessage: string; cancelLabel: string }): Promise<DeviceOpenResult> {
  if (session && session.userId === userId) return 'open';
  if (!lastRemote || lastRemote.userId !== userId || useVaultState.getState().status === 'unknown') await refreshVault(userId);
  if (session && session.userId === userId) return 'open';
  const status = useVaultState.getState().status;
  if (status === 'none') return 'none';
  if (status === 'offline' || !lastRemote) {
    return (await unlockWithDevice(labels)) ? 'offline' : 'cancelled';
  }
  const remote = lastRemote.vault;
  const kept = await readKeptKey(userId, labels.promptMessage);
  if (!kept) return 'code';
  if (kept.salt !== remote.salt || kept.iterations !== remote.iterations) {
    // The code was changed on another device.
    await forgetKeptKey();
    return 'code';
  }
  try {
    const programs = openPrograms(remote, kept.key);
    await startSession({ userId, key: kept.key, salt: remote.salt, iterations: remote.iterations, version: remote.version }, programs);
    return 'open';
  } catch {
    await forgetKeptKey();
    return 'code';
  }
}

/**
 * The first vault of the account (the first «تخفَّف» program): seals `programs` (the local ones and the new one) with a
 * key from the new code, PUTs it with version 0 and keeps the key. Returns an error key under `vault.errors`, or null.
 */
export async function createVaultWithCode(userId: string, code: string, programs: readonly SinProgram[]): Promise<string | null> {
  setStatus('working');
  try {
    if (await getSinVault()) {
      setStatus('locked');
      return 'exists';
    }
    await yieldToUi();
    // 210,000, not practice-core VAULT_ITERATIONS: the KDF is pure JS, and on Hermes (no JIT) 600,000 may block the
    // screen for many seconds. Raise it once it is measured on a low-end Android (each vault keeps its own count).
    const made = createVault(code, programs, MIN_VAULT_ITERATIONS);
    const res = await putSinVault(made.payload);
    const s: Session = { userId, key: made.key, salt: made.salt, iterations: made.iterations, version: res.version };
    session = s;
    adoptPrograms(mergePrograms(localPrograms(), [...programs]));
    await keepKey(s);
    setPending(false);
    setStatus('unlocked');
    return null;
  } catch (e) {
    setStatus('none');
    return isOffline(e) ? 'offline' : 'failed';
  }
}

/** Opens the account's vault with the privacy code (a new device, or no biometrics). Returns an error key or null. */
export async function unlockWithCode(userId: string, code: string): Promise<string | null> {
  setStatus('working');
  try {
    const remote = await getSinVault();
    if (!remote) {
      setStatus('none');
      return 'missing';
    }
    lastRemote = { userId, vault: remote };
    await yieldToUi();
    let opened: { programs: SinProgram[]; key: Uint8Array };
    try {
      opened = unlockVault({ ...remote, kdf: remote.kdf as 'pbkdf2-sha256' }, code);
    } catch (e) {
      setStatus('locked');
      return e instanceof VaultLockedError ? 'wrongCode' : 'failed';
    }
    const s: Session = { userId, key: opened.key, salt: remote.salt, iterations: remote.iterations, version: remote.version };
    await keepKey(s);
    await startSession(s, opened.programs);
    return null;
  } catch (e) {
    setStatus(session ? 'unlocked' : 'locked');
    return isOffline(e) ? 'offline' : 'failed';
  }
}

/**
 * Sign-out: drops the in-memory key and the kept key (the account keeps the vault). The device copy of the programs is
 * removed by the caller with everything else (`usePracticeStore.wipeAll`), whether or not it was saved: the caller
 * warned about an unsaved one first (`sign-out.ts`).
 */
export async function lockVault(): Promise<void> {
  session = null;
  lastRemote = null;
  await forgetKeptKey();
  useVaultState.setState({ status: 'unknown', error: null, pending: false });
}

/**
 * «ابدأ من جديد» (forgotten code) and «احذف كل بيانات تخفَّف»: the local programs, check-ins, notes and loops, the
 * in-memory key, the kept key, and (signed in) the vault in the account. An offline DELETE is retried on the next refresh.
 */
export async function wipeSinProgramEverywhere(userId: string | null): Promise<void> {
  session = null;
  lastRemote = null;
  await usePracticeStore.getState().wipePrograms();
  await forgetKeptKey();
  useVaultState.setState({ status: userId ? 'none' : 'unknown', error: null, pending: false });
  if (!userId) return;
  try {
    await deleteSinVault();
    await saveMeta({});
  } catch {
    await saveMeta({ deletePendingFor: userId });
  }
}
