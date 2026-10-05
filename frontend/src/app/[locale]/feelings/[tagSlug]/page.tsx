import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { FeelingsView } from './_FeelingsView';

export const dynamic = 'force-dynamic';

export default async function FeelingsPage({
  params,
}: PageProps<'/[locale]/feelings/[tagSlug]'>) {
  const { tagSlug, locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <FeelingsView tagSlug={tagSlug} />
    </Suspense>
  );
}
