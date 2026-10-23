import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { BrowseTabs } from '@/features/quran-hadith-browser/components/BrowseTabs';

// Static shell: the tabs and results are client queries (BrowseTabs reads ?tab= behind a Suspense).

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
