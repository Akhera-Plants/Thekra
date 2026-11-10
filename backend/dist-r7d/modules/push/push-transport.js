import { Client, Receiver } from '@upstash/qstash';
import webpush from 'web-push';
export class PushScheduler {
}
export class DeliveryVerifier {
}
export class PushSender {
}
const BATCH_SIZE = 50;
export class QstashScheduler extends PushScheduler {
    config;
    qstash;
    constructor(config) {
        super();
        this.config = config;
    }
    get client() {
        this.qstash ??= new Client({
            token: this.config.qstash.token,
            baseUrl: this.config.qstash.baseUrl,
            enableTelemetry: false,
            devMode: false,
        });
        return this.qstash;
    }
    async schedule(messages) {
        const ids = [];
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
            const sent = await this.client.batch(messages.slice(i, i + BATCH_SIZE).map((message) => ({
                url: this.config.deliverUrl,
                body: message.body,
                headers: { 'Content-Type': 'text/plain' },
                notBefore: Math.floor(message.notBefore.getTime() / 1000),
                retries: 2,
                redact: { body: true },
            })));
            ids.push(...sent.map((result) => (Array.isArray(result) ? result[0].messageId : result.messageId)));
        }
        return ids;
    }
    async cancel(messageIds) {
        if (messageIds.length > 0)
            await this.client.messages.cancel(messageIds);
    }
}
export class QstashVerifier extends DeliveryVerifier {
    config;
    qstashReceiver;
    constructor(config) {
        super();
        this.config = config;
    }
    get receiver() {
        this.qstashReceiver ??= new Receiver({
            currentSigningKey: this.config.qstash.currentSigningKey,
            nextSigningKey: this.config.qstash.nextSigningKey,
            devMode: false,
        });
        return this.qstashReceiver;
    }
    async verify(signature, body) {
        if (!signature)
            return false;
        try {
            return await this.receiver.verify({ signature, body, url: this.config.deliverUrl, clockTolerance: 30 });
        }
        catch {
            return false;
        }
    }
}
export class WebPushSender extends PushSender {
    config;
    constructor(config) {
        super();
        this.config = config;
    }
    async send(subscription, payload, ttlSeconds) {
        const { subject, publicKey, privateKey } = this.config.vapid;
        try {
            await webpush.sendNotification(subscription, payload, {
                TTL: ttlSeconds,
                urgency: 'normal',
                timeout: 10_000,
                vapidDetails: { subject, publicKey, privateKey },
            });
            return 'sent';
        }
        catch (error) {
            if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410))
                return 'gone';
            throw error;
        }
    }
}
//# sourceMappingURL=push-transport.js.map