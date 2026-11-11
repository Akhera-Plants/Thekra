import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

/** «الصفحة غير موجودة · ذكرى» in the tab (W-18), not the bare app name. */
export async function generateMetadata({ params }: PageProps<'/[locale]/[...rest]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'feedback.notFound' });
  return { title: t('title'), robots: { index: false } };
}

/**
 * Any URL no route matches (a typo, `/quran/1` without an ayah) lands here inside the locale layout, so the visitor sees
 * the site's own «الصفحة غير موجودة» in their language ([locale]/not-found.tsx), not Next's English default.
 */
export default function CatchAllNotFound() {
  notFound();
}
