import type { ConfigService } from '@nestjs/config';
export interface PushConfig {
    enabled: boolean;
    missing: string[];
    vapid: {
        publicKey: string;
        privateKey: string;
        subject: string;
    };
    deliverUrl: string;
    qstash: {
        token: string;
        baseUrl: string | undefined;
        currentSigningKey: string;
        nextSigningKey: string;
    };
    cronSecret: string;
}
export declare const PUSH_VARIABLES: readonly ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "PUSH_PUBLIC_API_URL", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "CRON_SECRET"];
export declare function readPushConfig(config: Pick<ConfigService, 'get'>): PushConfig;
