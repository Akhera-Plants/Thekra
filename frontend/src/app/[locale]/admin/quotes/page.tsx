import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { QuoteListView } from '@/features/curation/components/QuoteListView';

export default async function AdminQuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // QuoteListView keeps its filters in the URL (useSearchParams) — needs a Suspense boundary.
  return (
    <Suspense>
      <QuoteListView />
    </Suspense>
  );
}
