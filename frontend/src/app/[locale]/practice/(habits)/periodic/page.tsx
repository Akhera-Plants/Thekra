import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PeriodicView } from '@/features/practice/components/hub/PeriodicView';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › الأعمال الدورية» (round 6 §6). A static shell: the acts are read from the device store.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/periodic'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('periodic')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice/periodic') };
}

export default async function PeriodicPage({ params }: PageProps<'/[locale]/practice/periodic'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PeriodicView />;
}
