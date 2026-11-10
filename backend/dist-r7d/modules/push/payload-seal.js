import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
export function sealKey(vapidPrivateKey) {
    return Buffer.from(hkdfSync('sha256', vapidPrivateKey, 'thekra', 'push-payload-v1', 32));
}
export function seal(value, key) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return `${VERSION}.${Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')}`;
}
export function open(sealed, key) {
    const [version, data] = sealed.split('.');
    if (version !== VERSION || !data)
        return null;
    const raw = Buffer.from(data, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES)
        return null;
    try {
        const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
        decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
        const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]);
        return JSON.parse(text.toString('utf8'));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=payload-seal.js.map