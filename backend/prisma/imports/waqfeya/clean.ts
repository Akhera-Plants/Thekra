/**
 * OCR cleaner for the Waqfeya Document AI text. It deletes stray glyphs,
 * page-number lines, and repeated running headers. It never rewrites an
 * Arabic word.
 */
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';

/** Characters removed: anything outside Arabic, digits, and book punctuation. */
const DISALLOWED =
  /[^\s\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9.,،؛:!?؟\-–—/\\"'«»()[\]{}*+=|﴿﴾۝۞]/g;

const PAGE_MARKER = /^\[\[\d+:\d+\]\]$/;

const GRADE_KEYS = new Set([
  'صحيح',
  'حسن',
  'صحيح لغيره',
  'حسن لغيره',
  'ص لغيره',
  'ح لغيره',
]);

/** Matching key only. Stored text keeps its tashkeel and its letters. */
export function foldArabic(text: string): string {
  return normalizeArabic(text)
    .replace(/[\u06CC\u064A\u0649]/g, '\u064A')
    .replace(/[\u06A9\u0643]/g, '\u0643')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Albani's margin ruling, when the whole line is that word and nothing else. */
export function gradeToken(line: string): string | null {
  const folded = foldArabic(line).replace(/^[.\-–—\s]+/, '').replace(/[.\s]+$/, '');
  return GRADE_KEYS.has(folded) ? folded : null;
}

const GLUED_GRADE_KEYS = ['صحيح لغيره', 'حسن لغيره', 'ص لغيره', 'ح لغيره'];

/**
 * A margin ruling glued to the following line by Document AI.
 * Bare «صحيح» / «حسن» are only read when they are the whole line, so a title
 * such as «صحيح الترغيب» is left untouched.
 */
const INLINE_GRADE_PATTERNS: Array<[RegExp, string]> = [
  [/صحيح\s+لغيره/g, 'صحيح لغيره'],
  [/حسن\s+لغيره/g, 'حسن لغيره'],
  [/ص\s+لغيره/g, 'ص لغيره'],
  [/ح\s+لغيره/g, 'ح لغيره'],
];

/** Margin abbreviations dumped into the matn. The bare words صحيح / حسن stay. */
export function stripInlineGrades(text: string): { text: string; token: string | null } {
  let token: string | null = null;
  let out = text;
  for (const [pattern, key] of INLINE_GRADE_PATTERNS) {
    pattern.lastIndex = 0;
    if (!pattern.test(out)) continue;
    if (!token) token = key;
    pattern.lastIndex = 0;
    out = out.replace(pattern, ' ');
  }
  return {
    token,
    text: out.replace(/[ ]{2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

export function splitLeadingGrade(line: string): { token: string; rest: string } | null {
  const exact = gradeToken(line);
  if (exact) return { token: exact, rest: '' };
  const trimmed = line.trim();
  const folded = foldArabic(trimmed);
  const key = GLUED_GRADE_KEYS.find((candidate) => folded.startsWith(`${candidate} `));
  if (!key) return null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const soFar = foldArabic(trimmed.slice(0, index + 1));
    if (soFar === key || soFar.startsWith(`${key} `)) {
      return { token: key, rest: trimmed.slice(index + 1).trim() };
    }
    if (soFar.length > key.length + 1) break;
  }
  return null;
}

function visible(line: string): string {
  return line.replace(DISALLOWED, '').replace(/[ \t]+/g, ' ').trim();
}

function isNoiseLine(line: string): boolean {
  if (PAGE_MARKER.test(line) || gradeToken(line)) return false;
  if (/[\u0621-\u064A\u0671-\u06D3]/.test(line)) return false;
  return true;
}

/**
 * Lines that open many pages (book title, chapter running head, folio).
 * Grade tokens are excluded so a margin «صحيح» is not thrown away.
 */
export function runningHeaderKeys(pages: readonly string[], minRepeats = 8): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    const lines = page
      .split(/\r?\n/)
      .map(visible)
      .filter(Boolean)
      .slice(0, 3);
    for (const line of lines) {
      if (gradeToken(line) || isNoiseLine(line)) continue;
      const key = foldArabic(line);
      if (key.length < 4 || key.length > 60 || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const headers = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= minRepeats) headers.add(key);
  }
  return headers;
}

export function cleanOcrPage(text: string, headers: ReadonlySet<string> = new Set()): string {
  const kept: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = visible(raw);
    if (!line) {
      if (kept.length > 0 && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }
    if (PAGE_MARKER.test(line) || gradeToken(line)) {
      kept.push(line);
      continue;
    }
    if (isNoiseLine(line)) continue;
    if (headers.has(foldArabic(line))) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
