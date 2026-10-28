/**
 * Secure randomness for practice-core's vault (`globalThis.crypto.getRandomValues`) and client ids.
 *
 * Hermes has no Web Crypto. expo-crypto 57 exposes `getRandomValues(typedArray)` and `randomUUID()` as plain
 * functions (build/Crypto.d.ts) and ships no global polyfill, so `installGetRandomValues` puts expo-crypto's
 * function on `globalThis.crypto` when the runtime has none. It is called from app/_layout.tsx before any vault
 * code runs (see ./install.ts). An existing implementation (web, Node) is never replaced.
 */

type GetRandomValues = <T extends Uint8Array>(array: T) => T;

/** Installs `impl` as `globalThis.crypto.getRandomValues` if missing. Returns true when it installed it. */
export function installGetRandomValues(impl: GetRandomValues, target: object = globalThis): boolean {
  const g = target as { crypto?: { getRandomValues?: unknown } };
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') return false;
  const fn = (array: Uint8Array) => impl(array);
  if (g.crypto && typeof g.crypto === 'object') {
    Object.defineProperty(g.crypto, 'getRandomValues', { value: fn, configurable: true, writable: true });
  } else {
    Object.defineProperty(g, 'crypto', { value: { getRandomValues: fn }, configurable: true, writable: true });
  }
  return true;
}

/** True when practice-core's vault can get random bytes. */
export function hasSecureRandom(target: object = globalThis): boolean {
  const g = target as { crypto?: { getRandomValues?: unknown } };
  return Boolean(g.crypto && typeof g.crypto.getRandomValues === 'function');
}
