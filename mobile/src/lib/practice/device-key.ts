/**
 * The device key of the on-device «تخفَّف» copy (owner round 8, Q1): 32 random bytes made on this device and kept in
 * the keystore (expo-secure-store: iOS Keychain `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, Android Keystore-backed). No
 * biometrics are needed to read it: the app opens its own programs in the background of the screens, and the privacy
 * lock (SinProgramGuard) is a separate layer. The programs are sealed with it (practice-core `sealForDevice`) before
 * they reach AsyncStorage, so the file on the device holds only ciphertext. Sign-out deletes the key.
 *
 * Off the phone (the Expo web export used for review) there is no keystore: the key sits in AsyncStorage so the
 * export still behaves like the app. That is a development convenience, not a shipped target.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { decodeDeviceKey, encodeDeviceKey, newDeviceKey } from '@thekra/practice-core';

export const DEVICE_KEY_STORE = 'thekra.device.sinKey';

const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let cached: Uint8Array | null = null;
let making: Promise<Uint8Array | null> | null = null;

async function readStored(): Promise<string | null> {
  return NATIVE ? SecureStore.getItemAsync(DEVICE_KEY_STORE, OPTIONS) : AsyncStorage.getItem(DEVICE_KEY_STORE);
}

async function writeStored(text: string): Promise<void> {
  if (NATIVE) await SecureStore.setItemAsync(DEVICE_KEY_STORE, text, OPTIONS);
  else await AsyncStorage.setItem(DEVICE_KEY_STORE, text);
}

/**
 * The device key. `create`: make and keep one when there is none (first program); otherwise null when there is none.
 * Throws when the keystore fails (the caller keeps the data in memory and never writes it in clear).
 */
export async function getDeviceKey(create: boolean): Promise<Uint8Array | null> {
  if (cached) return cached;
  const stored = decodeDeviceKey(await readStored());
  if (stored) {
    cached = stored;
    return stored;
  }
  if (!create) return null;
  if (!making) {
    making = (async () => {
      const fresh = newDeviceKey();
      await writeStored(encodeDeviceKey(fresh));
      cached = fresh;
      return fresh;
    })().finally(() => {
      making = null;
    });
  }
  return making;
}

/** Deletes the key (sign-out): the sealed programs can no longer be opened. Never throws. */
export async function forgetDeviceKey(): Promise<void> {
  cached = null;
  try {
    if (NATIVE) await SecureStore.deleteItemAsync(DEVICE_KEY_STORE, OPTIONS);
    else await AsyncStorage.removeItem(DEVICE_KEY_STORE);
  } catch {
    // Nothing stored.
  }
}
