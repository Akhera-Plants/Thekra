import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { BrowseTabs } from '@/features/quran-hadith-browser/components/BrowseTabs';
import { localeAlternates } from '@/lib/seo';

// Static shell: the tabs and results are client queries (BrowseTabs reads ?tab= behind a Suspense).

/** «تصفّح · ذكرى» in the tab (W-18). */
export async function generateMetadata({ params }: PageProps<'/[locale]/browse'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'browse' });
  return { title: t('pageTitle'), alternates: localeAlternates(locale, '/browse') };
}

export default async function BrowsePage({
  params,
}: PageProps<'/[locale]/browse'>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('browse');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold md:text-3xl">{t('pageTitle')}</h1>
      <Suspense>
        <BrowseTabs />
      </Suspense>
    </div>
  );
}
