/** When the whole-app cover for the app switcher is drawn (components/practice/PrivacyCover.tsx). Pure. */
export type CoverVaultStatus = 'unknown' | 'none' | 'locked' | 'unlocked' | 'working' | 'offline';

/** «تخفَّف» holds something on this device or account: a program here, or a vault in the account. */
export function hasSinData(programsOnDevice: number, vault: CoverVaultStatus): boolean {
  return programsOnDevice > 0 || vault === 'locked' || vault === 'unlocked' || vault === 'working';
}

/** Covered whenever the app is not in the foreground and there is a program to protect, on any screen. */
export function shouldCover(foreground: boolean, programsOnDevice: number, vault: CoverVaultStatus): boolean {
  return !foreground && hasSinData(programsOnDevice, vault);
}
