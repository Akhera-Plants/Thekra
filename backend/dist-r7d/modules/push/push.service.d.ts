import { PrismaService } from '../../prisma/prisma.service.js';
import type { PushConfig } from './push-config.js';
import { type PushLocale } from './push-planner.js';
import { DeliveryVerifier, PushScheduler, PushSender } from './push-transport.js';
export declare const MAX_SUBSCRIPTIONS_PER_USER = 10;
export declare const STALE_AFTER_MS: number;
export declare const PUSH_TTL_SECONDS: number;
export declare const REFILL_BUDGET_MS = 45000;
export interface SubscribeInput {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    timeZone: string;
    locale: PushLocale;
    prefs?: object;
}
export declare class PushService {
    private readonly prisma;
    private readonly config;
    private readonly scheduler;
    private readonly verifier;
    private readonly sender;
    private readonly logger;
    private readonly key;
    constructor(prisma: PrismaService, config: PushConfig, scheduler: PushScheduler, verifier: DeliveryVerifier, sender: PushSender);
    publicConfig(): {
        enabled: boolean;
        publicKey: string | null;
    };
    subscribe(userId: string, input: SubscribeInput, now?: Date): Promise<{
        id: string;
        scheduled: number;
    }>;
    unsubscribe(userId: string, endpoint: string): Promise<void>;
    sendTest(userId: string, endpoint: string, locale: PushLocale): Promise<void>;
    replanUser(userId: string, now?: Date): Promise<void>;
    refillAll(authorization: string | undefined, now?: Date): Promise<{
        users: number;
        complete: boolean;
    }>;
    forgetUser(userId: string): Promise<void>;
    deliver(signature: string | undefined, body: unknown, now?: Date): Promise<{
        outcome: string;
    }>;
    private browserOf;
    private loadStore;
    private replan;
    private sealed;
    private remove;
    private cancelQuietly;
}
