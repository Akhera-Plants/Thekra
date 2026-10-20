/**
 * HadeethEnc API client with on-disk cache under backend/.corpus/hadeethenc/.
 * Polite rate: ≤5 req/s when filling the cache.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVIDER = 'hadeethenc.com';
export const API_BASE = 'https://hadeethenc.com/api/v1';
export const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/hadeethenc');

const MIN_INTERVAL_MS = 220; // ~4.5 req/s
const FETCH_TIMEOUT_MS = 15_000;
let lastFetchAt = 0;

export interface RootCategory {
  id: string;
  title: string;
  hadeeths_count: string;
  parent_id: string | null;
}

export interface ListItem {
  id: string;
  title: string;
  translations?: string[];
}

export interface ListPage {
  data: ListItem[];
  meta: { current_page: string; last_page: number; total_items: number; per_page: string };
}

export interface WordMeaning {
  word?: string;
  meaning?: string;
}

export interface HadeethOne {
  id: string;
  title: string;
  hadeeth: string;
  attribution?: string;
  grade?: string;
  explanation?: string;
  hints?: string[];
  words_meanings?: WordMeaning[];
  categories?: string[];
  reference?: string;
  translations?: string[];
}

export interface CollectedHadith {
  id: string;
  rootTitle: string;
  hasEn: boolean;
}

function corpusPath(key: string): string {
  return join(CORPUS_DIR, `${key}.json`);
}

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastFetchAt = Date.now();
}

class HttpStatusError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HadeethEnc ${status} for ${url}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  await throttle();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await Promise.race([
      fetch(url, {
        headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)', Accept: 'application/json' },
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`HadeethEnc timeout for ${url}`)), FETCH_TIMEOUT_MS + 500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new HttpStatusError(response.status, url);
    }
    return (await response.json()) as T;
  } catch (error) {
    const retryable =
      !(error instanceof HttpStatusError)
      || error.status === 429
      || error.status >= 500;
    if (retryable && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      return getJson(url, attempt + 1);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function loadCached<T>(key: string, fetchFresh: () => Promise<T>): Promise<T> {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const path = corpusPath(key);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  }
  const body = await fetchFresh();
  writeFileSync(path, JSON.stringify(body));
  return body;
}

/** Load from cache or fetch; return null on 404 without caching the miss. */
export async function loadCachedOptional<T>(
  key: string,
  fetchFresh: () => Promise<T>,
): Promise<T | null> {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const path = corpusPath(key);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  }
  try {
    const body = await fetchFresh();
    writeFileSync(path, JSON.stringify(body));
    return body;
  } catch (error) {
    if (error instanceof HttpStatusError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchRoots(): Promise<RootCategory[]> {
  return loadCached('categories-roots-ar', () =>
    getJson<RootCategory[]>(`${API_BASE}/categories/roots/?language=ar`),
  );
}

export async function fetchListPage(categoryId: string, page: number, perPage = 100): Promise<ListPage> {
  return loadCached(`list-${categoryId}-p${page}`, () =>
    getJson<ListPage>(
      `${API_BASE}/hadeeths/list/?language=ar&category_id=${categoryId}&page=${page}&per_page=${perPage}`,
    ),
  );
}

export async function fetchOne(id: string, language: 'ar' | 'en'): Promise<HadeethOne | null> {
  return loadCachedOptional(`one-${id}-${language}`, () =>
    getJson<HadeethOne>(`${API_BASE}/hadeeths/one/?language=${language}&id=${id}`),
  );
}

/** Walk every root category’s pages and return unique hadeeth ids with the root title. */
export async function collectAllIds(
  limit: number | null = null,
): Promise<CollectedHadith[]> {
  const roots = await fetchRoots();
  const seen = new Map<string, CollectedHadith>();
  for (const root of roots) {
    if (limit !== null && seen.size >= limit) break;
    const first = await fetchListPage(root.id, 1);
    const lastPage = Number(first.meta.last_page) || 1;
    const ingest = (item: ListItem) => {
      if (seen.has(item.id)) return;
      seen.set(item.id, {
        id: item.id,
        rootTitle: root.title,
        hasEn: (item.translations ?? []).includes('en'),
      });
    };
    for (const item of first.data ?? []) {
      ingest(item);
      if (limit !== null && seen.size >= limit) break;
    }
    for (let page = 2; page <= lastPage; page += 1) {
      if (limit !== null && seen.size >= limit) break;
      const body = await fetchListPage(root.id, page);
      for (const item of body.data ?? []) {
        ingest(item);
        if (limit !== null && seen.size >= limit) break;
      }
    }
  }
  const rows = [...seen.values()];
  return limit === null ? rows : rows.slice(0, limit);
}

export function formatHints(hints: string[] | undefined): string | null {
  const lines = (hints ?? []).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return lines.length ? lines.join('\n\n') : null;
}

export function formatGharib(words: WordMeaning[] | undefined): string | null {
  const lines = (words ?? [])
    .map((row) => {
      const word = (row.word ?? '').replace(/\s+/g, ' ').trim();
      const meaning = (row.meaning ?? '').replace(/\s+/g, ' ').trim();
      if (!word && !meaning) return '';
      return meaning ? `${word}: ${meaning}` : word;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}
