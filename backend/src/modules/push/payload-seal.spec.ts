import { open, seal, sealKey } from './payload-seal.js';

describe('payload-seal', () => {
  const key = sealKey('vapid-private-key-for-tests');

  it('opens what it sealed, and the sealed text shows nothing of it', () => {
    const value = { to: 'https://push.example/abc', n: { title: 'صلاة الضحى' } };
    const sealed = seal(value, key);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('push.example');
    expect(open(sealed, key)).toEqual(value);
  });

  it('uses a fresh IV each time', () => {
    expect(seal({ a: 1 }, key)).not.toBe(seal({ a: 1 }, key));
  });

  it('refuses another key, a changed text and garbage', () => {
    const sealed = seal({ a: 1 }, key);
    expect(open(sealed, sealKey('another-key'))).toBeNull();
    const raw = Buffer.from(sealed.slice(3), 'base64url');
    raw[raw.length - 20]! ^= 1;
    expect(open(`v1.${raw.toString('base64url')}`, key)).toBeNull();
    expect(open('v2.abc', key)).toBeNull();
    expect(open('v1.', key)).toBeNull();
    expect(open('nonsense', key)).toBeNull();
  });
});
