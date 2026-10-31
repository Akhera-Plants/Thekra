import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { RecordView } from '@/features/practice/components/hub/RecordView';
import { localeAlternates } from '@/lib/seo';

// A static shell: the streak and the month are read from the device store.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/record'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.record' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/record') };
}

export default async function RecordPage({ params }: PageProps<'/[locale]/practice/record'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.record');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('record') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
      </header>
      <RecordView />
    </div>
  );
}
