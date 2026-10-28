import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { KinshipView } from '@/features/practice/components/KinshipView';
import { localeAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: PageProps<'/[locale]/practice/kinship'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.kinship' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/kinship') };
}

export default async function KinshipPage({ params }: PageProps<'/[locale]/practice/kinship'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.kinship');
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
      <KinshipView />
    </div>
  );
}
