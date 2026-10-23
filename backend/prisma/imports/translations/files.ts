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
 * Arabic of the same editions, read only to check that an English entry is the stored narration
 * (match.ts). Same running numbers as the English files.
 */
export const ARABIC_EDITIONS: readonly {
  book: EnglishBook;
  file: string;
  sha256: string;
}[] = [
  { book: 'bukhari', file: 'ara-bukhari.min.json', sha256: 'f887d8724f75fb6e1d5d29342a173af5346ad9b933173c85e6e3cb570063ea33' },
  { book: 'muslim', file: 'ara-muslim.min.json', sha256: '2cb296f3455ff8a3da9f6a0ca3de75da675788b2fb446ad316df297838e48217' },
  { book: 'abudawud', file: 'ara-abudawud.min.json', sha256: '30dd3792ea65abe7fd0be8d568809d4eac04e38cbbd588b9c6055218fe43675f' },
  { book: 'tirmidhi', file: 'ara-tirmidhi.min.json', sha256: '22b7ffbbca9beb5d4f108cc0389a3cd16917876b3ceb32993c46e1554afd871b' },
  { book: 'ibnmajah', file: 'ara-ibnmajah.min.json', sha256: '495fcccdea5f2d157794d2b1bd1eaa0e0a5ff5aeb6be2d7817de8f25e3b3349c' },
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
