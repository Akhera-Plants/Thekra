import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { LeaveSinView } from '@/features/practice/components/LeaveSinView';

/**
 * «ترك المعصية»: local only. A generic tab title (never a sin name), no index, no canonical in the sitemap;
 * the sin is never in the URL (a sin page hands it over through device storage).
 */
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/leave-sin'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leaveSin' });
  return { title: { absolute: t('genericTitle') }, robots: { index: false, follow: false } };
}

export default async function LeaveSinPage({ params }: PageProps<'/[locale]/practice/leave-sin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('leaveSin');
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
        <p className="page-lead">{t('lead')}</p>
      </header>
      <LeaveSinView />
    </div>
  );
}
