var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PushService_1;
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException, } from '@nestjs/common';
import { applyServerChanges, emptyStore, parseNotificationPrefs, parseResolvedAnchorTimes } from '@thekra/practice-core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { practiceCatalog } from '../practice/practice-catalog.js';
import { readPracticeChanges } from '../practice/practice-sync.js';
import { open, seal, sealKey } from './payload-seal.js';
import { PUSH_CONFIG } from './push.constants.js';
import { planPushes, sitePath } from './push-planner.js';
import { DeliveryVerifier, PushScheduler, PushSender } from './push-transport.js';
import { isValidTimeZone } from './zoned-time.js';
export const MAX_SUBSCRIPTIONS_PER_USER = 10;
export const STALE_AFTER_MS = 30 * 60_000;
export const PUSH_TTL_SECONDS = 60 * 60;
export const REFILL_BUDGET_MS = 45_000;
function storedPrefs(raw) {
    const all = parseNotificationPrefs(raw);
    const anchorTimes = parseResolvedAnchorTimes(raw.anchorTimes);
    return {
        ...(Object.keys(anchorTimes).length > 0 ? { anchorTimes } : {}),
        habits: all.habits,
        periodic: all.periodic,
        periodicTime: all.periodicTime,
        eveningNudge: all.eveningNudge,
        eveningTime: all.eveningTime,
        fridayReview: all.fridayReview,
        fridayTime: all.fridayTime,
        reviewDay: all.reviewDay,
        occasions: all.occasions,
        occasionTime: all.occasionTime,
        strategies: all.strategies,
        strategyTime: all.strategyTime,
        strategyDay: all.strategyDay,
        intentionReminder: all.intentionReminder,
        intentionTime: all.intentionTime,
        mutedPlans: all.mutedPlans,
        mutedActs: all.mutedActs,
    };
}
function isSealedReminder(value) {
    const v = value;
    return (typeof v?.sub === 'string' &&
        typeof v.at === 'string' &&
        typeof v.to?.endpoint === 'string' &&
        typeof v.to.keys?.p256dh === 'string' &&
        typeof v.to.keys.auth === 'string' &&
        typeof v.n?.title === 'string' &&
        typeof v.n.body === 'string' &&
        typeof v.n.url === 'string' &&
        typeof v.n.tag === 'string');
}
const CANCEL_ATTEMPTS = 3;
const CANCEL_RETRY_MS = 250;
function disabled() {
    return new ServiceUnavailableException({ code: 'PUSH_DISABLED', message: 'Web push is not configured on this server' });
}
let PushService = PushService_1 = class PushService {
    prisma;
    config;
    scheduler;
    verifier;
    sender;
    logger = new Logger(PushService_1.name);
    key;
    constructor(prisma, config, scheduler, verifier, sender) {
        this.prisma = prisma;
        this.config = config;
        this.scheduler = scheduler;
        this.verifier = verifier;
        this.sender = sender;
        this.key = config.enabled ? sealKey(config.vapid.privateKey) : null;
    }
    publicConfig() {
        return { enabled: this.config.enabled, publicKey: this.config.enabled ? this.config.vapid.publicKey : null };
    }
    async subscribe(userId, input, now = new Date()) {
        if (!this.config.enabled)
            throw disabled();
        if (!isValidTimeZone(input.timeZone)) {
            throw new BadRequestException({ code: 'PUSH_INVALID', message: 'Unknown time zone', details: { field: 'timeZone' } });
        }
        const existing = await this.prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });
        if (existing && existing.userId !== userId)
            await this.remove(existing);
        const fields = {
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            timeZone: input.timeZone,
            locale: input.locale,
            ...(input.prefs ? { prefs: storedPrefs(input.prefs) } : {}),
        };
        const sub = await this.prisma.pushSubscription.upsert({
            where: { endpoint: input.endpoint },
            create: { userId, endpoint: input.endpoint, ...fields },
            update: fields,
        });
        const all = await this.prisma.pushSubscription.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
        for (const old of all.slice(MAX_SUBSCRIPTIONS_PER_USER))
            await this.remove(old);
        const store = await this.loadStore(userId, now);
        return { id: sub.id, scheduled: await this.replan(sub, store, now) };
    }
    async unsubscribe(userId, endpoint) {
        const sub = await this.prisma.pushSubscription.findUnique({ where: { endpoint } });
        if (!sub || sub.userId !== userId)
            return;
        await this.remove(sub);
    }
    async sendTest(userId, endpoint, locale) {
        if (!this.config.enabled)
            throw disabled();
        const sub = await this.prisma.pushSubscription.findUnique({ where: { endpoint } });
        if (!sub || sub.userId !== userId) {
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Push subscription not found' });
        }
        const n = locale === 'ar'
            ? { title: 'ذكرى', body: 'التنبيهات تعمل على هذا المتصفح.', url: sitePath('ar', '/practice'), tag: 'test' }
            : { title: 'Thekra', body: 'Reminders work in this browser.', url: sitePath('en', '/practice'), tag: 'test' };
        const outcome = await this.sender.send(this.browserOf(sub), JSON.stringify(n), PUSH_TTL_SECONDS);
        if (outcome === 'gone') {
            await this.remove(sub);
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The browser no longer accepts notifications' });
        }
    }
    async replanUser(userId, now = new Date()) {
        if (!this.config.enabled)
            return;
        try {
            const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
            if (subs.length === 0)
                return;
            const store = await this.loadStore(userId, now);
            for (const sub of subs)
                await this.replan(sub, store, now);
        }
        catch (error) {
            this.logger.warn(`push re-plan failed: ${error instanceof Error ? error.name : 'unknown error'}`);
        }
    }
    async refillAll(authorization, now = new Date()) {
        if (!this.config.enabled)
            throw disabled();
        if (authorization !== `Bearer ${this.config.cronSecret}`) {
            throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Cron secret required' });
        }
        const started = Date.now();
        let users = 0;
        let cursor;
        for (;;) {
            const page = await this.prisma.pushSubscription.findMany({
                where: cursor ? { userId: { gt: cursor } } : {},
                distinct: ['userId'],
                orderBy: { userId: 'asc' },
                select: { userId: true },
                take: 50,
            });
            if (page.length === 0)
                return { users, complete: true };
            for (const { userId } of page) {
                if (Date.now() - started > REFILL_BUDGET_MS) {
                    this.logger.warn(`push refill stopped after ${users} accounts (time budget)`);
                    return { users, complete: false };
                }
                await this.replanUser(userId, now);
                users += 1;
            }
            cursor = page[page.length - 1].userId;
        }
    }
    async forgetUser(userId) {
        if (!this.config.enabled)
            return;
        const rows = await this.prisma.pushReminder.findMany({ where: { subscription: { userId } }, select: { messageId: true } });
        await this.cancelQuietly(rows.map((row) => row.messageId));
    }
    async deliver(signature, body, now = new Date()) {
        if (!this.config.enabled || !this.key)
            throw disabled();
        if (typeof body !== 'string' || !(await this.verifier.verify(signature, body))) {
            throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid delivery signature' });
        }
        const reminder = open(body, this.key);
        if (!isSealedReminder(reminder))
            return { outcome: 'unreadable' };
        if (now.getTime() - Date.parse(reminder.at) > STALE_AFTER_MS)
            return { outcome: 'stale' };
        const outcome = await this.sender.send(reminder.to, JSON.stringify(reminder.n), PUSH_TTL_SECONDS);
        if (outcome === 'gone') {
            const sub = await this.prisma.pushSubscription.findUnique({ where: { id: reminder.sub } });
            if (sub)
                await this.remove(sub);
        }
        return { outcome };
    }
    browserOf(sub) {
        return { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    }
    async loadStore(userId, now) {
        return applyServerChanges(emptyStore(), await readPracticeChanges(this.prisma, userId, null, now));
    }
    async replan(sub, store, now) {
        const planned = planPushes({
            store,
            habits: practiceCatalog().habits,
            occasions: practiceCatalog().occasions,
            timeZone: sub.timeZone,
            locale: sub.locale === 'en' ? 'en' : 'ar',
            prefs: parseNotificationPrefs(sub.prefs ?? null),
            anchorTimes: parseResolvedAnchorTimes(sub.prefs?.anchorTimes),
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
        if (dropped.length)
            await this.prisma.pushReminder.deleteMany({ where: { id: { in: dropped } } });
        if (added.length === 0)
            return kept.size;
        const messageIds = await this.scheduler.schedule(added.map((item) => ({ body: seal(this.sealed(sub, item), this.key), notBefore: item.fireAt })));
        try {
            await this.prisma.pushReminder.createMany({
                data: added.map((item, i) => ({
                    subscriptionId: sub.id,
                    key: item.key,
                    digest: item.digest,
                    fireAt: item.fireAt,
                    messageId: messageIds[i],
                })),
            });
        }
        catch (error) {
            await this.cancelQuietly(messageIds);
            throw error;
        }
        return kept.size + added.length;
    }
    sealed(sub, item) {
        return {
            sub: sub.id,
            to: this.browserOf(sub),
            at: item.fireAt.toISOString(),
            n: { title: item.title, body: item.body, url: item.url, tag: item.tag },
        };
    }
    async remove(sub) {
        const rows = await this.prisma.pushReminder.findMany({ where: { subscriptionId: sub.id }, select: { messageId: true } });
        await this.cancelQuietly(rows.map((row) => row.messageId));
        await this.prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
    }
    async cancelQuietly(messageIds) {
        if (messageIds.length === 0)
            return;
        for (let attempt = 1; attempt <= CANCEL_ATTEMPTS; attempt += 1) {
            try {
                await this.scheduler.cancel(messageIds);
                return;
            }
            catch (error) {
                if (attempt === CANCEL_ATTEMPTS) {
                    this.logger.warn(`push cancel failed for ${messageIds.length} messages: ${error instanceof Error ? error.name : 'unknown error'}`);
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, CANCEL_RETRY_MS * attempt));
            }
        }
    }
};
PushService = PushService_1 = __decorate([
    Injectable(),
    __param(1, Inject(PUSH_CONFIG)),
    __metadata("design:paramtypes", [PrismaService, Object, PushScheduler,
        DeliveryVerifier,
        PushSender])
], PushService);
export { PushService };
//# sourceMappingURL=push.service.js.map