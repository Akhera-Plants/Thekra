import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { HabitsHub } from '@/features/practice/components/hub/HabitsHub';
import { localeAlternates } from '@/lib/seo';

// A static shell: the day is read from the device store and the catalog is fetched in the browser.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.hub' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice') };
}

export default async function PracticeHubPage({ params }: PageProps<'/[locale]/practice'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('practice') }]} />
      <HabitsHub />
    </div>
  );
}
