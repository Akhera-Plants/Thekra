/**
 * Browser side of web push reminders (docs/plan/2026-10-web-push.md §5): turn them on and off for this browser,
 * re-send the subscription on signed-in visits (keys rotate, the zone may change), a test notification, and the
 * clean-up on sign-out. The worker that shows them is public/sw.js (registered in production builds only).
 */
import {
  deletePushSubscription,
  getPushConfig,
  postPushSubscription,
  postPushTest,
  type PushConfig,
} from '@/lib/api/push';
import { reportFailure } from '@/lib/errors';
import type { LocaleCode } from '@/lib/types/enums';
import { base64UrlToUint8Array, isSameServerKey, needsHomeScreenInstall, type PushDeviceSupport } from './push-support';

/** The worker registers after `load`; development never registers it, so waiting must end. */
const WORKER_READY_TIMEOUT_MS = 10_000;
/** Sign-out never waits longer than this for the push clean-up. */
const SIGN_OUT_CLEANUP_MS = 3_000;

class PushUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PushUnavailableError';
  }
}

function hasPushApis(): boolean {
  return (
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  );
}

function isStandalone(): boolean {
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return legacy || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** For `useSyncExternalStore`: a primitive, so the snapshot is stable. */
export function pushDeviceSupport(): PushDeviceSupport {
  if (typeof window === 'undefined') return 'unknown';
  const device = { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone: isStandalone() };
  if (needsHomeScreenInstall(device)) return 'iosInstall';
  return hasPushApis() ? 'push' : 'none';
}

let configPromise: Promise<PushConfig> | null = null;
/** One re-send per account and language per page load ({@link refreshPushSubscription}). */
let refreshedFor: string | null = null;

/** `/push/config`, once per page load (a failure is not kept, so the next call asks again). */
export function loadPushConfig(): Promise<PushConfig> {
  configPromise ??= getPushConfig().catch((error: unknown) => {
    configPromise = null;
    throw error;
  });
  return configPromise;
}

/** After a 503 `PUSH_DISABLED`: the cached config was stale. */
export function forgetPushConfig(): void {
  configPromise = null;
}

async function existingRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!hasPushApis()) return undefined;
  return navigator.serviceWorker.getRegistration('/');
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PushUnavailableError('service worker not ready')), WORKER_READY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await existingRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

interface BrowserPushState {
  permission: NotificationPermission;
  /** This browser holds a push subscription for the site. */
  subscribed: boolean;
}

export async function readBrowserPush(): Promise<BrowserPushState> {
  if (!hasPushApis()) return { permission: 'default', subscribed: false };
  const subscription = await currentSubscription();
  return { permission: Notification.permission, subscribed: subscription !== null };
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function sendSubscription(subscription: PushSubscription, locale: LocaleCode): Promise<void> {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new PushUnavailableError('subscription without keys');
  await postPushSubscription({
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    timeZone: browserTimeZone(),
    locale,
  });
}

/**
 * This browser's subscription made with the server's current key. One made with an older key (the server rotated
 * it) is removed here and on the server, then replaced.
 */
async function subscriptionForKey(registration: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const key = base64UrlToUint8Array(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && isSameServerKey(existing.options.applicationServerKey, key)) return existing;
  if (existing) {
    await deletePushSubscription(existing.endpoint).catch((error: unknown) => reportFailure('push old key', error));
    await existing.unsubscribe();
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

async function enabledKey(): Promise<string> {
  const config = await loadPushConfig();
  if (!config.enabled || !config.publicKey) throw new PushUnavailableError('push is off on the server');
  return config.publicKey;
}

type EnablePushResult = 'on' | 'denied' | 'dismissed';

/**
 * Asks for the permission. Call it synchronously inside the click handler: browsers (Safari above all) show the
 * prompt only while the click is being handled, so it cannot wait for anything first.
 */
export function requestPushPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

/** «فعّل التنبيهات», with the answer of {@link requestPushPermission} started in the same click. */
export async function enablePush(locale: LocaleCode, permissionRequest: Promise<NotificationPermission>): Promise<EnablePushResult> {
  const permission = await permissionRequest;
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';
  const publicKey = await enabledKey();
  const registration = await readyRegistration();
  const hadOne = (await registration.pushManager.getSubscription()) !== null;
  const subscription = await subscriptionForKey(registration, publicKey);
  try {
    await sendSubscription(subscription, locale);
  } catch (error) {
    // The server does not know it, so do not leave the browser saying «on».
    if (!hadOne) await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
  return 'on';
}

/**
 * «إيقاف» and sign-out: tell the server to forget this browser, then drop the subscription. The local unsubscribe
 * always runs, so no reminder can show here even if the server could not be reached (it drops the dead address at
 * its next delivery).
 */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await deletePushSubscription(subscription.endpoint);
  } catch (error) {
    reportFailure('push unsubscribe', error);
  }
  await subscription.unsubscribe();
}

/** Best effort while the access token is still valid; never fails or delays sign-out beyond a few seconds. */
export async function removePushOnSignOut(): Promise<void> {
  refreshedFor = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_CLEANUP_MS);
  });
  try {
    await Promise.race([disablePush().catch((error: unknown) => reportFailure('push sign-out', error)), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * On a signed-in visit: if this browser already receives reminders, send its subscription again (keys rotate, the
 * zone or language may have changed). Quiet: nothing to show when it fails, the next visit tries again.
 */
export async function refreshPushSubscription(account: string, locale: LocaleCode): Promise<void> {
  const key = `${account}|${locale}`;
  if (refreshedFor === key || !hasPushApis() || Notification.permission !== 'granted') return;
  refreshedFor = key;
  try {
    const registration = await existingRegistration();
    if (!registration || !(await registration.pushManager.getSubscription())) return;
    const config = await loadPushConfig();
    if (!config.enabled || !config.publicKey) return;
    await sendSubscription(await subscriptionForKey(registration, config.publicKey), locale);
  } catch (error) {
    refreshedFor = null;
    reportFailure('push refresh', error);
  }
}

/** «أرسل تنبيهًا تجريبيًا». ApiError 404 when the server does not know this browser. */
export async function sendTestPush(locale: LocaleCode): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) throw new PushUnavailableError('no subscription');
  await postPushTest(subscription.endpoint, locale);
}
