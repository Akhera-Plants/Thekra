import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDunyaBook } from './parse.js';

const CORPUS = join(import.meta.dirname, '../../../.corpus');
// The OpenITI corpus is gitignored (CC BY-NC-SA 4.0, never committed), so CI has
// no copy: each test runs only where its pinned file exists locally.
const SAMT_PATH = join(CORPUS, '0281IbnAbiDunya.Samt.Shamela0013039-ara1.mARkdown');
const GHIBA_PATH = join(CORPUS, '0281IbnAbiDunya.DhammGhiba.Shamela0008241-ara1');

describe('parseDunyaBook', () => {
  it.skipIf(!existsSync(SAMT_PATH))('reads # N - paragraph numbers in Samt', () => {
    const text = readFileSync(SAMT_PATH, 'utf8');
    const sections = parseDunyaBook(text);
    const hadith = sections.flatMap((section) => section.items.filter((item) => item.kind === 'HADITH'));
    expect(sections.some((section) => section.level === 'BAB')).toBe(true);
    expect(hadith.length).toBeGreaterThan(500);
    expect(hadith[0]?.hadithNumber).toBe(1);
    expect(hadith[0]?.text?.includes('رسول الله') || hadith[0]?.text?.includes('الإسلام')).toBe(true);
  });

  it.skipIf(!existsSync(GHIBA_PATH))('reads ### N - heading numbers in DhammGhiba', () => {
    const text = readFileSync(GHIBA_PATH, 'utf8');
    const sections = parseDunyaBook(text);
    const hadith = sections.flatMap((section) => section.items.filter((item) => item.kind === 'HADITH'));
    expect(hadith.length).toBeGreaterThan(100);
    expect(hadith.every((item) => item.hadithNumber != null)).toBe(true);
  });
});
