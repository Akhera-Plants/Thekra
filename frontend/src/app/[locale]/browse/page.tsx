import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BrowseTabs } from '@/features/quran-hadith-browser/components/BrowseTabs';

// Renders on every request — no static build-time fetch needed.
export const dynamic = 'force-dynamic';

export default async function BrowsePage({
  params,
}: PageProps<'/[locale]/browse'>) {
  // locale unused — force-dynamic; next-intl reads it from the request context
  await params;

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
