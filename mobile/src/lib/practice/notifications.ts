/**
 * Local notifications with expo-notifications 57 (no push server, mobile-plan §3.2):
 * - permission is asked only when the user turns a reminder on (`ensurePermission`), never at launch;
 * - one Android channel (`thekra-reminders`), lock-screen visibility PRIVATE;
 * - `applyReminders` cancels only the notifications this feature scheduled (`data.source`) and schedules
 *   the planned list with DATE triggers. It runs after every change and on every foreground (see
 *   use-practice-lifecycle.ts), so the rolling 14-day window stays fresh.
 * - Habit reminders carry a «تمّ» button (category {@link HABIT_CATEGORY}, `opensAppToForeground: false`). Pressing
 *   it logs what is left of that day without opening the app (`handleLogAction`), then shows a quiet note.
 *   Delivery of the press (expo-notifications 57 docs, `registerTaskAsync` and `NotificationAction`):
 *   - Android, app in the background or killed: the background task in notification-task.ts;
 *   - app running (either platform): the response listener (`onReminderTapped`);
 *   - iOS, app killed: iOS wakes the app in the background; the press reaches JS when the app's JS runs, at the
 *     latest the next time it opens (the date logged is the reminder's own day). Needs a device check.
 *   Kinship and sin-program reminders never get the button.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { flushPracticeWrites, usePracticeStore } from './practice-store';
import { HABIT_CATEGORY, LOG_ACTION, logRemaining, parseLogAction } from './reminder-actions';
import { REMINDER_SOURCE, type PlannedReminder } from './reminders';

export const CHANNEL_ID = 'thekra-reminders';
/** The note after «تمّ»: no sound, no pop-up. */
export const QUIET_CHANNEL_ID = 'thekra-quiet';

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

/**
 * The «تمّ» button of habit reminders and the quiet channel of its note, in the current language. Call before
 * scheduling; repeated calls with the same labels do nothing.
 */
let actionLabels: string | null = null;
export async function setupReminderActions(labels: { done: string; quietChannelName: string }): Promise<void> {
  const key = `${labels.done}|${labels.quietChannelName}`;
  if (!supported || actionLabels === key) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(QUIET_CHANNEL_ID, {
      name: labels.quietChannelName,
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
    });
  }
  await Notifications.setNotificationCategoryAsync(HABIT_CATEGORY, [
    { identifier: LOG_ACTION, buttonTitle: labels.done, options: { opensAppToForeground: false } },
  ]);
  actionLabels = key;
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
    const data: Record<string, unknown> = { source: REMINDER_SOURCE, route: r.route };
    if (r.confirm) {
      data.confirmTitle = r.confirm.title;
      data.confirmBody = r.confirm.body;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        data,
        // Only habit reminders: never on the generic sin-program or the kinship reminder.
        ...(r.kind === 'habit' ? { categoryIdentifier: HABIT_CATEGORY } : {}),
      },
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

/**
 * «تمّ» pressed on a habit reminder: logs what is left of that day (the hub's own `updatePlan` + `logDone`), saves
 * it, takes down the reminder and the rest of that day's reminders for the plan, and shows a quiet note.
 * Works without the UI (Android's background task), so it hydrates the store itself. Never throws; anything that
 * is not a «تمّ» response is ignored.
 */
export async function handleLogAction(response: unknown): Promise<void> {
  const request = parseLogAction(response);
  if (!request || !supported) return;
  try {
    await usePracticeStore.getState().hydrate();
    let logged = 0;
    usePracticeStore.getState().setStore((s) => {
      const result = logRemaining(s, request.planId, request.date);
      logged = result.logged;
      return result.store;
    });
    await flushPracticeWrites();
    await Notifications.dismissNotificationAsync(request.notificationId).catch(() => undefined);
    const prefix = `${REMINDER_SOURCE}:habit:${request.planId}:${request.date}:`;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (logged > 0 && request.confirm) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: request.confirm.title,
          body: request.confirm.body,
          sound: false,
          interruptionLevel: 'passive',
          data: { source: REMINDER_SOURCE, route: `/practice/plan/${request.planId}` },
        },
        trigger: Platform.OS === 'android' ? { channelId: QUIET_CHANNEL_ID } : null,
      });
    }
  } catch {
    // A failed note or cancel must not undo the log; the next re-plan tidies the reminders.
  }
}

/** The tap already opened (the launch tap can come both from the last response and from the listener). */
let handledTap: string | null = null;

function openReminderTap(response: Notifications.NotificationResponse, open: (route: string) => void): void {
  const key = `${response.notification.request.identifier}@${response.notification.date}@${response.actionIdentifier}`;
  if (key === handledTap) return;
  handledTap = key;
  // Cleared so a later JS reload (language switch) does not open or log it again.
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Unavailable on this platform: the key above still keeps it to one open.
  }
  // «تمّ» (and any other button): handled without opening a screen.
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    void handleLogAction(response);
    return;
  }
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.source === REMINDER_SOURCE && typeof data.route === 'string') open(data.route);
}

/**
 * Opens the screen of a tapped reminder, once: a tap while the app runs, and the tap that launched it from closed
 * (`getLastNotificationResponse`). A «تمّ» press goes to {@link handleLogAction} instead (a press that arrives
 * twice logs once). Returns the unsubscribe function.
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
