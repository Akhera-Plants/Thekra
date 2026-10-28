import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * What the scheduler carries between planning and delivery is sealed with AES-256-GCM, so the scheduler (a third
 * party while we are on Vercel Hobby) sees neither the browser's push endpoint nor the reminder text. The key is
 * derived from the VAPID private key with HKDF, so there is no extra secret to manage; rotating the VAPID keys
 * also retires every sealed message (they fail to open and are dropped).
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function sealKey(vapidPrivateKey: string): Buffer {
  return Buffer.from(hkdfSync('sha256', vapidPrivateKey, 'thekra', 'push-payload-v1', 32));
}

export function seal(value: unknown, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')}`;
}

/** The sealed value, or null when it was not sealed with this key (or was changed). */
export function open(sealed: string, key: Buffer): unknown {
  const [version, data] = sealed.split('.');
  if (version !== VERSION || !data) return null;
  const raw = Buffer.from(data, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]);
    return JSON.parse(text.toString('utf8')) as unknown;
  } catch {
    return null;
  }
}
