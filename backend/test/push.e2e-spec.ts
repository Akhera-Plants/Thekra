/**
 * E2E spec for web push (docs/plan/2026-10-web-push.md): subscription, re-planning after a practice sync,
 * signed delivery without the database, the daily refill and the clean-ups. QStash and the browsers' push
 * services are replaced by fakes; everything else (database, guards, body parsers) is real.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { PUSH_CONFIG } from '../src/modules/push/push.constants.js';
import type { PushConfig } from '../src/modules/push/push-config.js';
import {
  DeliveryVerifier,
  PushScheduler,
  PushSender,
  type BrowserSubscription,
  type ScheduledMessage,
  type SendOutcome,
} from '../src/modules/push/push-transport.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

const CONFIG: PushConfig = {
  enabled: true,
  missing: [],
  vapid: { publicKey: 'BPublicKeyForTests', privateKey: 'private-key-for-tests', subject: 'mailto:test@thekra.test' },
  deliverUrl: 'https://api.thekra.test/v1/push/deliver',
  qstash: { token: 't', baseUrl: undefined, currentSigningKey: 'c', nextSigningKey: 'n' },
  cronSecret: 'cron-secret-for-tests',
};

class FakeScheduler extends PushScheduler {
  scheduled: (ScheduledMessage & { id: string })[] = [];
  cancelled: string[] = [];
  private next = 0;
  async schedule(messages: ScheduledMessage[]): Promise<string[]> {
    return messages.map((message) => {
      const id = `msg-${++this.next}`;
      this.scheduled.push({ ...message, id });
      return id;
    });
  }
  async cancel(messageIds: string[]): Promise<void> {
    this.cancelled.push(...messageIds);
  }
}

class FakeVerifier extends DeliveryVerifier {
  async verify(signature: string | undefined): Promise<boolean> {
    return signature === 'good-signature';
  }
}

class FakeSender extends PushSender {
  sent: { to: BrowserSubscription; payload: string }[] = [];
  outcome: SendOutcome = 'sent';
  async send(to: BrowserSubscription, payload: string): Promise<SendOutcome> {
    this.sent.push({ to, payload });
    return this.outcome;
  }
}

const PLAN = {
  id: '33333333-3333-4333-8333-333333333333',
  habitKey: 'duha',
  deedSlug: 'nawafil',
  title: 'Duha',
  unit: 'times',
  amount: 1,
  ceiling: null,
  activeDaysPerWeek: 7,
  slots: ['09:30', '11:00'],
  rule: { kind: 'daily' },
  createdOn: '2026-10-01',
  amountChangedOn: '2026-10-01',
  ebbSince: null,
  season: null,
  clientUpdatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
};

const subscription = (n: number) => ({
  endpoint: `https://push.example.test/send/${n}-${Math.random().toString(36).slice(2)}`,
  keys: { p256dh: 'BKeyForTests_-', auth: 'AuthForTests' },
  timeZone: 'Asia/Amman',
  locale: 'ar',
});

describe('Web push (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const scheduler = new FakeScheduler();
  const sender = new FakeSender();
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PUSH_CONFIG)
      .useValue(CONFIG)
      .overrideProvider(PushScheduler)
      .useValue(scheduler)
      .overrideProvider(DeliveryVerifier)
      .useValue(new FakeVerifier())
      .overrideProvider(PushSender)
      .useValue(sender)
      .compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await closeTestApp(app);
  });

  async function register(): Promise<{ userId: string; auth: Record<string, string>; password: string }> {
    const email = `push-${Date.now()}-${Math.random().toString(36).slice(2)}@thekra.test`;
    const password = 'password123456';
    const res = await request(server()).post('/v1/auth/register').send({ email, password }).expect(201);
    return { userId: res.body.data.user.id, auth: { Authorization: `Bearer ${res.body.data.accessToken}` }, password };
  }

  const sync = (auth: Record<string, string>, changes: object) =>
    request(server()).post('/v1/me/practice/sync').set(auth).send({ since: null, changes }).expect(200);

  it('serves the public key', async () => {
    const res = await request(server()).get('/v1/push/config').expect(200);
    expect(res.body.data).toEqual({ enabled: true, publicKey: CONFIG.vapid.publicKey });
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('plans reminders after a sync, changes only what changed, and delivers them without the database', async () => {
    const { auth } = await register();
    const sub = subscription(1);
    const created = await request(server()).post('/v1/me/push/subscriptions').set(auth).send(sub).expect(200);
    expect(created.body.data.scheduled).toBe(0);

    await sync(auth, { plans: [PLAN] });
    const rows = await prisma.pushReminder.findMany({ where: { subscriptionId: created.body.data.id }, orderBy: { fireAt: 'asc' } });
    // Two slots a day over 48 hours: three or four of them are still ahead, whatever the time of the run.
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.length).toBeLessThanOrEqual(4);
    expect(scheduler.scheduled.map((m) => m.id)).toEqual(expect.arrayContaining(rows.map((r) => r.messageId)));
    for (const message of scheduler.scheduled) expect(message.body).not.toContain('push.example.test');

    const before = scheduler.scheduled.length;
    await sync(auth, { plans: [{ ...PLAN, clientUpdatedAt: '2026-10-28T10:05:00.000Z' }] });
    expect(scheduler.scheduled.length).toBe(before); // same reminders: nothing cancelled or re-published

    await sync(auth, { plans: [{ ...PLAN, amount: 2, clientUpdatedAt: '2026-10-28T10:10:00.000Z' }] });
    expect(scheduler.cancelled).toEqual(expect.arrayContaining(rows.map((r) => r.messageId)));
    const replanned = await prisma.pushReminder.findMany({ where: { subscriptionId: created.body.data.id } });
    expect(replanned).toHaveLength(rows.length);

    const message = scheduler.scheduled.find((m) => m.id === replanned[0]!.messageId)!;
    await request(server()).post('/v1/push/deliver').set('Content-Type', 'text/plain').send(message.body).expect(401);
    await request(server())
      .post('/v1/push/deliver')
      .set('Content-Type', 'text/plain')
      .set('Upstash-Signature', 'good-signature')
      .send(message.body)
      .expect(200)
      .expect(({ body }) => expect(body.data.outcome).toBe('sent'));
    const delivered = sender.sent.at(-1)!;
    expect(delivered.to.endpoint).toBe(sub.endpoint);
    expect(JSON.parse(delivered.payload)).toMatchObject({ title: 'صلاة الضحى', url: '/ar/practice', tag: `habit-${PLAN.id}` });
    expect(JSON.parse(delivered.payload).body).toContain('المطلوب اليوم');

    await request(server())
      .post('/v1/push/deliver')
      .set('Content-Type', 'text/plain')
      .set('Upstash-Signature', 'good-signature')
      .send('v1.not-a-sealed-reminder')
      .expect(200)
      .expect(({ body }) => expect(body.data.outcome).toBe('unreadable'));
  });

  it('drops a browser that is gone, and removes on request', async () => {
    const { auth } = await register();
    await sync(auth, { plans: [{ ...PLAN, id: '33333333-3333-4333-8333-333333333334' }] });
    const sub = subscription(2);
    const created = await request(server()).post('/v1/me/push/subscriptions').set(auth).send(sub).expect(200);
    expect(created.body.data.scheduled).toBeGreaterThan(0);

    await request(server()).post('/v1/me/push/test').set(auth).send({ endpoint: sub.endpoint, locale: 'en' }).expect(204);
    expect(JSON.parse(sender.sent.at(-1)!.payload)).toMatchObject({ title: 'Thekra', url: '/en/practice' });

    const stored = await prisma.pushReminder.findFirst({ where: { subscriptionId: created.body.data.id } });
    const message = scheduler.scheduled.find((m) => m.id === stored!.messageId)!;
    sender.outcome = 'gone';
    await request(server())
      .post('/v1/push/deliver')
      .set('Content-Type', 'text/plain')
      .set('Upstash-Signature', 'good-signature')
      .send(message.body)
      .expect(200);
    sender.outcome = 'sent';
    expect(await prisma.pushSubscription.count({ where: { id: created.body.data.id } })).toBe(0);
    expect(scheduler.cancelled).toContain(stored!.messageId);

    const again = subscription(3);
    await request(server()).post('/v1/me/push/subscriptions').set(auth).send(again).expect(200);
    await request(server()).delete('/v1/me/push/subscriptions').set(auth).send({ endpoint: again.endpoint }).expect(204);
    await request(server()).delete('/v1/me/push/subscriptions').set(auth).send({ endpoint: again.endpoint }).expect(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint: again.endpoint } })).toBe(0);
    await request(server()).post('/v1/me/push/test').set(auth).send({ endpoint: again.endpoint, locale: 'ar' }).expect(404);
  });

  it('moves a browser to the account now signed in, without touching the other account', async () => {
    const first = await register();
    const second = await register();
    const sub = subscription(4);
    await request(server()).post('/v1/me/push/subscriptions').set(first.auth).send(sub).expect(200);
    await request(server()).delete('/v1/me/push/subscriptions').set(second.auth).send({ endpoint: sub.endpoint }).expect(204);
    expect((await prisma.pushSubscription.findUnique({ where: { endpoint: sub.endpoint } }))?.userId).toBe(first.userId);
    await request(server()).post('/v1/me/push/subscriptions').set(second.auth).send(sub).expect(200);
    expect((await prisma.pushSubscription.findUnique({ where: { endpoint: sub.endpoint } }))?.userId).toBe(second.userId);
  });

  it('validates the subscription', async () => {
    const { auth } = await register();
    await request(server()).post('/v1/me/push/subscriptions').send(subscription(5)).expect(401);
    await request(server()).post('/v1/me/push/subscriptions').set(auth).send({ ...subscription(5), timeZone: 'Mars/Base' }).expect(400);
    await request(server()).post('/v1/me/push/subscriptions').set(auth).send({ ...subscription(5), endpoint: 'http://insecure.test/x' }).expect(400);
    await request(server()).post('/v1/me/push/subscriptions').set(auth).send({ ...subscription(5), locale: 'fr' }).expect(400);
  });

  it('refills every account on the cron secret only', async () => {
    await request(server()).get('/v1/push/refill').expect(401);
    await request(server()).get('/v1/push/refill').set('Authorization', 'Bearer wrong').expect(401);
    const res = await request(server()).get('/v1/push/refill').set('Authorization', `Bearer ${CONFIG.cronSecret}`).expect(200);
    expect(res.body.data.complete).toBe(true);
    expect(res.body.data.users).toBeGreaterThanOrEqual(1);
  });

  it('cancels everything scheduled when the account is deleted', async () => {
    const { auth, password, userId } = await register();
    await sync(auth, { plans: [{ ...PLAN, id: '33333333-3333-4333-8333-333333333335' }] });
    await request(server()).post('/v1/me/push/subscriptions').set(auth).send(subscription(6)).expect(200);
    const ids = (await prisma.pushReminder.findMany({ where: { subscription: { userId } } })).map((r) => r.messageId);
    expect(ids.length).toBeGreaterThan(0);
    await request(server()).delete('/v1/auth/me').set(auth).send({ password }).expect(204);
    expect(scheduler.cancelled).toEqual(expect.arrayContaining(ids));
    expect(await prisma.pushSubscription.count({ where: { userId } })).toBe(0);
  });
});

describe('Web push when not configured (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('says it is off and refuses subscriptions and deliveries', async () => {
    const res = await request(app.getHttpServer()).get('/v1/push/config').expect(200);
    expect(res.body.data).toEqual({ enabled: false, publicKey: null });
    await request(app.getHttpServer()).post('/v1/push/deliver').set('Content-Type', 'text/plain').send('v1.x').expect(503);
    await request(app.getHttpServer()).get('/v1/push/refill').expect(503);
  });
});
