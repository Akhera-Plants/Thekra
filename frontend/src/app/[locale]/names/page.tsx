import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { NamesCatalog } from '@/features/names/components/NamesCatalog';
import { getNamesOfAllah } from '@/lib/api/names';
import { reportFailure } from '@/lib/errors';
import { localeAlternates } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/names'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'names' });
  // Hidden for now (owner, 2026-11-01): nothing links here and search engines skip it.
  return { title: t('pageTitle'), alternates: localeAlternates(locale, '/names'), robots: { index: false } };
}

/** «الأسماء الحسنى» (redesign §4.7). Hidden from every link for now (owner, 2026-11-01). */
export default async function NamesPage({ params }: PageProps<'/[locale]/names'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('names');
  const tNav = await getTranslations('nav');
  const tCrumbs = await getTranslations('breadcrumbs');

  // The list is the page: error.tsx with a retry, not a cached empty catalogue.
  const names = (
    await getNamesOfAllah().catch((error: unknown) => {
      reportFailure('names catalogue', error);
      throw error;
    })
  ).data;

  return (
    <div className="page-width inner-page path-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[{ label: tCrumbs('home'), href: '/' }, { label: tCrumbs('names') }]}
      />
      <header className="page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 id="page-title" tabIndex={-1}>
          {t('pageTitle')}
        </h1>
        <p className="page-lead">{t('lead')}</p>
      </header>
      <NamesCatalog names={names} />
    </div>
  );
}
