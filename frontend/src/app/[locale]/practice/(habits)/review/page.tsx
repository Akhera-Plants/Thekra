import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReviewView } from '@/features/practice/components/review/ReviewView';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › محاسبتي» (F-07 a). A static shell: the reviews are read from this device.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/review'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('review')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice/review') };
}

export default async function ReviewPage({ params }: PageProps<'/[locale]/practice/review'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewView />;
}
