/**
 * A small device-local value in localStorage with a parser and listeners, for data that is never synced:
 * «تذكيراتي» and the prayer-time settings and cache (redesign §4.6). Same wrapping as `heart-store.ts`: blocked or
 * full storage keeps the value in memory for the session; the server render sees `null`.
 */
export interface DeviceStore<T> {
  get(): T;
  getServer(): T | null;
  subscribe(listener: () => void): () => void;
  update(change: (value: T) => T): void;
  /** Test hook. */
  reset(): void;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createDeviceStore<T>(key: string, parse: (raw: unknown) => T): DeviceStore<T> {
  let snapshot: { value: T } | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const raw = storage()?.getItem(key);
      return parse(raw ? JSON.parse(raw) : null);
    } catch {
      return parse(null);
    }
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === key) {
      snapshot = { value: read() };
      for (const listener of listeners) listener();
    }
  };

  return {
    get() {
      if (!snapshot) snapshot = { value: read() };
      return snapshot.value;
    },
    getServer() {
      return null;
    },
    subscribe(listener) {
      if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      };
    },
    update(change) {
      // Round-trip through the parser so only valid data is kept.
      const next = parse(JSON.parse(JSON.stringify(change(this.get()))));
      snapshot = { value: next };
      try {
        storage()?.setItem(key, JSON.stringify(next));
      } catch {
        // Storage refused: the change lasts for this tab.
      }
      for (const listener of listeners) listener();
    },
    reset() {
      snapshot = null;
    },
  };
}
