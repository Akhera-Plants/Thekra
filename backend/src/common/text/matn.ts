/**
 * Splits a narration into isnad and matn at the last transmission phrase
 * before the Prophet's words (قال رسول الله / أن النبي / سمعت النبي …).
 * Tashkeel is ignored while searching; the returned slices keep the original text.
 */

const MARKS = /[\u064B-\u0652\u0670\u06D6-\u06ED]/;

function foldChar(ch: string): string {
  if (MARKS.test(ch) || ch === '\u0640') return '';
  if (ch === '\u0623' || ch === '\u0625' || ch === '\u0622' || ch === '\u0671') return '\u0627';
  if (ch === '\u0649') return '\u064A';
  if (ch === '\u0629') return '\u0647';
  return ch;
}

function foldWithMap(input: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const folded = foldChar(input[index] ?? '');
    for (const ch of folded) {
      text += ch;
      map.push(index);
    }
  }
  return { text, map };
}

const NAME = '(?:رسول\\s+الله|النبي|نبي\\s+الله)';
const SALAWAT = '(?:صلي\\s+الله\\s+عليه(?:\\s+وسلم)?|عليه\\s+الصلاه\\s+والسلام)?';
const SPEECH = '(?:انه قال|قال|يقول)?';
const CUE = new RegExp(
  `(?:سمعت|قالت|يقول|تقول|قال|عن|ان)\\s+${NAME}\\s*${SALAWAT}\\s*${SPEECH}`,
  'g',
);

const MIN_MATN_LETTERS = 8;

function letterCount(value: string): number {
  return (value.match(/[\u0600-\u06FF]/g) ?? []).length;
}

export interface MatnSplit {
  isnadText: string;
  matnText: string;
}

/**
 * Returns the matn after the last usable transmission phrase.
 * A phrase whose remainder is shorter than a real matn is skipped, so a
 * trailing «بمثله» does not eat the narration.
 */
export function splitMatn(narration: string): MatnSplit {
  const trimmed = narration.trim();
  const { text, map } = foldWithMap(trimmed);
  const ends: number[] = [];
  for (const match of text.matchAll(CUE)) {
    const start = match.index ?? 0;
    ends.push(start + match[0].length);
  }
  for (let index = ends.length - 1; index >= 0; index -= 1) {
    const foldedEnd = ends[index] ?? 0;
    const origin = foldedEnd >= map.length ? trimmed.length : (map[foldedEnd] ?? trimmed.length);
    const matnText = trimmed.slice(origin).replace(/^[\s:：،,.\-–—]+/, '').trim();
    if (letterCount(matnText) >= MIN_MATN_LETTERS) {
      return { isnadText: trimmed.slice(0, origin).trim(), matnText };
    }
  }
  return { isnadText: '', matnText: trimmed };
}
