/**
 * The website's faces (frontend/src/lib/fonts.ts), converted from the site's own woff2 files to TTF:
 * - IBM Plex Sans Arabic: the whole Arabic UI and hadith/scholar text (the public site's `--font-plex`);
 * - Amiri Quran: Uthmani verse text (`--font-quran`); Amiri: source-book wordmarks;
 * - Source Serif 4: the English UI and English reading text (`--font-english`), cut to static weights.
 * Android picks a face by family name, not by `fontWeight`, so each weight is its own family.
 */

export const FontFiles = {
  'Plex-Regular': require('../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  'Plex-Medium': require('../../assets/fonts/IBMPlexSansArabic-Medium.ttf'),
  'Plex-SemiBold': require('../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
  'AmiriQuran-Regular': require('../../assets/fonts/AmiriQuran-Regular.ttf'),
  'Amiri-Regular': require('../../assets/fonts/Amiri-Regular.ttf'),
  'SourceSerif-Regular': require('../../assets/fonts/SourceSerif4-Regular.ttf'),
  'SourceSerif-SemiBold': require('../../assets/fonts/SourceSerif4-SemiBold.ttf'),
} as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold';

/** The UI family for a weight in the current language (Arabic: Plex; English: Source Serif, as on the site). */
export function uiFont(weight: FontWeightName, english: boolean): string {
  if (english) return weight === 'regular' ? 'SourceSerif-Regular' : 'SourceSerif-SemiBold';
  if (weight === 'medium') return 'Plex-Medium';
  if (weight === 'semibold') return 'Plex-SemiBold';
  return 'Plex-Regular';
}

export const QURAN_FONT = 'AmiriQuran-Regular';
export const WORDMARK_FONT = 'Amiri-Regular';
