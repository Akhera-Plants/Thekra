import type { ConfigService } from '@nestjs/config';

/**
 * Web push settings (docs/plan/2026-10-web-push.md). Push is on only when every value is present; a partial
 * setup is reported by `missing` (names only, never values) and leaves push off rather than half working.
 */
export interface PushConfig {
  enabled: boolean;
  missing: string[];
  vapid: { publicKey: string; privateKey: string; subject: string };
  /** Absolute URL QStash calls at each reminder time. */
  deliverUrl: string;
  qstash: { token: string; baseUrl: string | undefined; currentSigningKey: string; nextSigningKey: string };
  cronSecret: string;
}

/** Every variable web push needs; with any one missing push stays off. */
export const PUSH_VARIABLES = [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'PUSH_PUBLIC_API_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'CRON_SECRET',
] as const;

export function readPushConfig(config: Pick<ConfigService, 'get'>): PushConfig {
  const value = (name: string) => config.get<string>(name)?.trim() ?? '';
  const missing = PUSH_VARIABLES.filter((name) => value(name) === '');
  return {
    enabled: missing.length === 0,
    missing,
    vapid: { publicKey: value('VAPID_PUBLIC_KEY'), privateKey: value('VAPID_PRIVATE_KEY'), subject: value('VAPID_SUBJECT') },
    deliverUrl: `${value('PUSH_PUBLIC_API_URL').replace(/\/+$/, '')}/v1/push/deliver`,
    qstash: {
      token: value('QSTASH_TOKEN'),
      baseUrl: value('QSTASH_URL') || undefined,
      currentSigningKey: value('QSTASH_CURRENT_SIGNING_KEY'),
      nextSigningKey: value('QSTASH_NEXT_SIGNING_KEY'),
    },
    cronSecret: value('CRON_SECRET'),
  };
}
