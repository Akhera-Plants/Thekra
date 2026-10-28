/**
 * Browser glue shared by the service worker and the popup: the WebExtension namespace, reading and writing
 * `chrome.storage.local`, and the catalog / evidence caches. Everything else is pure and tested in Node.
 */
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
import { CATALOG_KEY, decodeState, encodeState, EVIDENCE_KEY, PREFS_KEY, STORE_KEY, type State } from './state.js';

declare const __TARGET__: 'chrome' | 'firefox';
declare const __BUNDLED_CATALOG__: unknown;

/** Build target, set by esbuild `define`. */
export const TARGET: 'chrome' | 'firefox' = __TARGET__;

/** Firefox exposes promise-based `browser`; Chrome MV3 `chrome` returns promises too. */
export const api: typeof chrome = (globalThis as { browser?: typeof chrome }).browser ?? chrome;

const BUNDLED: Habit[] = parseCatalog(__BUNDLED_CATALOG__);

const doFetch: FetchLike = (url, init) => fetch(url, { ...init, credentials: 'omit', cache: 'no-store' });

export async function loadState(): Promise<State> {
  return decodeState(await api.storage.local.get([STORE_KEY, PREFS_KEY]));
}

export async function saveState(state: State): Promise<void> {
  await api.storage.local.set(encodeState(state));
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
 * habit's ids are missing). Failures are swallowed: the previous cache stays.
 */
export async function refreshCaches(now = Date.now()): Promise<void> {
  const raw = await api.storage.local.get([CATALOG_KEY, EVIDENCE_KEY, STORE_KEY, PREFS_KEY]);
  const catalogCache = parseCatalogCache(raw[CATALOG_KEY]);
  if (!isFresh(catalogCache?.fetchedAt, now)) {
    try {
      await api.storage.local.set({ [CATALOG_KEY]: await fetchCatalog(doFetch, now) });
    } catch {
      // Offline or API not deployed yet: the bundled or previous catalog stays in use.
    }
  }
  const { store, prefs } = decodeState(raw);
  const habits = parseCatalogCache((await api.storage.local.get(CATALOG_KEY))[CATALOG_KEY])?.habits ?? BUNDLED;
  const chosen = new Set(store.plans.map((p) => p.id));
  const ids = habits.filter((h) => chosen.has(h.key)).flatMap((h) => h.evidence);
  if (ids.length === 0) return;
  if (evidenceIsFresh(parseEvidenceCache(raw[EVIDENCE_KEY]), ids, now, prefs.lang)) return;
  try {
    await api.storage.local.set({ [EVIDENCE_KEY]: await fetchEvidence(doFetch, ids, now, prefs.lang) });
  } catch {
    // Keep the previous cache; with none, notifications show no text.
  }
}
