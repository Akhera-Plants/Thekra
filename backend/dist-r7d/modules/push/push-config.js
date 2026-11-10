export const PUSH_VARIABLES = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'PUSH_PUBLIC_API_URL',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'CRON_SECRET',
];
export function readPushConfig(config) {
    const value = (name) => config.get(name)?.trim() ?? '';
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
//# sourceMappingURL=push-config.js.map