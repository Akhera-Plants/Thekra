/**
 * Pure pieces of the «رفقة» screens: what counts as «حضرت اليوم», the invite link and share text, and which
 * sentence an API failure shows. No user data beyond the circle's name and code ever goes into a share.
 */

import type { LocalDate, Store } from '@thekra/practice-core';
import { ApiError } from '../types/api';

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
  CIRCLE_FULL: 'full',
  CIRCLE_LIMIT_REACHED: 'limit',
  CIRCLE_CHEER_ALREADY_SENT: 'cheerSent',
  CIRCLE_NOT_FOUND: 'notFound',
  CIRCLE_MEMBER_NOT_FOUND: 'notFound',
  CIRCLE_OWNER_ONLY: 'ownerOnly',
  VALIDATION_FAILED: 'invalid',
};

/** The `circles.errors.*` key (or `errors.network`) for a failed request. */
export function circleErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'circles.errors.generic';
  if (error.status === 0 || error.code === 'NETWORK_ERROR') return 'errors.network';
  if (error.status === 429) return 'circles.errors.tooManyTries';
  const key = ERROR_KEYS[error.code];
  return key ? `circles.errors.${key}` : 'circles.errors.generic';
}
