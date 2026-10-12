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
