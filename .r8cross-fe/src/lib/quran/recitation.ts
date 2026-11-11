/**
 * Quran recitation, verse by verse (owner round 5, F-03 a; round 6 §8 «Audio»: several reciters, chosen in the
 * settings). Each verse streams the chosen reciter's public per-ayah file from EveryAyah (practice-core `reciters.ts`
 * holds the reciters and builds the URL). Nothing is stored or proxied by Thekra. No hadith audio, ever.
 *
 * Every reciter lives on the same origin, `https://everyayah.com`, which `next.config.ts` allows in the CSP
 * `media-src` (keep {@link RECITATION_ORIGIN} and that list in step). Licence: see docs (owner to confirm EveryAyah's terms).
 */
import { ayahAudioUrl, EVERYAYAH_ORIGIN } from '@thekra/practice-core';

export const RECITATION_ORIGIN = EVERYAYAH_ORIGIN;

/**
 * `…/<reciter folder>/SSSAAA.mp3`: surah and ayah, each padded to three digits (2:255 → 002255.mp3), for the reciter
 * key (absent or unknown: the default reciter). Null for a reference outside the mushaf.
 */
export function recitationUrl(surah: number, ayah: number, reciterKey?: string | null): string | null {
  return ayahAudioUrl(surah, ayah, reciterKey);
}
