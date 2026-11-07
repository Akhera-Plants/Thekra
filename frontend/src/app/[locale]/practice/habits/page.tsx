import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { PracticeView } from '@/features/practice/components/PracticeView';
import { NotificationsLink } from '@/features/practice/components/NotificationsLink';
import { TitleRow } from '@/components/shared/kit/title-row';
import { localeAlternates } from '@/lib/seo';

// «عاداتي» (owner, 2026-11-01: the habits and what was «السجل», one page). A static shell: plans live on the device and
// the catalog is fetched in the browser. PracticeView reads `?add=1` (from «أضف» on the hub) and `?tab=`, so it renders
// under Suspense. `/practice/record` redirects here.

export async function generateMetadata({ params }: PageProps<'/[locale]/practice/habits'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/habits') };
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
        items={[{ label: tCrumbs('home'), href: '/' }, { label: t('title') }]}
      />
      <header className="page-heading">
        <TitleRow action={<NotificationsLink />}>
          <h1 id="page-title" tabIndex={-1}>
            {t('title')}
          </h1>
        </TitleRow>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <Suspense fallback={<PracticeLoading />}>
        <PracticeView />
      </Suspense>
    </div>
  );
}
