/**
 * Parses the OpenITI JK texts of Sahih al-Bukhari and Sahih Muslim into
 * numbered narrations. Headings that look like «# 2 باب» are chapters, not hadiths.
 * A repeated number keeps the longer text (a second chain of the same number).
 */
import { cleanInline } from '../lib/openiti.js';

export interface ParsedNarration {
  number: number;
  kitab: string | null;
  bab: string | null;
  text: string;
}

export interface SahihParseResult {
  narrations: ParsedNarration[];
  maxNumber: number;
  missing: number[];
  duplicateNumbers: number[];
}

const HEADER_END = '#META#Header#End#';
const HADITH = /^#\s+((?:\d+\s+)+)(.*)$/;
const H3_BAB = /^### \|\|\s+(.*)$/;
const HASH_BAB = /^#\s+\d+\s+باب(?:\s|$)(.*)$/;
const MUSLIM_BAB = /^#\s*\|\s*\d+\s*\(\s*\d+\s+باب(?:\s|$)(.*)$/;
const H3_KITAB = /^### \|\s+(?!\|)(.*)$/;
const MUSLIM_KITAB = /^#\s*\|\s*\d+\s*\(\s*\d+\s+كتاب(?:\s|$)(.*)$/;

function heading(raw: string): string {
  return cleanInline(raw).replace(/^[([]\s*/, '').replace(/\s*[)\]]$/, '').trim();
}

function cleanNarration(parts: readonly string[]): string {
  return cleanInline(parts.join(' '))
    .replace(/\s*\*\s*/g, ' ')
    .replace(/@QB@|@QE@/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSahihayn(source: string): SahihParseResult {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(HEADER_END)) + 1;
  let kitab: string | null = null;
  let bab: string | null = null;
  const byNumber = new Map<number, ParsedNarration>();
  const duplicateNumbers: number[] = [];
  let current: { number: number; parts: string[]; kitab: string | null; bab: string | null } | null = null;

  const flush = (): void => {
    if (!current) return;
    const text = cleanNarration(current.parts);
    const narration: ParsedNarration = {
      number: current.number,
      kitab: current.kitab,
      bab: current.bab,
      text,
    };
    const previous = byNumber.get(current.number);
    if (!previous) byNumber.set(current.number, narration);
    else {
      duplicateNumbers.push(current.number);
      if (text.length > previous.text.length) byNumber.set(current.number, narration);
    }
    current = null;
  };

  for (let index = Math.max(start, 0); index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    if (raw.startsWith('~~')) {
      if (current) current.parts.push(raw.slice(2).trim());
      continue;
    }
    const muslimKitab = MUSLIM_KITAB.exec(raw);
    const h3Kitab = !raw.startsWith('### ||') ? H3_KITAB.exec(raw) : null;
    if (muslimKitab || (h3Kitab && raw.includes('كتاب'))) {
      flush();
      kitab = heading((muslimKitab ?? h3Kitab)?.[1] ? raw.replace(/^#+\s*\|+\s*/, '') : raw);
      bab = null;
      continue;
    }
    if (H3_BAB.test(raw) || HASH_BAB.test(raw) || MUSLIM_BAB.test(raw)) {
      flush();
      bab = heading(raw.replace(/^#+\s*\|*\s*/, ''));
      continue;
    }
    const hadith = HADITH.exec(raw);
    const hadithRest = hadith?.[2] ?? '';
    const hadithNumbers = (hadith?.[1] ?? '').trim().split(/\s+/).map(Number).filter((value) => value >= 1);
    const reasonable = hadithNumbers.filter((value) => value <= 20_000);
    const hadithNumber = reasonable.length === hadithNumbers.length ? reasonable[0] : reasonable.at(-1);
    if (hadith && hadithNumber && !/^(?:باب|كتاب)(?:\s|$)/.test(hadithRest)) {
      flush();
      current = {
        number: hadithNumber,
        parts: [hadithRest],
        kitab,
        bab,
      };
    }
  }
  flush();

  const narrations = [...byNumber.values()].sort((a, b) => a.number - b.number);
  const maxNumber = narrations.at(-1)?.number ?? 0;
  const present = new Set(narrations.map((narration) => narration.number));
  const missing: number[] = [];
  for (let number = 1; number <= maxNumber; number += 1) {
    if (!present.has(number)) missing.push(number);
  }
  return {
    narrations,
    maxNumber,
    missing,
    duplicateNumbers: [...new Set(duplicateNumbers)].sort((a, b) => a - b),
  };
}
