/**
 * Local Waqfeya text. Files are downloaded once into backend/.corpus/waqfeya
 * (git-ignored). The dataset commit and each file's SHA-256 travel with the row.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusFile } from '../lib/corpus.js';

export const WAQFEYA_COMMIT = '6baff87f74cd3c53a6f3495d25c55b706cb55af8';
export const WAQFEYA_DATASET = 'ieasybooks-org/waqfeya-library';

export const WAQFEYA_ROOT = join(import.meta.dirname, '..', '..', '..', '.corpus', 'waqfeya');

export interface WaqfeyaFile {
  relativePath: string;
  sha256: string;
  text: string;
}

export function splitPages(text: string): string[] {
  return text.split('PAGE_SEPARATOR');
}

export function loadWaqfeyaFile(relativePath: string): WaqfeyaFile {
  const absolute = join(WAQFEYA_ROOT, relativePath);
  const bytes = readFileSync(absolute);
  return {
    relativePath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    text: bytes.toString('utf8'),
  };
}

export function asCorpusFile(file: WaqfeyaFile): CorpusFile {
  const versionUri = file.relativePath.split('/').slice(-2).join('/');
  return {
    spec: { repo: 'waqfeya-library', path: file.relativePath, commit: WAQFEYA_COMMIT, sha256: file.sha256 },
    versionUri,
    corpusUri: `waqfeya/${WAQFEYA_DATASET}/${file.relativePath}`,
    text: file.text,
  };
}

export function assertPageCount(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected} pages, found ${actual}`);
  }
}
