/**
 * Privacy of «تخفَّف» on the device (roadmap §0.2):
 * - the device unlock (expo-local-authentication, biometrics with the device passcode as the fallback), used when the
 *   account cannot be reached to open the device copy (the usual opening reads the kept vault key behind biometrics,
 *   see vault-runner.ts);
 * - the page draws an opaque cover whenever the app is not in the foreground (`useAppInForeground`).
 * Screenshots are never blocked anywhere in the app (owner round 3, item 1: no FLAG_SECURE, no screen-capture lock).
 */

import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/** The native modules do nothing on the web build. */
const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

export interface DeviceUnlockLabels {
  promptMessage: string;
  cancelLabel: string;
}

/** Biometrics or a device passcode is set up, so the lock can be offered. */
export async function isDeviceLockAvailable(): Promise<boolean> {
  if (!NATIVE) return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/**
 * One system prompt (biometrics, then the device passcode). False on cancel, failure or any error.
 * True without a prompt when the device no longer has any lock: removing it already took that lock, and the
 * program must not become unreachable.
 */
export async function unlockWithDevice({ promptMessage, cancelLabel }: DeviceUnlockLabels): Promise<boolean> {
  if (!NATIVE) return false;
  try {
    // Only a confirmed «no lock at all» skips the prompt; an error while checking stays locked (fail closed).
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel });
    return result.success;
  } catch {
    return false;
  }
}

/** Whether the lock can be offered on this device: null while checking. */
export function useDeviceLockAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void isDeviceLockAvailable().then((value) => {
      if (mounted) setAvailable(value);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return available;
}

/** False as soon as the app leaves the foreground (iOS `inactive` comes before the app-switcher snapshot). */
export function useAppInForeground(): boolean {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  return foreground;
}
