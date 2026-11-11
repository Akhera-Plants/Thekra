import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HabitsListView } from '@/features/practice/components/habits/HabitsListView';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › العادات» (round 6 §2). A static shell: the habits live on the device. HabitsListView reads `?add=1`
// («أضف عادة» opens here and comes back here), so it renders under Suspense.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/habits'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('my-habits')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice/habits') };
}

export default async function MyHabitsPage({ params }: PageProps<'/[locale]/practice/habits'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<PracticeLoading />}>
      <HabitsListView />
    </Suspense>
  );
}
