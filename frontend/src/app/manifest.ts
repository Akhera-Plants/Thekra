import type { MetadataRoute } from 'next';

/**
 * Web app manifest (/manifest.webmanifest): installable on phones and desktops.
 * Arabic is the default locale, so the app opens on the Arabic home page.
 * Colours are the light theme's page colour (globals.css --background), so the installed
 * app's bars match the page; the icons carry the brand green of icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ذكرى',
    short_name: 'ذكرى',
    description:
      'تذكيرات من القرآن الكريم والسنّة وأقوال أهل العلم، مرتبة بالمعاصي والطاعات وشُعب الإيمان، مع بيان مصدر كل نص.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fffcf9',
    theme_color: '#fffcf9',
    categories: ['books', 'education', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'أعنّي على ترك معصية', short_name: 'المعاصي', url: '/sins' },
      { name: 'أعنّي على فعل طاعة', short_name: 'الطاعات', url: '/good-deeds' },
      { name: 'شُعب الإيمان', short_name: 'الشعب', url: '/branches' },
    ],
  };
}
