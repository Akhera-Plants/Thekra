/**
 * Ibn Ashur's headings name a surah and an ayah or a range. OpenITI wraps some
 * headings onto the next line and glues a milestone (`ms123`) into the numbers.
 */
import { cleanInline } from '../lib/openiti.js';

export interface AshurPassage {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  ayahKey: string;
  text: string;
}

export interface AshurParse {
  passages: AshurPassage[];
  /** Headings that named a surah but not a usable ayah range. */
  unparsed: string[];
}

const MAX_AYAH = 286;
const RANGE = /(?:الآيات|الآية|آية)\s*(\d+)(?:\s*(?:إلى|الى|إلي)\s*(\d+))?/;

function isHeading(line: string): boolean {
  return line.startsWith('### | [سورة');
}

function headingText(line: string, next: string | undefined): { text: string; consumedNext: boolean } {
  if (line.includes(']')) return { text: cleanInline(line.replace(/^###\s*\|+\s*/, '')), consumedNext: false };
  const continuation = (next ?? '').replace(/^#\s*/, '');
  return {
    text: cleanInline(`${line.replace(/^###\s*\|+\s*/, '')} ${continuation}`),
    consumedNext: true,
  };
}

export function ayahKeyOf(surah: number, start: number, end: number): string {
  return start === end ? `${surah}:${start}` : `${surah}:${start}-${end}`;
}

export function parseAshur(source: string): AshurParse {
  const lines = source.split(/\r?\n/);
  const passages: AshurPassage[] = [];
  const unparsed: string[] = [];
  let current: { surah: number; ayahStart: number; ayahEnd: number; parts: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const text = cleanInline(current.parts.join(' '));
    if (text) {
      passages.push({
        surah: current.surah,
        ayahStart: current.ayahStart,
        ayahEnd: current.ayahEnd,
        ayahKey: ayahKeyOf(current.surah, current.ayahStart, current.ayahEnd),
        text,
      });
    }
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!isHeading(line)) {
      if (current && !line.startsWith('#META#')) current.parts.push(line.replace(/^~~/, '').replace(/^#\s?/, ''));
      continue;
    }
    flush();
    const heading = headingText(line, lines[index + 1]);
    if (heading.consumedNext) index += 1;
    const surah = /\((\d+)\)/.exec(heading.text);
    const range = RANGE.exec(heading.text);
    const namesRange = /إلى|الى|إلي/.test(heading.text);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : start;
    if (!surah || !range || (namesRange && !range[2]) || start < 1 || end < start || end > MAX_AYAH) {
      unparsed.push(heading.text);
      continue;
    }
    current = { surah: Number(surah[1]), ayahStart: start, ayahEnd: end, parts: [] };
  }
  flush();
  return { passages, unparsed };
}

/** Ayah keys from the Quran that no passage covers. */
export function ashurGaps(passages: readonly AshurPassage[], verseKeys: readonly string[]): string[] {
  const covered = new Set<string>();
  for (const passage of passages) {
    for (let ayah = passage.ayahStart; ayah <= passage.ayahEnd; ayah += 1) {
      covered.add(`${passage.surah}:${ayah}`);
    }
  }
  return verseKeys.filter((key) => !covered.has(key));
}
