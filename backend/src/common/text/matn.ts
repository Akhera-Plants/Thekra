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
const SALAWAT = '(?:صلي\\s+الله\\s+عليه(?:\\s+و(?:اله\\s+)?سلم)?|عليه\\s+الصلاه\\s+والسلام)';
const SPEECH = '(?:انه\\s+قال|قال|يقول|تقول)';
const LEAD = '(?:سمعت|سمعنا|سال|سالت|سالوا|قالت|يقول|تقول|قالوا|قال|قلت|عن|ان)';
/** A transmitter introducing the Prophet, then the speech verb when it is there. */
const CUE = new RegExp(
  `${LEAD}\\s+(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?(?:\\s+${SPEECH})?`,
  'g',
);
/** «سأل النبي … قال» puts the speech verb after the question, not on the name. */
const PROPHETIC = new RegExp(`(?:يا\\s+)?${NAME}(?:\\s+${SALAWAT})?\\s+${SPEECH}`, 'g');
/** Arabic letters are not `\w`, so a word boundary cannot be used here. */
const TRANSMISSION = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني)(?![\u0600-\u06FF])/;

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
/** Footnote marks such as «\ 1 \» are not part of the narration. */
export function stripFootnotes(value: string): string {
  return value.replace(/\\+\s*\d+\s*\\+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sliceAt(trimmed: string, map: readonly number[], foldedEnd: number): MatnSplit {
  const origin = foldedEnd >= map.length ? trimmed.length : (map[foldedEnd] ?? trimmed.length);
  const matnText = stripFootnotes(trimmed.slice(origin).replace(/^[\s:：،,.\-–—]+/, ''));
  return { isnadText: stripFootnotes(trimmed.slice(0, origin)), matnText };
}

function usable(split: MatnSplit): boolean {
  return letterCount(split.matnText) >= MIN_MATN_LETTERS && !TRANSMISSION.test(foldWithMap(split.matnText).text);
}

export function splitMatn(narration: string): MatnSplit {
  const trimmed = stripFootnotes(narration.trim());
  const { text, map } = foldWithMap(trimmed);
  const ends: number[] = [];
  for (const pattern of [CUE, PROPHETIC]) {
    for (const match of text.matchAll(pattern)) {
      ends.push((match.index ?? 0) + match[0].length);
    }
  }
  ends.sort((a, b) => b - a);
  for (const foldedEnd of ends) {
    const split = sliceAt(trimmed, map, foldedEnd);
    if (usable(split)) return split;
  }
  const continues = /^(?:و)?(?:حدثنا|حدثني|اخبرنا|اخبرني|انبانا|انباني|سمعت|عن)(?![\u0600-\u06FF])/;
  for (const match of text.matchAll(/(?<![\u0600-\u06FF])(?:فقال|وقالت|وقال|فيقول|قالت|يقول|تقول|قال)/g)) {
    const after = text.slice((match.index ?? 0) + match[0].length).replace(/^[\s:،,."«»]+/, '');
    if (continues.test(after)) continue;
    const split = sliceAt(trimmed, map, (match.index ?? 0) + match[0].length);
    if (usable(split)) return split;
  }
  if (TRANSMISSION.test(text)) {
    const quoteAt = text.search(/[«"']/);
    if (quoteAt > 0) {
      const split = sliceAt(trimmed, map, quoteAt);
      if (usable(split)) return split;
    }
  }
  return { isnadText: '', matnText: trimmed };
}
