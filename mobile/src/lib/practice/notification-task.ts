/**
 * Android: «تمّ» pressed on a habit reminder while the app is in the background or closed. expo-notifications 57
 * runs a TaskManager task for a notification button press in that case (`registerTaskAsync` docs); the task must be
 * defined at module scope of a module the entry loads first (index.ts), because no screen mounts when it runs.
 * iOS delivers the press to the response listener instead (notifications.ts `onReminderTapped`).
 */

// First, as in app/_layout.tsx: the store loads practice-core, whose vault needs `crypto.getRandomValues` on Hermes.
import '../crypto/install';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleLogAction } from './notifications';

export const LOG_ACTION_TASK = 'thekra-reminder-action';

if (Platform.OS === 'android') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(LOG_ACTION_TASK, async ({ data }) => {
    await handleLogAction(data);
  });
  void Notifications.registerTaskAsync(LOG_ACTION_TASK).catch(() => undefined);
}
