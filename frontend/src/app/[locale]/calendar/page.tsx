import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CalendarView } from '@/features/practice/components/CalendarView';
import { localeAlternates } from '@/lib/seo';

// A static shell: the occasions are fetched in the browser (with a retry), so the build never needs the API.
export async function generateMetadata({ params }: PageProps<'/[locale]/calendar'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'calendarPage' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/calendar') };
}

export default async function CalendarPage({ params }: PageProps<'/[locale]/calendar'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('calendarPage');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: t('title') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <CalendarView />
    </div>
  );
}
