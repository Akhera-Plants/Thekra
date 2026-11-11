import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { ReviewView } from '@/features/practice/components/review/ReviewView';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › محاسبتي» (round 6 §4: tabs «اليوم / الأسبوع»). A static shell: the reviews are read from this device.
// ReviewView reads `?tab=week`, so it renders under Suspense.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/review'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('review')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice/review') };
}

export default async function ReviewPage({ params }: PageProps<'/[locale]/practice/review'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<PracticeLoading />}>
      <ReviewView />
    </Suspense>
  );
}
