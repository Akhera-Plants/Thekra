import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PeopleView } from '@/features/practice/components/people/PeopleView';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { localeAlternates } from '@/lib/seo';

// «أهلي وناسي» (F-15 a): every people list on one page. A static shell: the lists live on the device.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/people'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: t('people'), alternates: localeAlternates(locale, '/practice/people') };
}

export default async function PeoplePage({ params }: PageProps<'/[locale]/practice/people'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  const t = await getTranslations('practice.people');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('menuItems.habits'), href: '/practice' }, { label: tNav('menuItems.people') }]}
      />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {tNav('menuItems.people')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      {/* PeopleView reads `?circle=` (an old link to one list scrolls to its section), so it renders under Suspense. */}
      <Suspense fallback={<PracticeLoading />}>
        <PeopleView />
      </Suspense>
    </div>
  );
}
