/**
 * Replaces detector spans with canonical Uthmani text. The OCR span is not kept.
 * Word indexes are a \\S+ scan, and endWord is exclusive (quran-detector).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QuoteType, TextSource, type PrismaClient } from '@prisma/client';

export interface VerseSpan {
  startWord: number;
  endWord: number;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
}

export interface VerseHit {
  start: number;
  end: number;
  keys: string[];
}

export function wordSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/**
 * A match whose word span is many times the verse length is a distant ayah-number
 * merge, not a quotation. Clamp it to the first ayah. Anything still wider than
 * the longest plausible quotation is dropped so it cannot erase the page.
 */
export function boundSpan(span: VerseSpan, matchedWords?: number): VerseSpan | null {
  const width = span.endWord - span.startWord;
  if (span.startWord < 0 || width <= 0) return null;
  if (matchedWords != null && matchedWords > 0 && width > matchedWords * 3 + 8) {
    return { ...span, endWord: span.startWord + matchedWords, ayahEnd: span.ayahStart };
  }
  if (width > 400) return null;
  return span;
}

export function applyVerseReplacements(
  text: string,
  spans: readonly VerseSpan[],
  uthmani: (surah: number, ayah: number) => string,
): { text: string; hits: VerseHit[] } {
  const words = wordSpans(text);
  const ordered = [...spans]
    .filter((span) => span.startWord >= 0 && span.endWord <= words.length && span.startWord < span.endWord)
    .sort((a, b) => a.startWord - b.startWord);
  const kept: VerseSpan[] = [];
  let lastEnd = -1;
  for (const span of ordered) {
    if (span.startWord < lastEnd) continue;
    kept.push(span);
    lastEnd = span.endWord;
  }

  let out = text;
  let shift = 0;
  const hits: VerseHit[] = [];
  for (const span of kept) {
    const start = words[span.startWord]!.start + shift;
    const end = words[span.endWord - 1]!.end + shift;
    const inner = out.slice(start, end);
    const markers = inner.match(/\[\[\d+:\d+\]\]/g) ?? [];
    const pieces: string[] = [];
    const keys: string[] = [];
    for (let ayah = span.ayahStart; ayah <= span.ayahEnd; ayah += 1) {
      pieces.push(uthmani(span.surah, ayah));
      keys.push(`${span.surah}:${ayah}`);
    }
    const replacement = pieces.join(' ') + (markers.length > 0 ? `\n${markers.join('\n')}\n` : '');
    out = out.slice(0, start) + replacement + out.slice(end);
    hits.push({ start, end: start + replacement.length, keys });
    shift += replacement.length - (end - start);
  }
  return { text: out, hits };
}

export function keysCovering(hits: readonly VerseHit[], start: number, end: number): string[] {
  const keys: string[] = [];
  for (const hit of hits) {
    if (hit.start >= start && hit.start < end) keys.push(...hit.keys);
  }
  return [...new Set(keys)];
}

const UTHMANI_URL = 'https://api.quran.com/api/v4/quran/verses/uthmani';

export async function loadUthmaniMap(prisma: PrismaClient, cachePath: string): Promise<Map<string, string>> {
  let stored: Record<string, string>;
  if (existsSync(cachePath)) {
    stored = JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, string>;
  } else {
    const response = await fetch(UTHMANI_URL, { headers: { 'User-Agent': 'thekra-import', Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Quran.com Uthmani download failed (${response.status})`);
    const body = (await response.json()) as { verses: Array<{ verse_key: string; text_uthmani: string }> };
    stored = {};
    for (const verse of body.verses) stored[verse.verse_key] = verse.text_uthmani;
    mkdirSync(join(cachePath, '..'), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(stored));
  }
  const map = new Map(Object.entries(stored));
  const rows = await prisma.quote.findMany({
    where: {
      type: QuoteType.QURAN_VERSE,
      surahNumber: { not: null },
      ayahNumber: { not: null },
      textSource: { not: TextSource.OCR },
    },
    select: { surahNumber: true, ayahNumber: true, textAr: true },
  });
  for (const row of rows) {
    if (row.surahNumber != null && row.ayahNumber != null && row.textAr.trim()) {
      map.set(`${row.surahNumber}:${row.ayahNumber}`, row.textAr.trim());
    }
  }
  return map;
}

export function detectQuranSpans(text: string, cachePath: string): VerseSpan[] {
  const sha = createHash('sha256').update(text).digest('hex');
  const cached = join(cachePath, `${sha}.json`);
  if (existsSync(cached)) {
    const stored = JSON.parse(readFileSync(cached, 'utf8')) as { matches: VerseSpan[] };
    return stored.matches.flatMap((span) => {
      const bounded = boundSpan(span);
      return bounded ? [bounded] : [];
    });
  }
  const dir = join(tmpdir(), `thekra-quran-${sha.slice(0, 12)}`);
  mkdirSync(dir, { recursive: true });
  const input = join(dir, 'input.txt');
  const output = join(dir, 'matches.json');
  writeFileSync(input, text);
  const script = join(import.meta.dirname, 'detect_quran.py');
  const result = spawnSync(
    'uv',
    ['run', '--python', '3.12', '--with', 'quran-detector==0.0.2', 'python', script, '--input', input, '--output', output],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.stderr?.trim()) console.log(result.stderr.trim());
  if (result.status !== 0) {
    throw new Error(`quran-detector failed: ${(result.stderr || result.stdout || 'no output').slice(0, 2000)}`);
  }
  const parsed = JSON.parse(readFileSync(output, 'utf8')) as {
    matches: Array<{
      start_word: number;
      end_word: number;
      surah: number;
      ayah_start: number;
      ayah_end: number;
      matched_words?: number;
    }>;
  };
  const spans: VerseSpan[] = [];
  for (const match of parsed.matches) {
    const bounded = boundSpan(
      {
        startWord: match.start_word,
        endWord: match.end_word,
        surah: match.surah,
        ayahStart: match.ayah_start,
        ayahEnd: match.ayah_end,
      },
      match.matched_words,
    );
    if (bounded) spans.push(bounded);
  }
  mkdirSync(cachePath, { recursive: true });
  writeFileSync(cached, JSON.stringify({ matches: spans }));
  return spans;
}
