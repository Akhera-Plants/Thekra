/**
 * Strips printed-page markers that leak from OpenITI / Shamela source files
 * into stored quote text.
 *
 * Recognised forms (Arabic ص = "page"):
 *   [ص: 266]       bracket, colon+space, digits
 *   [ص:266]        bracket, colon, digits (no space)
 *   [ص 266]        bracket, space, digits
 *   (ص 266)        parenthesis, space, digits
 *   [ج2 ص: 15]     volume + page (جـ or ج prefix, optional digits)
 *   [ج2 ص 15]      same without colon
 *   (ج2 ص 15)      parenthesis variant
 *
 * Patterns that are intentionally NOT touched:
 *   ﴿ … ﴾          Quranic verse brackets (U+FD3E / U+FD3F)
 *   { … }           curly-brace spans (Quran replacement markers)
 *   [word]          any bracket containing a non-numeric / non-ص word
 *   } [ص: N]        Quran surah Sad verse citation that follows a {…} span.
 *                   The nearest non-space / non-«.» character before the marker
 *                   is «}» or «﴾»: those positions are verse citations, not page
 *                   breaks.
 *
 * After removal, two or more consecutive spaces are collapsed to one.
 */

/**
 * Matches any candidate marker (page-break or verse citation).
 * A named capture group `vol` exists only to give the regex a capture so that
 * the replacer receives `(match, volCapture, offset, fullString)`.
 *
 * Pattern breakdown:
 *   [\[(]                   opening bracket or paren
 *   (?<vol>ج[ـ]?\d+\s+)?    optional volume prefix (named group)
 *   ص:?\s*                  ص with optional colon and optional whitespace
 *   \d+                     the page / verse number
 *   [\])]                   closing bracket or paren
 */
const CANDIDATE = /[\[(](?<vol>ج[ـ]?\d+\s+)?ص:?\s*\d+[\])]/gu;

/**
 * Walk backwards from `pos - 1`, skipping whitespace and period characters.
 * Return true when the first non-skipped character is `}` or `﴾` (U+FD3F).
 */
function precededByVerseClose(text: string, pos: number): boolean {
  let i = pos - 1;
  while (i >= 0) {
    const ch = text[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '.') {
      i -= 1;
      continue;
    }
    return ch === '}' || ch === '\uFD3E'; // } or ﴾ (U+FD3E closing Quran bracket)
  }
  return false;
}

/**
 * Returns a copy of `text` with all page-number markers removed and
 * surrounding double spaces collapsed.
 *
 * `[ص: N]` that is immediately preceded (ignoring spaces / periods) by
 * `}` or `﴾` is kept because in that position it is a Quran verse citation
 * (سورة ص / Surah Sad), not a printed-page indicator.
 *
 * The function is idempotent: calling it twice produces the same result.
 */
export function stripPageMarkers(text: string): string {
  // The replacer signature for a regex with named groups is:
  //   (match, namedGroups, offset, fullString) — but only in the 4-arg form
  // when there are named captures.  In Node ≥ 22 the signature is:
  //   (match, ...captureGroups, offset, fullString, namedGroups)
  // We use the rest-args form to safely grab offset regardless of group count.
  const stripped = text.replace(
    CANDIDATE,
    (...args: [string, ...unknown[]]) => {
      // args: [match, vol?, offset, fullString, namedGroups?]
      // offset is always args[args.length - 3] (before fullString & namedGroups)
      const offset = args[args.length - 3] as number;
      const fullStr = args[args.length - 2] as string;
      return precededByVerseClose(fullStr, offset) ? (args[0] as string) : ' ';
    },
  );
  return stripped.replace(/  +/g, ' ').trim();
}
