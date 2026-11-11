/**
 * The device key of the on-device «تخفَّف» copy (owner round 8, Q1). WebCrypto AES-GCM 256: the key is generated on
 * this browser, is NOT extractable (`extractable: false`, so no script can read its bytes, only use it) and lives
 * in IndexedDB; the data it seals is kept in localStorage as `v1.<iv>.<ciphertext>`. Forgetting the key (sign-out)
 * makes any leftover ciphertext unreadable.
 *
 * Everything here can fail (old browser, a private window, blocked site data): callers treat a failure as «could not
 * keep it», never as a reason to write the text in clear.
 */
const DB_NAME = 'thekra-device';
const STORE_NAME = 'keys';
const KEY_ID = 'sin-program-key';
const IV_BYTES = 12;

export type OpenResult =
  | { status: 'ok'; text: string }
  /** There is no key on this device: the data cannot be read any more. */
  | { status: 'nokey' }
  /** The text is damaged or was sealed with another key. */
  | { status: 'bad' }
  /** IndexedDB or WebCrypto failed this time: try again later, do not discard the data. */
  | { status: 'error' };

function cryptoApi(): Crypto | null {
  return typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle ? globalThis.crypto : null;
}

/** WebCrypto and IndexedDB exist here. */
export function canSealOnDevice(): boolean {
  return typeof indexedDB !== 'undefined' && cryptoApi() !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function readKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

/** Stores `candidate` unless another tab stored one first; returns the key that is now kept. */
function keepKey(db: IDBDatabase, candidate: CryptoKey): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const objects = tx.objectStore(STORE_NAME);
    let kept = candidate;
    const existing = objects.get(KEY_ID);
    existing.onsuccess = () => {
      if (existing.result) kept = existing.result as CryptoKey;
      else objects.put(candidate, KEY_ID);
    };
    tx.oncomplete = () => resolve(kept);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
  });
}

async function getKey(create: boolean): Promise<CryptoKey | null> {
  const db = await openDb();
  try {
    const found = await readKey(db);
    if (found || !create) return found;
    const subtle = cryptoApi()!.subtle;
    const fresh = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return await keepKey(db, fresh);
  } finally {
    db.close();
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Seals `plain` with this device's key (made on first use). Throws when the browser cannot do it. */
export async function sealText(plain: string): Promise<string> {
  const api = cryptoApi();
  if (!api || typeof indexedDB === 'undefined') throw new Error('Device sealing is not available');
  const key = await getKey(true);
  if (!key) throw new Error('No device key');
  const iv = api.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await api.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

/** Opens text made by {@link sealText}. Never throws. */
export async function openText(text: string): Promise<OpenResult> {
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { status: 'bad' };
  const api = cryptoApi();
  if (!api || typeof indexedDB === 'undefined') return { status: 'error' };
  let key: CryptoKey | null;
  try {
    key = await getKey(false);
  } catch {
    return { status: 'error' };
  }
  if (!key) return { status: 'nokey' };
  try {
    const iv = fromBase64(parts[1] as string);
    const data = fromBase64(parts[2] as string);
    const plain = await api.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return { status: 'ok', text: new TextDecoder().decode(plain) };
  } catch {
    return { status: 'bad' };
  }
}

/** Deletes the device key (sign-out): whatever was sealed with it can no longer be opened. Never throws. */
export async function forgetDeviceKey(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    db.close();
  } catch {
    // Nothing to forget, or IndexedDB is unavailable: the sealed text is removed by the caller anyway.
  }
}
