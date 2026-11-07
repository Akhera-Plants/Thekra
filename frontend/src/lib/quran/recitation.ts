/**
 * Quran recitation, verse by verse (owner round 5, F-03 a): one reciter (Mishary Alafasy, 128 kbps) streamed from
 * EveryAyah's public per-ayah files. Nothing is stored or proxied by Thekra. No hadith audio, ever.
 *
 * The base URL lives here only; `next.config.ts` allows its origin in the CSP `media-src`
 * (keep {@link RECITATION_ORIGIN} and that list in step). Licence: see docs (owner to confirm EveryAyah's terms).
 */
export const RECITATION_BASE_URL = 'https://everyayah.com/data/Alafasy_128kbps';

export const RECITATION_ORIGIN = new URL(RECITATION_BASE_URL).origin;

/** `SSSAAA.mp3`: surah and ayah, each padded to three digits (2:255 → 002255.mp3). */
export function recitationUrl(surah: number, ayah: number): string | null {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1 || ayah > 286) {
    return null;
  }
  return `${RECITATION_BASE_URL}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}
