/**
 * Pure pieces of the «صحبة» screens: what counts as «حضرت اليوم», the invite link and share text, and which
 * sentence an API failure shows. No user data beyond the circle's name and code ever goes into a share.
 */

import type { TFunction } from 'i18next';
import type { AgendaItem, LocalDate, Store } from '@thekra/practice-core';
import { ApiError } from '../types/api';
import { WHOLE_CIRCLE, type CircleMessage, type CircleRound } from '../types/circles';

/**
 * «حضرت اليوم» for the circles: a habit amount or a relative contact on that date. Deliberately not practice-core
 * `presence`, which also counts sin-program check-ins: nothing from the sin program may reach a circle.
 */
export function loggedOn(store: Store, date: LocalDate): boolean {
  return store.plans.some((p) => (p.log[date] ?? 0) > 0) || store.relatives.some((r) => r.history.includes(date));
}

/** The app's deep link that opens the join screen with the code filled in. */
export function inviteLink(code: string): string {
  return `thekra://circles/join?code=${encodeURIComponent(code)}`;
}

/** The app's deep link of a personal صحبة invite (round 6, C-01k): opens «أدخل رمز الدعوة» with the code filled in. */
export function personalInviteLink(code: string): string {
  return `thekra://circles/invite/${encodeURIComponent(code)}`;
}

/** `ABCDEFGHJK` → `ABCDE-FGHJK`: easier to read aloud and to copy by hand. The server ignores the dash. */
export function formatInviteCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** What a typed code may contain before it is sent (the server normalises case, spaces and dashes). */
export function cleanTypedCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 24);
}

/** i18n keys under `circles.errors`, by API error code. */
const ERROR_KEYS: Record<string, string> = {
  CIRCLE_INVITE_INVALID: 'inviteInvalid',
  // Round 6 (C-01k): صحبة is invite-only.
  CIRCLES_NOT_ENABLED: 'notEnabled',
  CIRCLE_INVITE_OWN: 'inviteOwn',
  CIRCLE_INVITES_ACTIVE_LIMIT: 'invitesActiveLimit',
  CIRCLE_INVITES_PERIOD_LIMIT: 'invitesPeriodLimit',
  CIRCLE_INVITE_CIRCLE_GONE: 'inviteCircleGone',
  CIRCLE_DISPLAY_NAME_REQUIRED: 'displayNameRequired',
  CIRCLE_FULL: 'full',
  CIRCLE_LIMIT_REACHED: 'limit',
  CIRCLE_CHEER_ALREADY_SENT: 'cheerSent',
  // Round 7: rounds, lines, reports.
  CIRCLE_ROUND_OPEN: 'roundOpen',
  CIRCLE_ROUND_ENDED: 'roundEnded',
  CIRCLE_ROUND_NOT_FOUND: 'messageGone',
  CIRCLE_ROUNDS_LIMIT: 'roundsLimit',
  CIRCLE_MESSAGES_LIMIT: 'messagesLimit',
  CIRCLE_REPORTS_LIMIT: 'reportsLimit',
  CIRCLE_MESSAGE_NOT_FOUND: 'messageGone',
  CIRCLE_NOT_FOUND: 'notFound',
  CIRCLE_MEMBER_NOT_FOUND: 'notFound',
  CIRCLE_OWNER_ONLY: 'ownerOnly',
  VALIDATION_FAILED: 'invalid',
};

/** The `circles.errors.*` key for a `joinError` code of a redeemed invite (صحبة is on, the circle was not joined). */
export function joinErrorKey(code: string): string {
  return `circles.errors.${ERROR_KEYS[code] ?? 'generic'}`;
}

/** The `circles.errors.*` key (or `errors.network`) for a failed request. */
export function circleErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'circles.errors.generic';
  if (error.status === 0 || error.code === 'NETWORK_ERROR') return 'errors.network';
  const key = ERROR_KEYS[error.code];
  // A daily limit of the API names itself (round 7); any other 429 is the per-minute throttle.
  if (key) return `circles.errors.${key}`;
  return error.status === 429 ? 'circles.errors.tooManyTries' : 'circles.errors.generic';
}

// ── Round 7: rounds and the feed ──────────────────────────────────────────────

/** «60 دقيقة» (plural forms from i18n). */
export function minutesText(t: TFunction, minutes: number): string {
  return t('circles.round.minutes', { count: minutes });
}

/** «جولة مذاكرة · compiler design · 60 دقيقة»: what a round says in the feed and in the preview before it starts. */
export function roundLine(t: TFunction, round: Pick<CircleRound, 'kind' | 'label' | 'minutes'>): string {
  const head = t('circles.round.startedLine', { kind: t(`circles.round.kinds.${round.kind}`) });
  // The label is isolated (FSI…PDI) so a Latin label («compiler design») keeps its place in an Arabic line.
  const label = round.label ? `\u2068${round.label}\u2069` : null;
  return [head, label, minutesText(t, round.minutes)].filter(Boolean).join(' · ');
}

/** The words of one feed line, as shown and as copied. A label typed by a member is the only free text. */
export function messageText(t: TFunction, m: CircleMessage): string {
  switch (m.kind) {
    case 'round_start':
      return m.round ? roundLine(t, m.round) : '';
    case 'round_end':
      return t(m.round?.outcome === 'done' ? 'circles.round.done' : 'circles.round.notDone');
    case 'reply':
      return t(`circles.round.replies.${m.key ?? ''}`);
    case 'preset':
    default:
      if (m.key === 'progress' && m.progress) {
        return m.progress.done >= m.progress.total
          ? t('circles.lines.progressAll')
          : t('circles.lines.progress', { done: m.progress.done, total: m.progress.total });
      }
      return t(m.to ? `circles.linesTo.${m.key ?? ''}` : `circles.lines.${m.key ?? ''}`);
  }
}

/** `sentToday` holds `key:target`; this says whether that line already went to that target today. */
export function wasSentToday(sentToday: readonly string[], key: string, target: string = WHOLE_CIRCLE): boolean {
  return sentToday.includes(`${key}:${target}`);
}

/**
 * «شارك تقدّمك»: how many of today's habits are done, as two numbers. Habits only (never the sin program, which
 * `dayAgenda` keeps in its own item, and never relatives); a habit's name never leaves the device this way.
 */
export function habitProgress(items: readonly AgendaItem[]): { done: number; total: number } | null {
  const habits = items.filter((i): i is Extract<AgendaItem, { kind: 'habit' }> => i.kind === 'habit');
  if (habits.length === 0) return null;
  return { done: habits.filter((h) => h.complete).length, total: Math.min(habits.length, 30) };
}

/** The device's local date of an instant (`YYYY-MM-DD`). */
export function localDateOf(iso: string): LocalDate {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface FeedDay {
  date: LocalDate;
  messages: CircleMessage[];
}

/** The feed oldest first (newest at the bottom, as in a chat), cut into local days. */
export function groupByDay(newestFirst: readonly CircleMessage[]): FeedDay[] {
  const days: FeedDay[] = [];
  for (const m of [...newestFirst].reverse()) {
    const date = localDateOf(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.date === date) last.messages.push(m);
    else days.push({ date, messages: [m] });
  }
  return days;
}
