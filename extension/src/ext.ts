/**
 * Browser glue shared by the service worker and the popup: the WebExtension namespace, reading and writing
 * `chrome.storage.local`, the catalog / evidence caches, account tokens and the sync status. Everything else is
 * pure and tested in Node.
 */
import { serializeStore, type Store } from '@thekra/practice-core';
import { createAuthClient, parseTokens, type HttpFetch, type TokenStore, type Tokens } from './auth.js';
import { parseCatalog, type Habit } from './catalog.js';
import {
  evidenceIsFresh,
  fetchCatalog,
  fetchEvidence,
  isFresh,
  parseCatalogCache,
  parseEvidenceCache,
  type FetchLike,
} from './cache.js';
import type { QuoteLite } from './quotes.js';
import {
  AUTH_KEY,
  CATALOG_KEY,
  decodeState,
  encodeState,
  EVIDENCE_KEY,
  PREFS_KEY,
  STORE_KEY,
  SYNC_STATUS_KEY,
  type State,
} from './state.js';
import { parseSyncStatus, type SyncStatus } from './sync-runner.js';

declare const __TARGET__: 'chrome' | 'firefox';
declare const __BUNDLED_CATALOG__: unknown;

/** Build target, set by esbuild `define`. */
export const TARGET: 'chrome' | 'firefox' = __TARGET__;

/** Firefox exposes promise-based `browser`; Chrome MV3 `chrome` returns promises too. */
export const api: typeof chrome = (globalThis as { browser?: typeof chrome }).browser ?? chrome;

const BUNDLED: Habit[] = parseCatalog(__BUNDLED_CATALOG__);

/** Last failed attempt per public call, so an unreachable API is retried at most hourly, not on every edit. */
const ATTEMPT_KEY = 'thekra.fetchAttempt';
const RETRY_MS = 60 * 60 * 1000;

const doFetch: FetchLike = (url, init) => fetch(url, { ...init, credentials: 'omit', cache: 'no-store' });

/** Reads the store and prefs (upgraded in memory when needed; {@link migrateStorage} writes the upgrade). */
export async function loadState(): Promise<State> {
  const { store, prefs } = decodeState(await api.storage.local.get([STORE_KEY, PREFS_KEY]));
  return { store, prefs };
}

export async function saveState(state: State): Promise<void> {
  await api.storage.local.set(encodeState(state));
}

export async function loadStore(): Promise<Store> {
  return (await loadState()).store;
}

export async function saveStore(store: Store): Promise<void> {
  await api.storage.local.set({ [STORE_KEY]: serializeStore(store) });
}

/** Writes the v1 → v2 upgrade (new plan ids) once. Called by the background before anything else reads. */
export async function migrateStorage(): Promise<void> {
  const decoded = decodeState(await api.storage.local.get([STORE_KEY, PREFS_KEY]));
  if (decoded.migrated) await saveState({ store: decoded.store, prefs: decoded.prefs });
}

export const tokenStore: TokenStore = {
  async get(): Promise<Tokens | null> {
    return parseTokens((await api.storage.local.get(AUTH_KEY))[AUTH_KEY]);
  },
  async set(tokens: Tokens | null): Promise<void> {
    if (tokens) await api.storage.local.set({ [AUTH_KEY]: tokens });
    else await api.storage.local.remove(AUTH_KEY);
  },
};

const httpFetch: HttpFetch = (url, init) => fetch(url, { ...init, credentials: 'omit', cache: 'no-store' });

/** Account client. Used by the background only, so one refresh runs at a time. */
export const auth = createAuthClient({ fetch: httpFetch, tokens: tokenStore });

export async function getSyncStatus(): Promise<SyncStatus | null> {
  return parseSyncStatus((await api.storage.local.get(SYNC_STATUS_KEY))[SYNC_STATUS_KEY]);
}

export async function setSyncStatus(status: SyncStatus | null): Promise<void> {
  if (status) await api.storage.local.set({ [SYNC_STATUS_KEY]: status });
  else await api.storage.local.remove(SYNC_STATUS_KEY);
}

/** Cached API catalog, else the bundled one. Never touches the network. */
export async function getCatalog(): Promise<Habit[]> {
  const raw = await api.storage.local.get(CATALOG_KEY);
  return parseCatalogCache(raw[CATALOG_KEY])?.habits ?? BUNDLED;
}

/** Cached published quotes (possibly empty). Never touches the network. */
export async function getQuotes(): Promise<Record<string, QuoteLite>> {
  const raw = await api.storage.local.get(EVIDENCE_KEY);
  return parseEvidenceCache(raw[EVIDENCE_KEY])?.quotes ?? {};
}

/**
 * Refreshes the catalog and the evidence of the chosen habits when older than a day (or when a newly chosen
 * habit's ids are missing). Failures are swallowed: the previous cache stays, and the failed call is retried
 * after an hour (sooner with `force`, e.g. right after Firefox grants the host permission).
 */
export async function refreshCaches(now = Date.now(), force = false): Promise<void> {
  const raw = await api.storage.local.get([CATALOG_KEY, EVIDENCE_KEY, STORE_KEY, PREFS_KEY, ATTEMPT_KEY]);
  const stored = raw[ATTEMPT_KEY] as Record<string, unknown> | undefined;
  const failed: Record<string, number> = {};
  const mayTry = (what: string) => {
    const at = stored?.[what];
    return force || typeof at !== 'number' || now - at >= RETRY_MS || now < at;
  };
  const catalogCache = parseCatalogCache(raw[CATALOG_KEY]);
  if (!isFresh(catalogCache?.fetchedAt, now) && mayTry('catalog')) {
    try {
      await api.storage.local.set({ [CATALOG_KEY]: await fetchCatalog(doFetch, now) });
    } catch {
      // Offline or API not deployed yet: the bundled or previous catalog stays in use.
      failed.catalog = now;
    }
  } else if (typeof stored?.catalog === 'number') {
    failed.catalog = stored.catalog;
  }
  const { store, prefs } = decodeState(raw);
  const habits = parseCatalogCache((await api.storage.local.get(CATALOG_KEY))[CATALOG_KEY])?.habits ?? BUNDLED;
  const chosen = new Set(store.plans.map((p) => p.habitKey));
  const ids = habits.filter((h) => chosen.has(h.key)).flatMap((h) => h.evidence);
  const key = `evidence:${prefs.lang}:${[...new Set(ids)].sort().join(',')}`;
  if (ids.length > 0 && !evidenceIsFresh(parseEvidenceCache(raw[EVIDENCE_KEY]), ids, now, prefs.lang)) {
    if (mayTry(key)) {
      try {
        await api.storage.local.set({ [EVIDENCE_KEY]: await fetchEvidence(doFetch, ids, now, prefs.lang) });
      } catch {
        // Keep the previous cache; with none, notifications show no text.
        failed[key] = now;
      }
    } else if (typeof stored?.[key] === 'number') {
      failed[key] = stored[key] as number;
    }
  }
  if (JSON.stringify(failed) !== JSON.stringify(stored ?? {})) await api.storage.local.set({ [ATTEMPT_KEY]: failed });
}
