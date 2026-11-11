import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { LinkConcernsView } from '@/features/curation/components/links/LinkConcernsView';

export default async function AdminLinkConcernsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The view keeps kind / topic / decision / page in the URL (useSearchParams) — needs a Suspense boundary.
  return (
    <Suspense>
      <LinkConcernsView />
    </Suspense>
  );
}
