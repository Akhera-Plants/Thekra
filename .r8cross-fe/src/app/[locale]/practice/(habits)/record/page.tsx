import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { RecordView } from '@/features/practice/components/record/RecordView';
import { localeAlternates } from '@/lib/seo';

// «عاداتي › سجلّي» (absorbs the old «مواسم الخير» calendar). A static shell: the month and the occasions are read in the
// browser. RecordView reads `?add=1` (an old «أضف» link redirected here), so it renders under Suspense.
export async function generateMetadata({ params }: PageProps<'/[locale]/practice/record'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav.menuItems' });
  return { title: `${t('record')} · ${t('habits')}`, alternates: localeAlternates(locale, '/practice/record') };
}

export default async function RecordPage({ params }: PageProps<'/[locale]/practice/record'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<PracticeLoading />}>
      <RecordView />
    </Suspense>
  );
}
