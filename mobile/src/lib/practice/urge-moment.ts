/**
 * «لحظة الضعف» (docs/plan/2026-10-tazkiya-tracker-proposals.md item 3). LOCAL ONLY (roadmap §0.1, §0.2):
 * - the program reaches the modal in memory (`setUrgeProgram` / `urgeProgram`), never in the route or its params;
 * - the step's text is one of the evidence texts already fetched for ALL programs (`useSinProgramEvidence`), so opening
 *   the moment makes no request of its own;
 * - «أجّل عشر دقائق» schedules one local notification whose only words are «تذكرة من ذكرى».
 * The steps' wording comes from the catalog (`common.urgeMoment`), reviewed by the sheikh.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { toDayNumber, type LocalDate } from '@thekra/practice-core';
import type { QuoteDto } from '../types/api';
import type { CatalogSinProgram, UrgeMoment } from './catalog-types';
import { CHANNEL_ID, ensurePermission } from './notifications';
import { SIN_REMINDER_TITLE } from './reminders';

/** The guided steps, in order; the end («تجاوزتها» / «وقعت») comes after them. */
export const URGE_STEPS = ['breathe', 'text', 'move', 'delay', 'companion'] as const;
export type UrgeStep = (typeof URGE_STEPS)[number];

/** `data.source` of the check-back: not the reminders' source, so their rescheduling never cancels it. */
export const URGE_CHECKBACK_SOURCE = 'thekra-urge';
const URGE_CHECKBACK_ID = `${URGE_CHECKBACK_SOURCE}:checkback`;
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let handoff: string | null = null;

/** The program page hands its program to the modal here, in memory only; the modal clears it once read. */
export function setUrgeProgram(sinSlug: string | null): void {
  handoff = sinSlug;
}

/** The program handed over, or null when the modal was opened any other way. */
export function urgeProgram(): string | null {
  return handoff;
}

/** The candidates for the moment's text: the step's own texts first, then the program's. */
export function momentTextIds(urge: UrgeMoment, entry: CatalogSinProgram | undefined): string[] {
  return [...new Set([...(urge.text.evidence ?? []), ...(entry?.evidence ?? [])])];
}

/** One published text for today, turning through the candidates day by day; null when none was published. */
export function pickMomentText(ids: readonly string[], byId: ReadonlyMap<string, QuoteDto> | undefined, today: LocalDate): QuoteDto | null {
  const published = ids.flatMap((id) => byId?.get(id) ?? []);
  if (published.length === 0) return null;
  return published[toDayNumber(today) % published.length] ?? null;
}

/**
 * «أجّل عشر دقائق»: one gentle local notification after `minutes` (an earlier one is replaced). The permission is
 * asked here, at the moment of intent. Returns whether it was scheduled; it never throws.
 */
export async function scheduleUrgeCheckBack(minutes: number, channelName: string): Promise<boolean> {
  if (!supported) return false;
  try {
    if (!(await ensurePermission(channelName))) return false;
    await Notifications.cancelScheduledNotificationAsync(URGE_CHECKBACK_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: URGE_CHECKBACK_ID,
      content: { body: SIN_REMINDER_TITLE, data: { source: URGE_CHECKBACK_SOURCE } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}
