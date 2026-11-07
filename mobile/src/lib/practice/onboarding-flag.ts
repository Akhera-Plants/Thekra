/** The «shown once» flag of the onboarding (owner round 5, F-26 a), on this device. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = 'thekra.onboarding.v1';

export async function onboardingSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'seen';
  } catch {
    return true; // unreadable storage: never block the app on it
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'seen');
  } catch {
    // best effort
  }
}

