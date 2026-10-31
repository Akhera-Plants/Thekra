import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { PracticeView } from '@/features/practice/components/PracticeView';
import { accountsEnabled } from '@/lib/accounts';
import { localeAlternates } from '@/lib/seo';

// A static shell: plans live on the device and the catalog is fetched in the browser. PracticeView reads `?add=1`
// (from «أضف» on the hub), so it renders under Suspense.
// The lead mentions account sync («أولًا») only when accounts are on (otherwise nothing leaves the device).
const leadKey = () => (accountsEnabled() ? 'lead' : 'leadLocal');

export async function generateMetadata({ params }: PageProps<'/[locale]/practice/habits'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice' });
  return { title: t('title'), description: t(leadKey()), alternates: localeAlternates(locale, '/practice/habits') };
}

export default async function PracticeHabitsPage({ params }: PageProps<'/[locale]/practice/habits'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('practice'), href: '/practice' }, { label: t('title') }]}
      />
      <header className="page-heading">
        <p className="eyebrow">{tNav('practice')}</p>
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t(leadKey())}</p>
      </header>
      <Suspense fallback={<PracticeLoading />}>
        <PracticeView />
      </Suspense>
    </div>
  );
}
