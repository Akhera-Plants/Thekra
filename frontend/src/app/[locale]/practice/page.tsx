import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { PracticeView } from '@/features/practice/components/PracticeView';
import { localeAlternates } from '@/lib/seo';

// A static shell: plans live on the device and the catalog is fetched in the browser.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice') };
}

export default async function PracticePage({ params }: PageProps<'/[locale]/practice'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('title') }]} />
      <header className="page-heading">
        <p className="eyebrow">{tNav('practice')}</p>
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <PracticeView />
    </div>
  );
}
