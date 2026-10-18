/**
 * Display-only matn extraction for dense review lists.
 * The stored text is never changed; a full text is always one click (expand) away.
 *
 * Heuristic, in order:
 *  1. Only texts that open with a transmission verb (حدثنا، أخبرنا…) are touched.
 *  2. If a quoted span follows the chain (« " “), the matn starts at the quote mark.
 *  3. Otherwise the matn starts after the last «قال رسول الله ﷺ / النبي ﷺ قال/يقول:» marker.
 *  4. If nothing is found, or what is left is too short to be a matn, the text is returned whole.
 */

const ISNAD_OPENER = /^\s*(?:و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني|ثنا|نا|أنا)(?=[\s،:]))/;
const QUOTE_OPEN = /[«"“]/;
const PROPHET_SAYING =
  /(?:صلى الله عليه وسلم|ﷺ)\s*(?:،\s*)?(?:أنه\s+)?(?:قال|يقول)\s*:?\s*/g;
const MIN_MATN_LENGTH = 12;

export interface MatnSplit {
  /** Text to show in a one-line list cell. */
  matn: string;
  /** True when a chain was removed for display. */
  stripped: boolean;
}

export function splitMatn(text: string): MatnSplit {
  const source = text.trim();
  if (!ISNAD_OPENER.test(source)) return { matn: source, stripped: false };

  const quoteIndex = source.search(QUOTE_OPEN);
  if (quoteIndex > 0) {
    const rest = source.slice(quoteIndex + 1).replace(/[»"”]\s*$/, '').trim();
    if (rest.length >= MIN_MATN_LENGTH) return { matn: rest, stripped: true };
  }

  let lastEnd = -1;
  for (const match of source.matchAll(PROPHET_SAYING)) {
    lastEnd = (match.index ?? 0) + match[0].length;
  }
  if (lastEnd > 0) {
    const rest = source.slice(lastEnd).trim();
    if (rest.length >= MIN_MATN_LENGTH) return { matn: rest, stripped: true };
  }

  return { matn: source, stripped: false };
}
