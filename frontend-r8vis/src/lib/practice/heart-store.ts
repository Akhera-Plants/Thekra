/**
 * «المقامات» on this browser (redesign §4.4): «نية اليوم», the evening and Friday reviews, «رسالة إلى نفسي» and
 * «التزام شخصي», as one practice-core `HeartData` under `thekra.practice.heart.v1`. Private and device-local: never
 * synced, never sent anywhere. Wrapped like the practice store: blocked storage keeps it in memory for the session.
 */
import { emptyHeart, parseHeart, serializeHeart, type HeartData } from '@thekra/practice-core';

export const HEART_KEY = 'thekra.practice.heart.v1';

let snapshot: HeartData | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): HeartData {
  try {
    const raw = storage()?.getItem(HEART_KEY);
    return raw ? parseHeart(raw) : emptyHeart();
  } catch {
    return emptyHeart();
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === HEART_KEY) {
    snapshot = read();
    for (const listener of listeners) listener();
  }
}

export function getHeartSnapshot(): HeartData {
  if (!snapshot) snapshot = read();
  return snapshot;
}

/** No device data during the server render. */
export function getServerHeartSnapshot(): HeartData | null {
  return null;
}

export function subscribeHeart(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Applies `change` (practice-core heart helpers), keeps only what parses, saves and notifies. */
export function updateHeart(change: (data: HeartData) => HeartData): void {
  const next = parseHeart(serializeHeart(change(getHeartSnapshot())));
  snapshot = next;
  try {
    storage()?.setItem(HEART_KEY, serializeHeart(next));
  } catch {
    // Storage refused: the change lasts for this tab.
  }
  for (const listener of listeners) listener();
}

/** Test hook. */
export function resetHeartForTests(): void {
  snapshot = null;
}
