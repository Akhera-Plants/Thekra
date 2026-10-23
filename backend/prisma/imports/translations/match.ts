/**
 * Which English entry of an edition belongs to a stored narration.
 *
 * Editions are keyed by their own running number (`hadithnumber`); a stored
 * citation names the printed number (`arabicnumber`: Fuad Abd al-Baqi for
 * Muslim, which differs from the running number for 7,219 entries). Looking
 * the printed number up as a running number put the English of another hadith
 * under Muslim 2589 (audit B01). One printed number can hold several
 * narrations (Muslim 1109, 1109.01 …), so the stored Arabic picks among them,
 * and an entry whose Arabic barely overlaps the stored text is not used.
 */

export interface EditionEntry {
  /** Words of the edition's Arabic for the same running number. */
  arabic: ReadonlySet<string>;
  english: string;
  /** The printed number is whole (1109), not a sub-narration (1109.01). */
  main: boolean;
}

/** A sure pick: most of the stored words appear in the entry. */
export const STRONG_MATCH = 0.6;
/** Below this overlap the entry is another text: no English is better than the wrong English. */
export const MIN_OVERLAP = 0.2;

/** Arabic words for comparison only: no tashkeel, one alef, no punctuation or digits. */
export function arabicWords(text: string): Set<string> {
  const folded = text
    .replace(/[ً-ٰٟـۖ-ۭ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^ء-ي\s]/g, ' ');
  return new Set(folded.split(/\s+/).filter((word) => word.length > 1));
}

function shared(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const word of a) if (b.has(word)) count += 1;
  return count;
}

/**
 * The entry for a stored narration among the entries of its printed number,
 * or null when none is close enough. A strong text match wins; otherwise the
 * main narration of the number, if its text still overlaps.
 */
export function pickEntry(
  stored: ReadonlySet<string>,
  entries: readonly EditionEntry[],
): { entry: EditionEntry; score: number } | null {
  if (stored.size === 0 || entries.length === 0) return null;
  const scored = entries.map((entry) => {
    const common = shared(stored, entry.arabic);
    return { entry, ofStored: common / stored.size, ofEntry: common / Math.max(entry.arabic.size, 1) };
  });
  const best = scored.reduce((a, b) => (b.ofStored > a.ofStored ? b : a));
  const pick = best.ofStored >= STRONG_MATCH ? best : (scored.find((row) => row.entry.main) ?? best);
  const score = Math.max(pick.ofStored, pick.ofEntry);
  return score >= MIN_OVERLAP ? { entry: pick.entry, score } : null;
}

/** Entries of an edition by printed number. Entries without a printed number are left out. */
export function indexByPrintedNumber(
  english: ReadonlyArray<{ hadithnumber: number | string; arabicnumber?: number | string; text?: string }>,
  arabicByRunning: ReadonlyMap<number, string>,
  toPlain: (text: string) => string,
): Map<number, EditionEntry[]> {
  const index = new Map<number, EditionEntry[]>();
  for (const row of english) {
    if (row.arabicnumber === undefined || row.arabicnumber === '') continue;
    const printed = Number(row.arabicnumber);
    const running = Number(row.hadithnumber);
    const text = toPlain(row.text ?? '');
    if (!Number.isFinite(printed) || printed < 1 || text.length < 8) continue;
    const number = Math.trunc(printed);
    const list = index.get(number) ?? [];
    list.push({
      arabic: arabicWords(arabicByRunning.get(running) ?? ''),
      english: text,
      main: Number.isInteger(printed),
    });
    index.set(number, list);
  }
  return index;
}
