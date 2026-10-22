/**
 * al-Kabair writes a verse in braces and a prophetic report in the same paragraph.
 * The definition stays the author's prose. Each brace becomes verse keys.
 */
import type { ParsedItem, ParsedSection } from './parse.js';
import { detectQuranSpans, wordSpans, type VerseSpan } from '../waqfeya/quran.js';
import { join } from 'node:path';

const MARK =
  /\{([^{}]*)\}|(?:^|\s)(وفي الصحيحين|وفي الحديث|قال رسول الله|وقال رسول الله|وعن(?=\s+(?!الصلاة|ذلك|هذا|حاله|نفسه|هذه|تلك|كل(?:\s|$)))|وروي أن|روي أن)/g;

export type KabairPiece =
  | { kind: 'AUTHOR_TEXT' | 'HADITH'; text: string }
  | { kind: 'BRACE'; text: string };

function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

export function splitKabairBlock(text: string): KabairPiece[] {
  const pieces: KabairPiece[] = [];
  let hadith = false;
  let buffer = '';
  const flush = (): void => {
    const value = buffer.replace(/\s+/g, ' ').trim();
    buffer = '';
    if (arabicLetters(value) < 8) return;
    pieces.push({ kind: hadith ? 'HADITH' : 'AUTHOR_TEXT', text: value });
  };

  let cursor = 0;
  for (const match of text.matchAll(MARK)) {
    const index = match.index ?? 0;
    if (index > cursor) buffer = `${buffer} ${text.slice(cursor, index)}`;
    if (match[1] != null) {
      flush();
      const inner = match[1].trim();
      if (inner) pieces.push({ kind: 'BRACE', text: inner });
    } else if (match[2]) {
      flush();
      hadith = true;
      buffer = match[2];
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) buffer = `${buffer} ${text.slice(cursor)}`;
  flush();
  return pieces;
}

/** Verse keys for each brace, in brace order. A span that crosses a brace is ignored. */
export function versesInBraces(braces: readonly string[], spans: readonly VerseSpan[]): string[][] {
  const sizes = braces.map((brace) => wordSpans(brace).length);
  const found: string[][] = braces.map(() => []);
  for (const span of spans) {
    let at = 0;
    for (let index = 0; index < sizes.length; index += 1) {
      const end = at + (sizes[index] ?? 0);
      const inside = span.startWord >= at && span.endWord <= end && span.startWord < span.endWord;
      if (inside) {
        for (let ayah = span.ayahStart; ayah <= span.ayahEnd; ayah += 1) {
          found[index]!.push(`${span.surah}:${ayah}`);
        }
        break;
      }
      at = end;
    }
  }
  return found;
}

const DETECTOR = join(import.meta.dirname, '..', '..', '..', '.corpus', 'detector');

/** Replaces brace placeholders with one AYAH item per detected verse. */
export function resolveKabairBraces(sections: ParsedSection[]): ParsedSection[] {
  const braces: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === 'AYAH' && item.ayahFrom == null && item.text) braces.push(item.text);
    }
  }
  if (braces.length === 0) return sections;
  const spans = detectQuranSpans(braces.join('\n'), DETECTOR);
  const keys = versesInBraces(braces, spans);
  let cursor = 0;
  for (const section of sections) {
    const next: ParsedItem[] = [];
    for (const item of section.items) {
      if (item.kind !== 'AYAH' || item.ayahFrom != null || !item.text) {
        next.push(item);
        continue;
      }
      const verseKeys = keys[cursor] ?? [];
      cursor += 1;
      for (const key of verseKeys) {
        next.push({
          kind: 'AYAH',
          line: item.line,
          hadithNumber: null,
          text: null,
          ayahFrom: key,
          ayahTo: key,
        });
      }
    }
    section.items = next;
  }
  return sections;
}
