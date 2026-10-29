/**
 * Local notifications with expo-notifications 57 (no push server, mobile-plan §3.2):
 * - permission is asked only when the user turns a reminder on (`ensurePermission`), never at launch;
 * - one Android channel (`thekra-reminders`), lock-screen visibility PRIVATE;
 * - `applyReminders` cancels only the notifications this feature scheduled (`data.source`) and schedules
 *   the planned list with DATE triggers. It runs after every change and on every foreground (see
 *   use-practice-lifecycle.ts), so the rolling 14-day window stays fresh.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { REMINDER_SOURCE, type PlannedReminder } from './reminders';

export const CHANNEL_ID = 'thekra-reminders';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let handlerSet = false;

/** Shows reminders as banners while the app is open. Call once at startup. */
export function configureNotificationHandler(): void {
  if (!supported || handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

export async function hasPermission(): Promise<boolean> {
  if (!supported) return false;
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Asks for permission if not granted yet. Call from the switch the user just turned on. */
export async function ensurePermission(channelName: string): Promise<boolean> {
  if (!supported) return false;
  // Android 13+: the channel must exist before the system permission prompt appears.
  await ensureChannel(channelName);
  if (await hasPermission()) return true;
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return res.granted || res.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function toDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y as number, (m as number) - 1, d as number, hh as number, mm as number, 0, 0);
}

let applying: Promise<void> = Promise.resolve();

/** Replaces this feature's pending notifications with `planned`. Serialized; never throws. */
export function applyReminders(planned: readonly PlannedReminder[], channelName: string): Promise<void> {
  applying = applying.then(() => doApply(planned, channelName)).catch(() => undefined);
  return applying;
}

async function doApply(planned: readonly PlannedReminder[], channelName: string): Promise<void> {
  if (!supported) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.source === REMINDER_SOURCE)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (planned.length === 0 || !(await hasPermission())) return;
  await ensureChannel(channelName);
  const now = Date.now();
  for (const r of planned) {
    const when = toDate(r.date, r.time);
    if (when.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { source: REMINDER_SOURCE, route: r.route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
    });
  }
}

/** How many of this feature's reminders are scheduled on the device now (the Settings overview). Never throws. */
export async function scheduledReminderCount(): Promise<number> {
  if (!supported) return 0;
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    return existing.filter((n) => (n.content.data as Record<string, unknown> | undefined)?.source === REMINDER_SOURCE).length;
  } catch {
    return 0;
  }
}

/** The tap already opened (the launch tap can come both from the last response and from the listener). */
let handledTap: string | null = null;

function openReminderTap(response: Notifications.NotificationResponse, open: (route: string) => void): void {
  const key = `${response.notification.request.identifier}@${response.notification.date}`;
  if (key === handledTap) return;
  handledTap = key;
  // Cleared so a later JS reload (language switch) does not open it again.
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Unavailable on this platform: the key above still keeps it to one open.
  }
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.source === REMINDER_SOURCE && typeof data.route === 'string') open(data.route);
}

/**
 * Opens the screen of a tapped reminder, once: a tap while the app runs, and the tap that launched it from closed
 * (`getLastNotificationResponse`). Returns the unsubscribe function.
 */
export function onReminderTapped(open: (route: string) => void): () => void {
  if (!supported) return () => undefined;
  try {
    const launchTap = Notifications.getLastNotificationResponse();
    if (launchTap) openReminderTap(launchTap, open);
  } catch {
    // Unavailable on this platform.
  }
  const sub = Notifications.addNotificationResponseReceivedListener((response) => openReminderTap(response, open));
  return () => sub.remove();
}
