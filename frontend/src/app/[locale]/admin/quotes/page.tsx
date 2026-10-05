import { setRequestLocale } from 'next-intl/server';
import { QuoteListView } from '@/features/curation/components/QuoteListView';

export default async function AdminQuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QuoteListView />;
}
