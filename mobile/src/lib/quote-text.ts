/**
 * Display-time clean-up of a text's outer quote marks (owner round 5, A-04): some stored texts are wrapped whole in
 * «…» or "…" (the card already says what the text is). Only a pair that wraps the WHOLE text is removed, and only when
 * the marks inside stay balanced, so «قال: «…»» keeps its inner quotation. The data is not changed.
 */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['«', '»'],
  ['"', '"'],
  ['“', '”'],
  ['”', '“'],
];

function balanced(s: string, open: string, close: string): boolean {
  // The same mark opens and closes ("…"): a pair inside cannot be told from two separate quotations, so keep them.
  if (open === close) return !s.includes(open);
  let depth = 0;
  for (const ch of s) {
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

export function stripOuterQuotes(text: string): string {
  let s = text.trim();
  for (let guard = 0; guard < 2; guard += 1) {
    const pair = PAIRS.find(([o, c]) => s.length > 2 && s.startsWith(o) && s.endsWith(c));
    if (!pair) break;
    const inner = s.slice(pair[0].length, s.length - pair[1].length).trim();
    if (!inner || !balanced(inner, pair[0], pair[1])) break;
    s = inner;
  }
  return s;
}

/** «هود: 114» / «Hud 11:114»: the source line under a verse shown on its own (A-16). */
export function verseSourceLine(
  quran: { surahNameAr?: string | null; surahName?: string | null; surahNumber?: number | null; ayahNumber?: number | null } | null | undefined,
  arabicUI: boolean,
): string | null {
  if (!quran) return null;
  const ayah = quran.ayahNumber;
  if (arabicUI) {
    const name = quran.surahNameAr ?? quran.surahName;
    if (!name || !ayah) return null;
    return `${name}: ${ayah}`;
  }
  const name = quran.surahName || quran.surahNameAr;
  if (!name || !quran.surahNumber || !ayah) return null;
  return `${name} ${quran.surahNumber}:${ayah}`;
}
