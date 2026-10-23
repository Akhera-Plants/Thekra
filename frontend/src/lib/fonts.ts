import { Amiri_Quran } from 'next/font/google';
import localFont from 'next/font/local';

/** Uthmani Quran face. Thmanyah does not draw the small Quranic marks. */
export const amiriQuran = Amiri_Quran({
  weight: '400',
  subsets: ['arabic'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-quran',
});

/** IBM Plex Sans Arabic — public site UI (thekra-source). */
export const plexArabic = localFont({
  display: 'swap',
  adjustFontFallback: false,
  preload: true,
  variable: '--font-plex',
  src: [
    { path: '../fonts/plex/plex-regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/plex/plex-medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/plex/plex-semibold.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/plex/plex-semibold.woff2', weight: '700', style: 'normal' },
  ],
});

/**
 * Source Serif 4 (Adobe, OFL — public/licenses/SOURCE-SERIF-4-OFL.txt): the English face for
 * the whole English UI and English reading text. Upstream 4.005 variable woff2, unmodified, because
 * Google's subsets drop small caps (smcp/c2sc) and the ʿ ʾ transliteration marks; this file has
 * them, plus ā ī ū ḥ ṣ ḍ ṭ ẓ and an optical-size axis. Not preloaded: Arabic pages share this
 * layout and never need it; the Times-based fallback keeps the swap on English pages quiet.
 */
export const sourceSerif = localFont({
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  preload: false,
  variable: '--font-english',
  src: [
    { path: '../fonts/source-serif/SourceSerif4Variable-Roman.ttf.woff2', weight: '200 900', style: 'normal' },
    { path: '../fonts/source-serif/SourceSerif4Variable-Italic.ttf.woff2', weight: '200 900', style: 'italic' },
  ],
});

/** Amiri — Quran reading and source-book wordmarks on the public site. */
export const amiri = localFont({
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  variable: '--font-amiri',
  src: [{ path: '../fonts/plex/amiri.woff2', weight: '400', style: 'normal' }],
});

/**
 * Thmanyah static faces. Each weight is a real file (including 600 → Bold)
 * so Tailwind's font-semibold does not synthesize a bold.
 * adjustFontFallback is explicit: the Latin fallback metric override does not
 * cover Arabic glyphs, so it stays off. next/font rejects object spread here.
 */
export const thmanyahDisplay = localFont({
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  variable: '--font-arabic-display',
  src: [
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Bold.woff2', weight: '600', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahserifdisplay/woff2/thmanyahserifdisplay-Black.woff2', weight: '900', style: 'normal' },
  ],
});

export const thmanyahText = localFont({
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  variable: '--font-arabic-text',
  src: [
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Bold.woff2', weight: '600', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahseriftext/woff2/thmanyahseriftext-Black.woff2', weight: '900', style: 'normal' },
  ],
});

export const thmanyahSans = localFont({
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  variable: '--font-arabic-ui',
  src: [
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Bold.woff2', weight: '600', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../Thmanyah-Font-Family (1)/thmanyah typeface/thmanyahsans/woff2/thmanyahsans-Black.woff2', weight: '900', style: 'normal' },
  ],
});
