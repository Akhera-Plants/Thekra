/**
 * Privacy of the sin-program page (roadmap §0.2; owner decision 2026-10-29), on this device only:
 * - the optional lock («قفل برنامج الترك بالبصمة», `prefs.sinLock`): expo-local-authentication, with the device
 *   passcode as the fallback; offered only when the device has biometrics or a passcode set up;
 * - while the page is open: screenshots and recordings are blocked and the app-switcher snapshot is hidden
 *   (expo-screen-capture: FLAG_SECURE on Android, the system blur on iOS), and the page draws an opaque cover
 *   whenever the app is not in the foreground (`useAppInForeground`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

/** The native modules do nothing on the web build. */
const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';
const CAPTURE_KEY = 'sin-program';
/** iOS app-switcher blur at full strength (0..1). */
const SWITCHER_BLUR = 1;

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

/** Blocks screenshots and hides the app-switcher snapshot while the calling screen is mounted. */
export function useHideFromCapture(): void {
  useEffect(() => {
    if (!NATIVE) return;
    void ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
    if (Platform.OS === 'ios') void ScreenCapture.enableAppSwitcherProtectionAsync(SWITCHER_BLUR).catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
      if (Platform.OS === 'ios') void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, []);
}

export type SinLockState = 'open' | 'locked' | 'unlocking';

/**
 * The lock of the page when `enabled`: locked on opening, the system prompt shown at once, locked again after the
 * app has been in the background (and the prompt shown again on return). A cancelled or failed prompt stays
 * `locked`; `unlock` tries again.
 */
export function useSinProgramLock(enabled: boolean, { promptMessage, cancelLabel }: DeviceUnlockLabels): { state: SinLockState; unlock: () => void } {
  const [state, setState] = useState<SinLockState>('locked');
  // The passcode screen on Android is its own activity: the app goes to the background while it is up.
  const prompting = useRef(false);

  const unlock = useCallback(() => {
    if (prompting.current) return;
    prompting.current = true;
    setState('unlocking');
    void unlockWithDevice({ promptMessage, cancelLabel }).then((ok) => {
      prompting.current = false;
      setState(ok ? 'open' : 'locked');
    });
  }, [promptMessage, cancelLabel]);

  useEffect(() => {
    if (enabled) unlock();
    // Once per opening (or when the lock is switched on): not again when only the prompt's words change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let wasBackground = false;
    const subscription = AppState.addEventListener('change', (next) => {
      if (prompting.current) return;
      if (next === 'background') {
        wasBackground = true;
        setState('locked');
      } else if (next === 'active' && wasBackground) {
        wasBackground = false;
        unlock();
      }
    });
    return () => subscription.remove();
  }, [enabled, unlock]);

  return { state: enabled ? state : 'open', unlock };
}
