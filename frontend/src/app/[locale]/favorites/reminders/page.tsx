import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FavoritesGuard } from '@/features/favorites/components/FavoritesGuard';
import { SavedTabs } from '@/features/favorites/components/SavedTabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/favorites/reminders'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'favorites' });
  return { title: t('pageTitle') };
}

/**
 * «المحفوظات › تذكيراتي» (round 5, F-22 a; `/practice/my-reminders` redirects here): the same page as `/favorites`,
 * opened on its «تذكيراتي» tab. The breadcrumb's last step is the page («المحفوظات»), as on `/favorites`: the tab is
 * shown by the tab bar.
 */
export default async function FavoriteRemindersPage({ params }: PageProps<'/[locale]/favorites/reminders'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'favorites' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tCrumbs = await getTranslations({ locale, namespace: 'breadcrumbs' });
  return (
    <div className="page-width inner-page favorites-page">
      <Breadcrumbs ariaLabel={tNav('breadcrumbs')} items={[{ label: tCrumbs('home'), href: '/' }, { label: tCrumbs('favorites') }]} />
      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>{t('pageTitle')}</h1>
      </header>
      <FavoritesGuard>
        <SavedTabs initial="reminders" />
      </FavoritesGuard>
    </div>
  );
}
