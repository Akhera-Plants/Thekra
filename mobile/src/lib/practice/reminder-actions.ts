/**
 * «تمّ» on a habit reminder: the pure part (which notification, which plan and day, what to log).
 * notifications.ts registers the action and runs it; this file has no React Native imports, so it runs in Jest.
 *
 * Only habit reminders carry the action. Kinship and sin-program reminders never do: the sin-program reminder stays
 * generic, with nothing that could reveal what it is about (roadmap §0.2).
 */

import { logDone, requiredOn, updatePlan, type LocalDate, type Store } from '@thekra/practice-core';
import { REMINDER_SOURCE } from './reminders';

/** The notification category of habit reminders (it holds the «تمّ» button). */
export const HABIT_CATEGORY = 'thekra-habit';
/** The action id of «تمّ». */
export const LOG_ACTION = 'log-done';

/** `${REMINDER_SOURCE}:habit:<planId>:<date>:<HH:MM>`, see reminders.ts. */
const HABIT_ID = new RegExp(`^${REMINDER_SOURCE}:habit:([0-9A-Za-z-]+):(\\d{4}-\\d{2}-\\d{2}):\\d{2}:\\d{2}$`);

export interface LogActionRequest {
  notificationId: string;
  planId: string;
  date: LocalDate;
  /** The quiet confirmation, when the reminder carried one. */
  confirm: { title: string; body: string } | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The notification data: an object on iOS and in the JS listener; a JSON string (`dataString`) in Android's task. */
function contentData(content: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(content.data)) return content.data;
  if (typeof content.dataString === 'string') {
    try {
      const parsed: unknown = JSON.parse(content.dataString);
      if (isRecord(parsed)) return parsed;
    } catch {
      // not ours
    }
  }
  return {};
}

/**
 * The «تمّ» press in a notification response (from the listener, `getLastNotificationResponse` or the background
 * task), or null for any other response: a plain tap, another action, another app feature's notification.
 */
export function parseLogAction(response: unknown): LogActionRequest | null {
  if (!isRecord(response) || response.actionIdentifier !== LOG_ACTION) return null;
  const request = isRecord(response.notification) && isRecord(response.notification.request) ? response.notification.request : null;
  if (!request || typeof request.identifier !== 'string') return null;
  const match = HABIT_ID.exec(request.identifier);
  if (!match) return null;
  const data = isRecord(request.content) ? contentData(request.content) : {};
  if (data.source !== REMINDER_SOURCE) return null;
  const confirm =
    typeof data.confirmTitle === 'string' && typeof data.confirmBody === 'string'
      ? { title: data.confirmTitle, body: data.confirmBody }
      : null;
  return { notificationId: request.identifier, planId: match[1] as string, date: match[2] as LocalDate, confirm };
}

/**
 * Logs what is left of `date` for the plan: the hub's own check (`updatePlan` + `logDone` with the remaining
 * amount). Pressing «تمّ» twice, or a press that arrives twice, logs nothing the second time.
 */
export function logRemaining(store: Store, planId: string, date: LocalDate): { store: Store; logged: number } {
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) return { store, logged: 0 };
  const remaining = requiredOn(plan, date) - (plan.log[date] ?? 0);
  if (remaining <= 0) return { store, logged: 0 };
  return { store: updatePlan(store, planId, (p) => logDone(p, date, remaining)), logged: remaining };
}
