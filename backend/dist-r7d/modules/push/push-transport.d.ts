import type { PushConfig } from './push-config.js';
export interface ScheduledMessage {
    body: string;
    notBefore: Date;
}
export declare abstract class PushScheduler {
    abstract schedule(messages: ScheduledMessage[]): Promise<string[]>;
    abstract cancel(messageIds: string[]): Promise<void>;
}
export declare abstract class DeliveryVerifier {
    abstract verify(signature: string | undefined, body: string): Promise<boolean>;
}
export interface BrowserSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export type SendOutcome = 'sent' | 'gone';
export declare abstract class PushSender {
    abstract send(subscription: BrowserSubscription, payload: string, ttlSeconds: number): Promise<SendOutcome>;
}
export declare class QstashScheduler extends PushScheduler {
    private readonly config;
    private qstash?;
    constructor(config: PushConfig);
    private get client();
    schedule(messages: ScheduledMessage[]): Promise<string[]>;
    cancel(messageIds: string[]): Promise<void>;
}
export declare class QstashVerifier extends DeliveryVerifier {
    private readonly config;
    private qstashReceiver?;
    constructor(config: PushConfig);
    private get receiver();
    verify(signature: string | undefined, body: string): Promise<boolean>;
}
export declare class WebPushSender extends PushSender {
    private readonly config;
    constructor(config: PushConfig);
    send(subscription: BrowserSubscription, payload: string, ttlSeconds: number): Promise<SendOutcome>;
}
