import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Link } from '@/i18n/navigation';

/**
 * Shown by the service worker (public/sw.js) when a page is requested offline and was never
 * opened before. Static: the worker stores it at install, one copy per language.
 */
export const dynamic = 'force-static';

export async function generateMetadata({ params }: PageProps<'/[locale]/offline'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'offline' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function OfflinePage({ params }: PageProps<'/[locale]/offline'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('offline');
  return (
    <div className="page-width inner-page">
      <div className="empty-state">
        <h1 id="page-title" tabIndex={-1}>{t('title')}</h1>
        <p>{t('body')}</p>
        <Link href="/" className="solid-button">
          {t('home')} <DirectionalArrow className="size-[18px]" />
        </Link>
      </div>
    </div>
  );
}
