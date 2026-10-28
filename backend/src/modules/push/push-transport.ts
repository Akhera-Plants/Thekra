import { Client, Receiver } from '@upstash/qstash';
import webpush from 'web-push';
import type { PushConfig } from './push-config.js';

/**
 * The two outside services web push depends on, behind small interfaces so tests use fakes and the move off
 * Vercel (docs/deploy/MIGRATION_OFF_VERCEL.md) replaces only the scheduler: an in-process timer on a long-lived
 * server can implement {@link PushScheduler} and {@link DeliveryVerifier} without QStash.
 */

export interface ScheduledMessage {
  /** Sealed payload (payload-seal.ts); delivered back verbatim to POST /v1/push/deliver. */
  body: string;
  notBefore: Date;
}

export abstract class PushScheduler {
  /** Message ids in the order given. Throws when the scheduler refuses (quota, network). */
  abstract schedule(messages: ScheduledMessage[]): Promise<string[]>;
  abstract cancel(messageIds: string[]): Promise<void>;
}

export abstract class DeliveryVerifier {
  /** True when `body` really comes from the scheduler (signature over this exact body and URL). */
  abstract verify(signature: string | undefined, body: string): Promise<boolean>;
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type SendOutcome = 'sent' | 'gone';

export abstract class PushSender {
  /** 'gone' when the browser dropped the subscription (404/410). Throws on errors worth retrying. */
  abstract send(subscription: BrowserSubscription, payload: string, ttlSeconds: number): Promise<SendOutcome>;
}

const BATCH_SIZE = 50;

/** Clients are created on first use, so nothing is built while push is off. */
export class QstashScheduler extends PushScheduler {
  private qstash?: Client;

  constructor(private readonly config: PushConfig) {
    super();
  }

  private get client(): Client {
    this.qstash ??= new Client({
      token: this.config.qstash.token,
      baseUrl: this.config.qstash.baseUrl,
      enableTelemetry: false,
      devMode: false,
    });
    return this.qstash;
  }

  async schedule(messages: ScheduledMessage[]): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const sent = await this.client.batch(
        messages.slice(i, i + BATCH_SIZE).map((message) => ({
          url: this.config.deliverUrl,
          body: message.body,
          headers: { 'Content-Type': 'text/plain' },
          notBefore: Math.floor(message.notBefore.getTime() / 1000),
          retries: 2,
          redact: { body: true as const },
        })),
      );
      // Each message goes to one URL, so each result is a single { messageId } (never a URL-group list).
      ids.push(...sent.map((result) => (Array.isArray(result) ? result[0]!.messageId : result.messageId)));
    }
    return ids;
  }

  async cancel(messageIds: string[]): Promise<void> {
    if (messageIds.length > 0) await this.client.messages.cancel(messageIds);
  }
}

export class QstashVerifier extends DeliveryVerifier {
  private qstashReceiver?: Receiver;

  constructor(private readonly config: PushConfig) {
    super();
  }

  private get receiver(): Receiver {
    this.qstashReceiver ??= new Receiver({
      currentSigningKey: this.config.qstash.currentSigningKey,
      nextSigningKey: this.config.qstash.nextSigningKey,
      devMode: false,
    });
    return this.qstashReceiver;
  }

  async verify(signature: string | undefined, body: string): Promise<boolean> {
    if (!signature) return false;
    try {
      return await this.receiver.verify({ signature, body, url: this.config.deliverUrl, clockTolerance: 30 });
    } catch {
      return false;
    }
  }
}

export class WebPushSender extends PushSender {
  constructor(private readonly config: PushConfig) {
    super();
  }

  async send(subscription: BrowserSubscription, payload: string, ttlSeconds: number): Promise<SendOutcome> {
    const { subject, publicKey, privateKey } = this.config.vapid;
    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: ttlSeconds,
        urgency: 'normal',
        timeout: 10_000,
        vapidDetails: { subject, publicKey, privateKey },
      });
      return 'sent';
    } catch (error: unknown) {
      if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone';
      throw error;
    }
  }
}
