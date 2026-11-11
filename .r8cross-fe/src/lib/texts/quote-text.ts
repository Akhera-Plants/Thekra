/**
 * Display-time clean-ups of a stored text. The stored `textAr` is never changed here (data fixes need the owner's OK,
 * plan §4); these only change what is drawn.
 */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['«', '»'],
  ['"', '"'],
  ['“', '”'],
  ['„', '“'],
];

/**
 * A-04: drops one pair of quote marks that wraps the WHOLE text («…» or "…"), keeping a final full stop. Only when the
 * inner text holds no other mark of the same pair, so «قال: «…» ثم قال» or two quoted sentences stay untouched.
 */
export function stripOuterQuotes(text: string): string {
  const trimmed = text.trim();
  const stop = /[.。]$/.test(trimmed) ? trimmed.slice(-1) : '';
  const body = stop ? trimmed.slice(0, -1).trimEnd() : trimmed;
  for (const [open, close] of PAIRS) {
    if (body.length < 3 || !body.startsWith(open) || !body.endsWith(close)) continue;
    const inner = body.slice(open.length, body.length - close.length);
    if (inner.includes(open) || inner.includes(close)) return text;
    const cleaned = inner.trim();
    if (!cleaned) return text;
    return stop ? `${cleaned}${stop}` : cleaned;
  }
  return text;
}

/**
 * Comparable form of an Arabic text: no diacritics, tatweel, Quranic marks, punctuation, quote marks or digits;
 * alef/ya/ta-marbuta forms unified; single spaces.
 */
export function normalizeArabicText(text: string): string {
  return text
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[0-9٠-٩]/g, ' ')
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The quoted saying inside a narration («وعن فلان قال: قال رسول الله ﷺ: «…»»), when there is one. */
function quotedCore(text: string): string | null {
  const open = text.indexOf('«');
  if (open < 0) return null;
  const close = text.lastIndexOf('»');
  if (close <= open) return null;
  const core = normalizeArabicText(text.slice(open + 1, close));
  return core.length >= 25 ? core : null;
}

export interface NarrationText {
  id: string;
  textAr: string;
  /** Only texts of the same kind are compared (a verse never groups with a hadith; an athar never with a hadith). */
  kind: string;
}

export interface NarrationGroup<T> {
  lead: T;
  others: T[];
}

/** The sentences of a text («…، ومن كان…، ومن كان…»), each normalized and without its leading «و». */
function clauses(text: string): string[] {
  return text
    .split(/[،,؛;.!؟?\n]+/)
    .map((part) => normalizeArabicText(part).replace(/^و(?=\S)/, ''))
    .filter((part) => part.length >= 8);
}

/**
 * Two texts are the same narration when their normalized forms are equal, when they hold the same sentences in
 * another order, or when one holds the other nearly whole.
 */
export function sameNarration(a: string, b: string): boolean {
  const fullA = normalizeArabicText(a);
  const fullB = normalizeArabicText(b);
  if (fullA.length < 20 || fullB.length < 20) return false;
  if (fullA === fullB) return true;
  const partsA = clauses(a);
  const partsB = clauses(b);
  if (partsA.length >= 2 && partsA.length === partsB.length) {
    const setB = new Set(partsB);
    if (partsA.every((part) => setB.has(part))) return true;
  }
  const cores = [quotedCore(a) ?? fullA, quotedCore(b) ?? fullB];
  const [shorter, longer] = cores[0].length <= cores[1].length ? cores : [cores[1], cores[0]];
  if (shorter === longer) return true;
  // Containment: the short wording sits whole inside the long one and is most of it (conservative, W-08).
  return shorter.length >= 40 && shorter.length / longer.length >= 0.6 && longer.includes(shorter);
}

/**
 * W-08: narrations of the same text on one page become one entry, placed where its first narration stood (the reading
 * order the server chose). The lead is the clearest wording: the lowest `rank` (e.g. a Sahihayn text before a later
 * book's copy), ties kept in page order; the rest follow under «وروي بألفاظ أخرى».
 */
export function groupNarrations<T>(
  items: readonly T[],
  text: (item: T) => NarrationText,
  rank: (item: T) => number = () => 0,
): NarrationGroup<T>[] {
  const members: T[][] = [];
  for (const item of items) {
    const current = text(item);
    const home = members.find((group) => {
      const first = text(group[0]);
      return first.kind === current.kind && sameNarration(first.textAr, current.textAr);
    });
    if (home) home.push(item);
    else members.push([item]);
  }
  return members.map((group) => {
    let best = 0;
    group.forEach((item, index) => {
      if (rank(item) < rank(group[best])) best = index;
    });
    return { lead: group[best], others: group.filter((_, index) => index !== best) };
  });
}
