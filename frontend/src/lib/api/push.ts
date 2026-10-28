/**
 * Web push endpoints (docs/plan/2026-10-web-push.md §3). The config is public; the rest carry the in-memory access
 * token (api-client). Nothing here carries practice data: only the browser's push address and its keys.
 */
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';
import type { LocaleCode } from '@/lib/types/enums';

/** No `?lang=`: the language travels in the body (the api-client adds it to every request unless told not to). */
const NO_LANG = { skipLang: true } as Record<string, unknown>;

export interface PushConfig {
  enabled: boolean;
  /** VAPID public key, base64url; `null` when push is off. */
  publicKey: string | null;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** IANA zone of the browser. */
  timeZone: string;
  locale: LocaleCode;
}

export async function getPushConfig(): Promise<PushConfig> {
  return (await apiGet<PushConfig>('/push/config', NO_LANG)).data;
}

/** Push off on the server → ApiError 503 `PUSH_DISABLED`; unknown zone → 400 `PUSH_INVALID`. */
export async function postPushSubscription(body: PushSubscriptionBody): Promise<{ id: string; scheduled: number }> {
  return (await apiPost<{ id: string; scheduled: number }>('/me/push/subscriptions', body, NO_LANG)).data;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiDelete('/me/push/subscriptions', { ...NO_LANG, data: { endpoint } });
}

/** 404 when the server does not know this browser (never registered, or the push service dropped it). */
export async function postPushTest(endpoint: string, locale: LocaleCode): Promise<void> {
  await apiPost<unknown>('/me/push/test', { endpoint, locale }, NO_LANG);
}
