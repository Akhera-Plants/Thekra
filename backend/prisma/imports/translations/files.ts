import type { EnglishBook } from './citation.js';

/** Pinned English editions of the same six-book file. A changed hash stops the import. */
export const ENGLISH_EDITIONS: readonly {
  book: EnglishBook;
  file: string;
  sha256: string;
}[] = [
  { book: 'bukhari', file: 'eng-bukhari.min.json', sha256: '60f8dfcf2cb8bcd2c8e281be68d912ee153e0fc4d02ad317d33c532d3814a04f' },
  { book: 'muslim', file: 'eng-muslim.min.json', sha256: 'b5a04a66206b2cfaab18e2439ed2efeb824c6e179627e36a883dc060c03d4960' },
  { book: 'abudawud', file: 'eng-abudawud.min.json', sha256: '81f711c6240f517b3fce6f97ecb019c1831775297e25f1797e5785c11f61c6d8' },
  { book: 'tirmidhi', file: 'eng-tirmidhi.min.json', sha256: 'cf16ae15f7f6f23faab1c348d3962b49ac96e0e25cac7930b3725773bb6887f3' },
  { book: 'ibnmajah', file: 'eng-ibnmajah.min.json', sha256: 'c6966c9a02460817fec348945407b8407fcb9f0b0425022ce625792d0c22078b' },
];

/**
 * Saheeh International, the Umm Muhammad wording. Quran.com no longer returns
 * resource 131 without a key, so the file is the same publisher’s pinned edition.
 */
export const QURAN_EN_FILE = 'eng-ummmuhammad.json';
export const QURAN_EN_SHA256 = '5ac5aab3e152dd76b615d8748e2198c428f88cd3bd19d240b3e8feb89de6f28c';
export const QURAN_EN_URL = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/eng-ummmuhammad.json';

export function hadithEditionUrl(file: string): string {
  return `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${file}`;
}
