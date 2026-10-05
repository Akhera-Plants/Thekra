import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { FavoritesList } from '@/features/favorites/components/FavoritesList';
import { FavoritesGuard } from '@/features/favorites/components/FavoritesGuard';

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

  const t = await getTranslations({ locale, namespace: 'favorites' });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('pageTitle')}</h1>
      {/* FavoritesGuard renders SignInPrompt for guests, FavoritesList for users */}
      <FavoritesGuard>
        <FavoritesList />
      </FavoritesGuard>
    </div>
  );
}
