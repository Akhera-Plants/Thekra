import type { SunanBookKey } from '../../../src/modules/hadith/sunan-tahqiq.js';

/** Pinned edition files. A changed hash stops the import instead of silently changing a grade. */
export const SUNAN_EDITIONS: readonly {
  book: SunanBookKey;
  file: string;
  sha256: string;
}[] = [
  {
    book: 'abudawud',
    file: 'ara-abudawud.min.json',
    sha256: '30dd3792ea65abe7fd0be8d568809d4eac04e38cbbd588b9c6055218fe43675f',
  },
  {
    book: 'ibnmajah',
    file: 'ara-ibnmajah.min.json',
    sha256: '495fcccdea5f2d157794d2b1bd1eaa0e0a5ff5aeb6be2d7817de8f25e3b3349c',
  },
  {
    book: 'tirmidhi',
    file: 'ara-tirmidhi.min.json',
    sha256: '22b7ffbbca9beb5d4f108cc0389a3cd16917876b3ceb32993c46e1554afd871b',
  },
];

export function editionUrl(file: string): string {
  return `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${file}`;
}
