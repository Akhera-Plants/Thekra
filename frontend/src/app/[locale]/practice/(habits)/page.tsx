import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { WirdView } from '@/features/practice/components/hub/WirdView';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › ورد اليوم». A static shell: the day is read from the device store and the catalog is fetched in the
// browser. WirdView reads `?add=1` (opens «أضف عادة»), so it renders under Suspense.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('wird')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice') };
}

export default async function WirdPage({ params }: PageProps<'/[locale]/practice'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<PracticeLoading />}>
      <WirdView />
    </Suspense>
  );
}
