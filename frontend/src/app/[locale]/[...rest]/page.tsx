import { notFound } from 'next/navigation';

/**
 * Any URL no route matches (a typo, `/quran/1` without an ayah) lands here inside the locale layout, so the visitor sees
 * the site's own «الصفحة غير موجودة» in their language ([locale]/not-found.tsx), not Next's English default.
 */
export default function CatchAllNotFound() {
  notFound();
}
