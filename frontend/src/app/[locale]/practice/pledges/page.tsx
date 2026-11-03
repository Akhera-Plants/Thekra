import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PledgesView } from '@/features/practice/components/PledgesView';
import { localeAlternates } from '@/lib/seo';

// «التزام شخصي»: a static shell; the habits and their pledges are read from this device.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/pledges'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.pledges' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/pledges') };
}

export default async function PledgesPage({ params }: PageProps<'/[locale]/practice/pledges'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.pledges');
  const tNotify = await getTranslations('practice.notify');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tNotify('title'), href: '/practice/notifications' },
          { label: t('title') },
        ]}
      />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <PledgesView />
    </div>
  );
}
