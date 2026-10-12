import { normalizeArabic } from './arabic-normalizer.js';

/** Arabic words only, for matn comparison. Punctuation and digits are dropped. */
export function normalizeMatn(input: string): string {
  return normalizeArabic(input)
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
