import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { FavoritesList } from '@/features/favorites/components/FavoritesList';
import { FavoritesGuard } from '@/features/favorites/components/FavoritesGuard';
import { accountsEnabled } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

interface FavoritesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FavoritesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'favorites' });
  return { title: t('pageTitle') };
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!accountsEnabled()) {
    redirect({ href: '/', locale });
  }

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
        <p className="page-lead">{t('lead')}</p>
      </header>

      <FavoritesGuard>
        <FavoritesList />
      </FavoritesGuard>
    </div>
  );
}
