/**
 * The only two network calls the extension makes, both to the Thekra API (host permission
 * `https://thekra.vercel.app/*`), and the shape of their caches in `chrome.storage.local`:
 *   - GET /v1/practice/catalog: the habit list (bundled copy used when offline);
 *   - GET /v1/practice/evidence?ids=…&lang=…: the published texts of the chosen habits (the API's own
 *     translation fields follow `lang`).
 * Both are refreshed at most once a day. A failed refresh keeps the previous cache (texts that were
 * published when fetched); with no cache, notifications show no text.
 * Nothing is ever sent except the quote ids, which are public catalog data.
 */
import { parseCatalog, UUID, type Habit } from './catalog.js';
import { toQuoteLite, type QuoteLite } from './quotes.js';
import type { Lang } from './state.js';

export const API_ORIGIN = 'https://thekra.vercel.app';
export const CATALOG_URL = `${API_ORIGIN}/v1/practice/catalog`;
export const EVIDENCE_URL = `${API_ORIGIN}/v1/practice/evidence`;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** Ids per evidence request (the API accepts at most 50). */
export const EVIDENCE_BATCH = 50;

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface CatalogCache {
  fetchedAt: number;
  habits: Habit[];
}

export interface EvidenceCache {
  fetchedAt: number;
  /** Language the texts were fetched for. */
  lang: Lang;
  /** Ids that were requested (a requested id the API did not return is not public: it stays absent). */
  ids: string[];
  quotes: Record<string, QuoteLite>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseCatalogCache(raw: unknown): CatalogCache | null {
  if (!isRecord(raw) || typeof raw.fetchedAt !== 'number') return null;
  const habits = parseCatalog({ habits: raw.habits });
  return habits.length > 0 ? { fetchedAt: raw.fetchedAt, habits } : null;
}

export function parseEvidenceCache(raw: unknown): EvidenceCache | null {
  if (!isRecord(raw) || typeof raw.fetchedAt !== 'number' || !Array.isArray(raw.ids) || !isRecord(raw.quotes)) return null;
  const quotes: Record<string, QuoteLite> = {};
  for (const value of Object.values(raw.quotes)) {
    const q = toQuoteLite(value);
    if (q) quotes[q.id] = q;
  }
  const ids = raw.ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)).map((id) => id.toLowerCase());
  return { fetchedAt: raw.fetchedAt, lang: raw.lang === 'en' ? 'en' : 'ar', ids, quotes };
}

export function isFresh(fetchedAt: number | undefined, now: number): boolean {
  return fetchedAt !== undefined && now - fetchedAt >= 0 && now - fetchedAt < DAY_MS;
}

/** Fresh when fetched in the last 24 hours, for this language, and it already covers every id asked for. */
export function evidenceIsFresh(cache: EvidenceCache | null, ids: readonly string[], now: number, lang: Lang): boolean {
  if (!cache || cache.lang !== lang || !isFresh(cache.fetchedAt, now)) return false;
  const have = new Set(cache.ids);
  return ids.every((id) => have.has(id.toLowerCase()));
}

/** Fetches the catalog. Throws on a network error, a non-2xx answer, or an answer with no valid habit. */
export async function fetchCatalog(fetchFn: FetchLike, now: number): Promise<CatalogCache> {
  const res = await fetchFn(CATALOG_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`catalog: HTTP ${res.status}`);
  const habits = parseCatalog(await res.json());
  if (habits.length === 0) throw new Error('catalog: no valid habits');
  return { fetchedAt: now, habits };
}

/**
 * Fetches the quotes for `ids` (deduplicated, in batches). Only quotes whose id was requested are kept.
 * Throws when any batch fails, so a partial answer never replaces a complete cache.
 */
export async function fetchEvidence(fetchFn: FetchLike, ids: readonly string[], now: number, lang: Lang): Promise<EvidenceCache> {
  const wanted = [...new Set(ids.map((id) => id.toLowerCase()).filter((id) => UUID.test(id)))].sort();
  const quotes: Record<string, QuoteLite> = {};
  for (let i = 0; i < wanted.length; i += EVIDENCE_BATCH) {
    const batch = wanted.slice(i, i + EVIDENCE_BATCH);
    const res = await fetchFn(`${EVIDENCE_URL}?ids=${batch.map(encodeURIComponent).join(',')}&lang=${lang}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`evidence: HTTP ${res.status}`);
    const body = await res.json();
    const data = isRecord(body) && Array.isArray(body.data) ? body.data : null;
    if (!data) throw new Error('evidence: unexpected answer');
    const asked = new Set(batch);
    for (const item of data) {
      const q = toQuoteLite(item);
      if (q && asked.has(q.id)) quotes[q.id] = q;
    }
  }
  return { fetchedAt: now, lang, ids: wanted, quotes };
}
