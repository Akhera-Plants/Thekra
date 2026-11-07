import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FavoritesGuard } from '@/features/favorites/components/FavoritesGuard';
import { SavedTabs } from '@/features/favorites/components/SavedTabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/favorites'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'favorites' });
  return { title: t('pageTitle') };
}

/**
 * «المحفوظات»: «النصوص» and «تذكيراتي» (owner round 5, F-22 a), for signed-in members. `?tab=reminders` (an older link)
 * still opens «تذكيراتي», whose own address is `/favorites/reminders`.
 */
export default async function FavoritesPage({ params, searchParams }: PageProps<'/[locale]/favorites'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tab } = await searchParams;

  const t = await getTranslations({ locale, namespace: 'favorites' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tCrumbs = await getTranslations({ locale, namespace: 'breadcrumbs' });

  return (
    <div className="page-width inner-page favorites-page">
      <Breadcrumbs
        ariaLabel={tNav('breadcrumbs')}
        items={[
          { label: tCrumbs('home'), href: '/' },
          { label: tCrumbs('favorites') },
        ]}
      />

      <header className="page-heading">
        <h1 id="page-title" tabIndex={-1}>{t('pageTitle')}</h1>
      </header>

      <FavoritesGuard>
        <SavedTabs initial={tab === 'reminders' ? 'reminders' : 'texts'} />
      </FavoritesGuard>
    </div>
  );
}
