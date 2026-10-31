import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { ReviewsView } from '@/features/practice/components/hub/ReviewsView';
import { localeAlternates } from '@/lib/seo';

// A static shell: the reviews are read from this device.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/reviews'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'practice.heart.reviews' });
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(locale, '/practice/reviews') };
}

export default async function ReviewsPage({ params }: PageProps<'/[locale]/practice/reviews'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('practice.heart.reviews');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');
  return (
    <div className="page-width inner-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tNav('record'), href: '/practice/record' }, { label: t('title') }]}
      />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <ReviewsView />
    </div>
  );
}
