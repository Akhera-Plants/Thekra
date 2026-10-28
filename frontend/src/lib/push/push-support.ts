/**
 * Pure parts of web push (docs/plan/2026-10-web-push.md): the VAPID key decoding, the iPhone/iPad rule and which
 * state the reminders card shows. No browser globals here, so they run in unit tests.
 */

/** The VAPID public key (base64url, padding optional) as the bytes `pushManager.subscribe` expects. */
export function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/**
 * Whether a subscription was made with `expected` (the server's current key). A browser that does not report the
 * key (`null`) is taken as matching, so it is not resubscribed on every visit.
 */
export function isSameServerKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

export interface DeviceInfo {
  userAgent: string;
  maxTouchPoints: number;
  /** Opened from the home-screen icon (`navigator.standalone` or display-mode standalone). */
  standalone: boolean;
}

/** iPhone, iPod, or an iPad (iPadOS reports itself as a Mac, but with a touch screen). */
export function isAppleMobile({ userAgent, maxTouchPoints }: Pick<DeviceInfo, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** iOS/iPadOS deliver web push only to a site added to the home screen and opened from its icon (16.4+). */
export function needsHomeScreenInstall(device: DeviceInfo): boolean {
  return isAppleMobile(device) && !device.standalone;
}

/** What this browser can do: `unknown` until the page runs in the browser. */
export type PushDeviceSupport = 'unknown' | 'push' | 'iosInstall' | 'none';

export type PushCardState = 'hidden' | 'unsupported' | 'iosInstall' | 'signedOut' | 'denied' | 'off' | 'on';

export interface PushCardInput {
  /** Accounts are on for this deployment (reminders are per account). */
  accounts: boolean;
  device: PushDeviceSupport;
  /** `undefined` while `/push/config` loads or when it failed. */
  serverEnabled: boolean | undefined;
  sessionLoading: boolean;
  signedIn: boolean;
  /** `undefined` while the browser's permission and subscription are read. */
  browser: { permission: NotificationPermission; subscribed: boolean } | undefined;
}

/**
 * The one state the card shows. Hidden while anything is unknown and whenever push cannot work for anyone here
 * (no accounts, server push off), so the page never flashes a card that then disappears.
 */
export function pushCardState(input: PushCardInput): PushCardState {
  if (!input.accounts || input.device === 'unknown' || input.serverEnabled !== true) return 'hidden';
  if (input.device === 'iosInstall') return 'iosInstall';
  if (input.device === 'none') return 'unsupported';
  if (input.sessionLoading) return 'hidden';
  if (!input.signedIn) return 'signedOut';
  if (!input.browser) return 'hidden';
  if (input.browser.permission === 'denied') return 'denied';
  return input.browser.permission === 'granted' && input.browser.subscribed ? 'on' : 'off';
}
