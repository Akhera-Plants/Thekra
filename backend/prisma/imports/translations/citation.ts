/** English edition of the same six-book file used to confirm a narration. */
export type EnglishBook = 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi' | 'ibnmajah';

const CITE =
  /البخاري\s+(\d+)|أبي داود،?\s*رقم\s+(\d+)|الترمذي،?\s*رقم\s+(\d+)|ابن ماجه،?\s*رقم\s+(\d+)|مسلم\s+(\d+)/g;

const BOOKS: readonly EnglishBook[] = ['bukhari', 'abudawud', 'tirmidhi', 'ibnmajah', 'muslim'];

/** Every book-and-number the stored grade reference names, in citation order. */
export function citedEditions(reference: string | null): Array<{ book: EnglishBook; number: number }> {
  if (!reference) return [];
  const found: Array<{ book: EnglishBook; number: number }> = [];
  for (const match of reference.matchAll(CITE)) {
    const index = match.slice(1).findIndex((group) => group != null);
    const book = BOOKS[index];
    const number = Number(match[index + 1]);
    if (!book || !Number.isInteger(number) || number < 1) continue;
    found.push({ book, number });
  }
  return found;
}

export function plainEnglish(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
