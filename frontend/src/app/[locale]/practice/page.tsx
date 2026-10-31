import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { WirdView } from '@/features/practice/components/hub/WirdView';
import { localeAlternates } from '@/lib/seo';

// A static shell: the day is read from the device store and the catalog is fetched in the browser. WirdView reads
// `?add=1` (the home page's «ابدأ بغرسٍ صغير» opens «أضف»), so it renders under Suspense.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.wird' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice') };
}

export default async function WirdPage({ params }: PageProps<'/[locale]/practice'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('practice') }]} />
      <Suspense fallback={<PracticeLoading />}>
        <WirdView />
      </Suspense>
    </div>
  );
}
