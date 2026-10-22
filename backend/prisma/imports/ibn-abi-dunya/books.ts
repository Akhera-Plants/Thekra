/**
 * Pinned OpenITI editions for Ibn Abi al-Dunya (0300AH / 0281IbnAbiDunya).
 * Generated from the local sparse clone at the pinned commit; SHA-256 of each
 * corpus file is verified by loadCorpus on every run.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { CorpusSpec } from '../lib/corpus.js';
import { titleArFor } from './titles.js';

interface EditionFile {
  commit: string;
  repo: string;
  works: Array<{ key: string; path: string; versionUri: string; sha256: string; bytes: number }>;
}

const EDITIONS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'editions.json'), 'utf8'),
) as EditionFile;

export interface DunyaBook {
  key: string;
  /** Stable Source.id (UUID). */
  id: string;
  titleAr: string;
  titleEn: string;
  apiProvider: string;
  corpus: CorpusSpec;
}

function sourceId(index: number): string {
  return `20000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
}

function titleEn(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/C([A-Z])/g, "'$1");
}

export const DUNYA_COMMIT = EDITIONS.commit;
export const DUNYA_REPO = EDITIONS.repo;

export const DUNYA_BOOKS: readonly DunyaBook[] = EDITIONS.works.map((work, index) => ({
  key: work.key,
  id: sourceId(index),
  titleAr: titleArFor(work.key),
  titleEn: titleEn(work.key),
  apiProvider: `book:ibn-abi-dunya:${work.key.toLowerCase()}`,
  corpus: {
    repo: EDITIONS.repo,
    path: work.path,
    commit: EDITIONS.commit,
    sha256: work.sha256,
  },
}));

/** Deterministic id check — duplicate keys or colliding UUIDs fail the build. */
export function assertDunyaCatalog(): void {
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const book of DUNYA_BOOKS) {
    if (keys.has(book.key)) throw new Error(`Duplicate dunya key ${book.key}`);
    if (ids.has(book.id)) throw new Error(`Duplicate dunya id ${book.id}`);
    keys.add(book.key);
    ids.add(book.id);
    const digest = createHash('sha256').update(book.apiProvider).digest('hex');
    if (digest.length < 8) throw new Error('sha256 failed');
  }
}
