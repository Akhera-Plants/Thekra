/** Pinned edition files, downloaded once into .corpus/translations and checked by hash. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/translations');

export interface EditionHadith {
  hadithnumber: number | string;
  arabicnumber?: number | string;
  text?: string;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function ensureFile(file: string, expected: string, url: string | null): Promise<Buffer> {
  if (!expected) throw new Error(`Missing pinned hash for ${file}`);
  const path = join(CORPUS_DIR, file);
  let bytes: Buffer;
  if (existsSync(path)) {
    bytes = readFileSync(path);
  } else if (url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'thekra-import' } });
    if (!response.ok) throw new Error(`${file} download failed (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    mkdirSync(CORPUS_DIR, { recursive: true });
    writeFileSync(path, bytes);
  } else {
    throw new Error(`Missing corpus file ${file}`);
  }
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`Hash mismatch for ${file}: expected ${expected}, got ${actual}`);
  return bytes;
}

export function editionRows(bytes: Buffer): EditionHadith[] {
  return (JSON.parse(bytes.toString('utf8')) as { hadiths?: EditionHadith[] }).hadiths ?? [];
}
