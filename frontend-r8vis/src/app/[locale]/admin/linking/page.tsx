import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { LinkingView } from '@/features/curation/components/LinkingView';

export default async function AdminLinkingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // LinkingView keeps tab / kind / sin in the URL (useSearchParams) — needs a Suspense boundary.
  return (
    <Suspense>
      <LinkingView />
    </Suspense>
  );
}
