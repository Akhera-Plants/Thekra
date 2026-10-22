/**
 * The taxonomy matcher's normalisation. Stricter than normalizeArabic:
 * it also folds Persian yeh and kaf, which the OCR Targhib titles contain.
 */
export function norm(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = norm(phrase);
  return needle.length > 0 && norm(haystack).includes(needle);
}
