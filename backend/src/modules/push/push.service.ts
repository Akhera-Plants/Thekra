import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { applyServerChanges, emptyStore, type Store } from '@thekra/practice-core';
import type { PushSubscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { practiceCatalog } from '../practice/practice-catalog.js';
import { readPracticeChanges } from '../practice/practice-sync.js';
import { open, seal, sealKey } from './payload-seal.js';
import { PUSH_CONFIG } from './push.constants.js';
import type { PushConfig } from './push-config.js';
import { planPushes, type PlannedPush, type PushLocale } from './push-planner.js';
import { DeliveryVerifier, PushScheduler, PushSender, type BrowserSubscription } from './push-transport.js';
import { isValidTimeZone } from './zoned-time.js';

/** Browsers per account; the oldest is dropped beyond this. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;
/** A reminder delivered later than this (scheduler retries, an outage) is dropped: it would only confuse. */
export const STALE_AFTER_MS = 30 * 60_000;
/** How long the push service keeps trying to reach a browser that is offline. */
export const PUSH_TTL_SECONDS = 60 * 60;
/** The daily refill stops here and leaves the rest to the next run (Vercel Hobby functions are short). */
export const REFILL_BUDGET_MS = 45_000;

export interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone: string;
  locale: PushLocale;
}

/** What the scheduler carries (sealed): enough to send without reading the database. */
interface SealedReminder {
  sub: string;
  to: BrowserSubscription;
  at: string;
  n: { title: string; body: string; url: string; tag: string };
}

function isSealedReminder(value: unknown): value is SealedReminder {
  const v = value as SealedReminder | null;
  return (
    typeof v?.sub === 'string' &&
    typeof v.at === 'string' &&
    typeof v.to?.endpoint === 'string' &&
    typeof v.to.keys?.p256dh === 'string' &&
    typeof v.to.keys.auth === 'string' &&
    typeof v.n?.title === 'string' &&
    typeof v.n.body === 'string' &&
    typeof v.n.url === 'string' &&
    typeof v.n.tag === 'string'
  );
}

function disabled(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'PUSH_DISABLED', message: 'Web push is not configured on this server' });
}

/**
 * Web push (docs/plan/2026-10-web-push.md). Each browser's reminders for the next 48 hours are handed to the
 * scheduler with their send time; at that time the scheduler calls POST /v1/push/deliver, which sends the
 * notification without reading the database (so a free Neon database is not kept awake by a timer). The plan is
 * redone after every practice sync and once a day (GET /v1/push/refill); only what changed is cancelled or added.
 * Practice content and push endpoints are never logged.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly key: Buffer | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_CONFIG) private readonly config: PushConfig,
    private readonly scheduler: PushScheduler,
    private readonly verifier: DeliveryVerifier,
    private readonly sender: PushSender,
  ) {
    this.key = config.enabled ? sealKey(config.vapid.privateKey) : null;
  }

  publicConfig(): { enabled: boolean; publicKey: string | null } {
    return { enabled: this.config.enabled, publicKey: this.config.enabled ? this.config.vapid.publicKey : null };
  }

  async subscribe(userId: string, input: SubscribeInput, now = new Date()): Promise<{ id: string; scheduled: number }> {
    if (!this.config.enabled) throw disabled();
    if (!isValidTimeZone(input.timeZone)) {
      throw new BadRequestException({ code: 'PUSH_INVALID', message: 'Unknown time zone', details: { field: 'timeZone' } });
    }
    const existing = await this.prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });
    if (existing && existing.userId !== userId) await this.remove(existing); // the browser changed accounts
    const fields = { p256dh: input.keys.p256dh, auth: input.keys.auth, timeZone: input.timeZone, locale: input.locale };
    const sub = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { userId, endpoint: input.endpoint, ...fields },
      update: fields,
    });
    const all = await this.prisma.pushSubscription.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    for (const old of all.slice(MAX_SUBSCRIPTIONS_PER_USER)) await this.remove(old);
    const store = await this.loadStore(userId, now);
    return { id: sub.id, scheduled: await this.replan(sub, store, now) };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const sub = await this.prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!sub || sub.userId !== userId) return; // idempotent; never reveals another account's browser
    await this.remove(sub);
  }

  /** Sends one notification now, to check the browser receives them. */
  async sendTest(userId: string, endpoint: string, locale: PushLocale): Promise<void> {
    if (!this.config.enabled) throw disabled();
    const sub = await this.prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (!sub || sub.userId !== userId) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Push subscription not found' });
    }
    const n =
      locale === 'ar'
        ? { title: 'ذكرى', body: 'التنبيهات تعمل على هذا المتصفح.', url: '/ar/practice', tag: 'test' }
        : { title: 'Thekra', body: 'Reminders work in this browser.', url: '/en/practice', tag: 'test' };
    const outcome = await this.sender.send(this.browserOf(sub), JSON.stringify(n), PUSH_TTL_SECONDS);
    if (outcome === 'gone') {
      await this.remove(sub);
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The browser no longer accepts notifications' });
    }
  }

  /** Re-plans every browser of the user; never throws (a sync must not fail because of reminders). */
  async replanUser(userId: string, now = new Date()): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
      if (subs.length === 0) return;
      const store = await this.loadStore(userId, now);
      for (const sub of subs) await this.replan(sub, store, now);
    } catch (error: unknown) {
      this.logger.warn(`push re-plan failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }

  /** Daily: tops up every browser's next 48 hours. Returns how many accounts were done. */
  async refillAll(authorization: string | undefined, now = new Date()): Promise<{ users: number; complete: boolean }> {
    if (!this.config.enabled) throw disabled();
    if (authorization !== `Bearer ${this.config.cronSecret}`) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Cron secret required' });
    }
    const started = Date.now();
    let users = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await this.prisma.pushSubscription.findMany({
        where: cursor ? { userId: { gt: cursor } } : {},
        distinct: ['userId'],
        orderBy: { userId: 'asc' },
        select: { userId: true },
        take: 50,
      });
      if (page.length === 0) return { users, complete: true };
      for (const { userId } of page) {
        if (Date.now() - started > REFILL_BUDGET_MS) {
          this.logger.warn(`push refill stopped after ${users} accounts (time budget)`);
          return { users, complete: false };
        }
        await this.replanUser(userId, now);
        users += 1;
      }
      cursor = page[page.length - 1]!.userId;
    }
  }

  /** Before the account is deleted: cancel what is scheduled (the rows cascade with the user). */
  async forgetUser(userId: string): Promise<void> {
    if (!this.config.enabled) return;
    const rows = await this.prisma.pushReminder.findMany({ where: { subscription: { userId } }, select: { messageId: true } });
    await this.cancelQuietly(rows.map((row) => row.messageId));
  }

  /** Called by the scheduler at a reminder's time. Verified, then sent; the database is read only if the browser is gone. */
  async deliver(signature: string | undefined, body: unknown, now = new Date()): Promise<{ outcome: string }> {
    if (!this.config.enabled || !this.key) throw disabled();
    if (typeof body !== 'string' || !(await this.verifier.verify(signature, body))) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid delivery signature' });
    }
    const reminder = open(body, this.key);
    if (!isSealedReminder(reminder)) return { outcome: 'unreadable' }; // e.g. sealed before a VAPID key rotation
    if (now.getTime() - Date.parse(reminder.at) > STALE_AFTER_MS) return { outcome: 'stale' };
    const outcome = await this.sender.send(reminder.to, JSON.stringify(reminder.n), PUSH_TTL_SECONDS);
    if (outcome === 'gone') {
      const sub = await this.prisma.pushSubscription.findUnique({ where: { id: reminder.sub } });
      if (sub) await this.remove(sub);
    }
    return { outcome };
  }

  private browserOf(sub: PushSubscription): BrowserSubscription {
    return { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
  }

  private async loadStore(userId: string, now: Date): Promise<Store> {
    return applyServerChanges(emptyStore(), await readPracticeChanges(this.prisma, userId, null, now));
  }

  /**
   * Brings one browser's scheduled reminders in line with the plan: cancels what is gone or changed, publishes
   * what is new, forgets what has fired. Returns how many are scheduled after it.
   */
  private async replan(sub: PushSubscription, store: Store, now: Date): Promise<number> {
    const planned = planPushes({
      store,
      habits: practiceCatalog().habits,
      timeZone: sub.timeZone,
      locale: sub.locale === 'en' ? 'en' : 'ar',
      now,
    });
    const wanted = new Map(planned.map((item) => [item.key, item]));
    const rows = await this.prisma.pushReminder.findMany({ where: { subscriptionId: sub.id } });
    const upcoming = rows.filter((row) => row.fireAt > now);
    const kept = new Set(upcoming.filter((row) => wanted.get(row.key)?.digest === row.digest).map((row) => row.key));
    const cancelled = upcoming.filter((row) => !kept.has(row.key));
    const added = planned.filter((item) => !kept.has(item.key));

    await this.cancelQuietly(cancelled.map((row) => row.messageId));
    const dropped = [...cancelled, ...rows.filter((row) => row.fireAt <= now)].map((row) => row.id);
    if (dropped.length) await this.prisma.pushReminder.deleteMany({ where: { id: { in: dropped } } });
    if (added.length === 0) return kept.size;

    const messageIds = await this.scheduler.schedule(
      added.map((item) => ({ body: seal(this.sealed(sub, item), this.key!), notBefore: item.fireAt })),
    );
    try {
      await this.prisma.pushReminder.createMany({
        data: added.map((item, i) => ({
          subscriptionId: sub.id,
          key: item.key,
          digest: item.digest,
          fireAt: item.fireAt,
          messageId: messageIds[i]!,
        })),
      });
    } catch (error: unknown) {
      // Another re-plan of the same browser won the race: withdraw ours so nothing fires twice.
      await this.cancelQuietly(messageIds);
      throw error;
    }
    return kept.size + added.length;
  }

  private sealed(sub: PushSubscription, item: PlannedPush): SealedReminder {
    return {
      sub: sub.id,
      to: this.browserOf(sub),
      at: item.fireAt.toISOString(),
      n: { title: item.title, body: item.body, url: item.url, tag: item.tag },
    };
  }

  private async remove(sub: PushSubscription): Promise<void> {
    const rows = await this.prisma.pushReminder.findMany({ where: { subscriptionId: sub.id }, select: { messageId: true } });
    await this.cancelQuietly(rows.map((row) => row.messageId));
    await this.prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
  }

  private async cancelQuietly(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    try {
      await this.scheduler.cancel(messageIds);
    } catch (error: unknown) {
      this.logger.warn(`push cancel failed for ${messageIds.length} messages: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
