/**
 * Rejects input that is not clean Arabic Unicode (e.g. a PDF text layer in a
 * legacy font encoding, or OCR output in the wrong script). Vision v2 §5.1.
 */

const ARABIC_LETTER = /[\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF]/gu;
const ANY_LETTER = /\p{L}/gu;

/** Default floor for the whole parsed work. Real OpenITI texts sit above 0.99. */
const MIN_ARABIC_RATIO = 0.9;

/** Share of letters that are Arabic letters (0 when the text has no letters). */
export function arabicLetterRatio(text: string): number {
  const letters = text.match(ANY_LETTER)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(ARABIC_LETTER)?.length ?? 0) / letters;
}

export interface GuardReport {
  ratio: number;
  /** Indexes of individual texts below the floor (reported, not fatal on their own). */
  lowRecords: number[];
}

/** Throws when the combined texts fall below `minRatio`; lists weak records otherwise. */
export function assertArabicText(texts: readonly string[], minRatio = MIN_ARABIC_RATIO): GuardReport {
  let arabic = 0;
  let letters = 0;
  const lowRecords: number[] = [];
  texts.forEach((text, index) => {
    const textLetters = text.match(ANY_LETTER)?.length ?? 0;
    const textArabic = text.match(ARABIC_LETTER)?.length ?? 0;
    letters += textLetters;
    arabic += textArabic;
    if (textLetters > 0 && textArabic / textLetters < minRatio) lowRecords.push(index);
  });
  const ratio = letters === 0 ? 0 : arabic / letters;
  if (ratio < minRatio) {
    throw new Error(
      `Arabic-letter ratio ${ratio.toFixed(3)} is below ${minRatio}: input is not clean Arabic Unicode`,
    );
  }
  return { ratio, lowRecords };
}
